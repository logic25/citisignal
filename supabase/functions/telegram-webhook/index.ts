import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { emailHeader, emailBody, emailFooter } from "../_shared/email-template.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not configured");
      return new Response("OK", { status: 200 });
    }

    const body = await req.json();

    // Handle webhook setup request
    if (body.action === "setup_webhook") {
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-webhook`;
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const result = await res.json();
      console.log("setWebhook result:", JSON.stringify(result));
      return new Response(JSON.stringify(result), {
        status: res.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update = body;
    console.log("Telegram update:", JSON.stringify(update).slice(0, 500));

    const message = update.message;
    if (!message) {
      return new Response("OK", { status: 200 });
    }

    const chatId = message.chat.id;
    const text = message.text?.trim() || "";
    const caption = message.caption?.trim() || "";
    const photo = message.photo; // Array of PhotoSize objects, largest last
    const username = message.from?.username || null;
    const firstName = message.from?.first_name || null;

    // If no text AND no photo, skip
    if (!text && !photo) {
      return new Response("OK", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Log inbound message (best-effort, don't block)
    const logInbound = async () => {
      try {
        // Find vendor or user associated with this chat
        const [{ data: tUser }, { data: vMatch }] = await Promise.all([
          supabase.from("telegram_users").select("user_id").eq("chat_id", chatId).maybeSingle(),
          supabase.from("vendors").select("id").eq("telegram_chat_id", chatId).maybeSingle(),
        ]);
        await supabase.from("telegram_messages").insert({
          chat_id: chatId,
          user_id: tUser?.user_id || null,
          vendor_id: vMatch?.id || null,
          direction: "inbound",
          message_text: text || caption || (photo ? "[photo]" : null),
          telegram_message_id: message.message_id || null,
        });
      } catch (e) { console.error("Log inbound err:", e); }
    };
    logInbound(); // fire and forget

    // Handle /start command with linking code
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      if (parts.length > 1) {
        const linkCode = parts[1];
        try {
          const userId = atob(linkCode);
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
            const { error } = await supabase
              .from("telegram_users")
              .upsert(
                {
                  user_id: userId,
                  chat_id: chatId,
                  username,
                  first_name: firstName,
                  is_active: true,
                },
                { onConflict: "chat_id" }
              );

            if (error) {
              console.error("Error linking user:", error);
              await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "❌ Failed to link account. Please try again.");
            } else {
              await sendTelegram(
                TELEGRAM_BOT_TOKEN,
                chatId,
                `✅ *Account linked!*\n\nWelcome to CitiSignal, ${firstName || "there"}! You can now:\n\n• Ask about your properties and violations\n• Get daily compliance digests\n• Query hearings and deadlines\n\nTry: _"Show violations for 123 Main St"_\n\nType /help to see all features.`,
                "Markdown"
              );
            }
            return new Response("OK", { status: 200 });
          }
        } catch {
          // Invalid base64, fall through to welcome
        }
      }

      await sendTelegram(
        TELEGRAM_BOT_TOKEN,
        chatId,
        `👋 *Welcome to CitiSignal Bot!*\n\nTo get started, link your account from the Settings page in CitiSignal.\n\nOnce linked, you can:\n• Query violations by property\n• Get compliance status updates\n• Receive daily digests`,
        "Markdown"
      );
      return new Response("OK", { status: 200 });
    }

    // Handle /help
    if (text === "/help") {
      await sendTelegram(
        TELEGRAM_BOT_TOKEN,
        chatId,
        `📋 *CitiSignal Bot — What You Can Ask*\n\n` +
        `🏢 *Properties & Violations*\n` +
        `• _"Open violations at 123 Main St"_\n` +
        `• _"What's the SWO about?"_\n` +
        `• _"Any complaints filed against my building?"_\n\n` +
        `📄 *Leases & Tenants*\n` +
        `• _"When does the lease expire for unit 3?"_\n` +
        `• _"What's the escalation clause?"_\n` +
        `• _"How much rent is the tenant paying?"_\n\n` +
        `🔧 *Work Orders & Vendors*\n` +
        `• _"What are my open work orders?"_\n` +
        `• _"Did the contractor sign the PO?"_\n` +
        `• _"Who's my plumber?"_\n\n` +
        `📝 *Applications & Permits*\n` +
        `• _"Do I have any open applications?"_\n` +
        `• _"When was the permit approved?"_\n\n` +
        `🛡️ *Insurance & Compliance*\n` +
        `• _"Did the tenant submit their insurance?"_\n` +
        `• _"What compliance items are overdue?"_\n\n` +
        `📁 *Documents*\n` +
        `• _"Do I have a survey on file?"_\n` +
        `• _"What documents are uploaded?"_\n\n` +
        `📸 *Damage Assessment*\n` +
        `• _Send a photo of damage + optional caption_\n` +
        `• _Bot identifies damage type & finds lease clause_\n\n` +
        `/status — Quick portfolio overview\n` +
        `/alerts — View your notification settings\n` +
        `/unlink — Disconnect your account\n` +
        `/help — Show this message`,
        "Markdown"
      );
      return new Response("OK", { status: 200 });
    }

    // Handle /unlink
    if (text === "/unlink") {
      await supabase
        .from("telegram_users")
        .update({ is_active: false })
        .eq("chat_id", chatId);

      await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "✅ Account unlinked. You'll no longer receive alerts.");
      return new Response("OK", { status: 200 });
    }

    // Look up linked user
    const { data: telegramUser } = await supabase
      .from("telegram_users")
      .select("user_id, is_active")
      .eq("chat_id", chatId)
      .single();

    // Check if sender is a vendor (by telegram_chat_id)
    const { data: vendorMatch } = await supabase
      .from("vendors")
      .select("id, name, user_id, email")
      .eq("telegram_chat_id", chatId)
      .limit(1)
      .maybeSingle();

    if (vendorMatch) {
      // Vendor message — check for PO acceptance first
      console.log("Vendor message from:", vendorMatch.name, "text:", text);

      const codeMatch = text.match(/^\d{6}$/);
      if (codeMatch) {
        const { data: pending } = await supabase
          .from("pending_po_confirmations")
          .select("id, po_id, confirmation_code, expires_at")
          .eq("vendor_id", vendorMatch.id)
          .eq("channel", "telegram")
          .eq("chat_id", String(chatId))
          .eq("used", false)
          .gte("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pending && pending.confirmation_code === codeMatch[0]) {
          const { data: po } = await supabase
            .from("purchase_orders")
            .select("id, po_number, status, work_order_id, property_id, user_id, amount")
            .eq("id", pending.po_id)
            .single();

          if (!po) {
            await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "❌ Purchase order no longer exists.");
            return new Response("OK", { status: 200 });
          }

          await supabase.from("pending_po_confirmations").update({ used: true }).eq("id", pending.id);
          await supabase.from("purchase_orders").update({ vendor_signed_at: new Date().toISOString(), status: "fully_executed" }).eq("id", po.id);

          if (po.work_order_id) {
            await supabase.from("work_orders").update({ status: "in_progress" }).eq("id", po.work_order_id);
          }

          if (po.user_id) {
            const { data: prop } = await supabase.from("properties").select("address").eq("id", po.property_id).single();
            await supabase.from("notifications").insert({
              user_id: po.user_id,
              title: `${po.po_number} Signed by ${vendorMatch.name}`,
              message: `${vendorMatch.name} has signed ${po.po_number} ($${po.amount?.toLocaleString()}) for ${prop?.address}. Work is now in progress.`,
              priority: "high",
              category: "work_orders",
              property_id: po.property_id,
              entity_type: "purchase_order",
              entity_id: po.id,
            });
          }

          await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, `✅ *${po.po_number} Signed!*\n\nYou've accepted the purchase order for $${po.amount?.toLocaleString()}. Work is now authorized to begin.`, "Markdown");
          return new Response("OK", { status: 200 });
        } else if (pending) {
          await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "❌ Invalid code. Please check the code in your email and try again.");
          return new Response("OK", { status: 200 });
        }
      }

      const acceptMatch = text.toUpperCase().match(/ACCEPT\s+(PO-\d+)/);
      if (acceptMatch) {
        const poNumber = acceptMatch[1];
        const { data: po, error: poErr } = await supabase.from("purchase_orders").select("id, po_number, status, work_order_id, property_id, user_id, amount").eq("po_number", poNumber).eq("vendor_id", vendorMatch.id).maybeSingle();

        if (poErr || !po) {
          await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, `❌ Purchase order ${poNumber} not found or not assigned to you.`);
          return new Response("OK", { status: 200 });
        }
        if (po.status === "fully_executed") {
          await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, `✅ ${poNumber} is already fully executed.`);
          return new Response("OK", { status: 200 });
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await supabase.from("pending_po_confirmations").insert({
          vendor_id: vendorMatch.id, po_id: po.id, confirmation_code: code,
          channel: "telegram", chat_id: String(chatId), expires_at: expiresAt,
        });

        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        const fromAddress = Deno.env.get("RESEND_FROM_ADDRESS") || "CitiSignal <noreply@citisignal.com>";
        if (RESEND_API_KEY && vendorMatch.email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: fromAddress, to: vendorMatch.email,
              subject: `CitiSignal PO Confirmation Code: ${poNumber}`,
              html: emailHeader('PO Confirmation Code') +
                emailBody(`
                  <p style="color:#1e293b;font-size:15px;margin:0 0 6px;">Hi ${vendorMatch.name || 'there'},</p>
                  <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 20px;">
                    Enter the code below in Telegram to confirm and sign <strong>${poNumber}</strong>.
                  </p>
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:4px 0;"><span style="color:#64748b;font-size:12px;">PO Number</span></td>
                          <td style="text-align:right;"><strong style="color:#1e293b;font-size:13px;">${poNumber}</strong></td></tr>
                      <tr><td style="padding:4px 0;"><span style="color:#64748b;font-size:12px;">Amount</span></td>
                          <td style="text-align:right;"><strong style="color:#0f172a;font-size:16px;">$${po.amount?.toLocaleString()}</strong></td></tr>
                    </table>
                  </div>
                  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px;padding:28px;text-align:center;margin-bottom:20px;">
                    <p style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">Your Confirmation Code</p>
                    <div style="font-size:40px;font-weight:800;letter-spacing:10px;color:#ffffff;font-family:monospace;">${code}</div>
                    <p style="color:#64748b;font-size:12px;margin:10px 0 0;">Expires in 10 minutes</p>
                  </div>
                  <p style="color:#94a3b8;font-size:12px;margin:0;">If you did not request this, you can safely ignore this email.</p>
                `) +
                emailFooter(),
            }),
          });
        }

        const maskedEmail = vendorMatch.email ? vendorMatch.email.replace(/(.{2}).*(@.*)/, "$1***$2") : "on file";
        await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, `🔐 *Verification Required*\n\nTo sign ${poNumber} ($${po.amount?.toLocaleString()}), we've sent a 6-digit code to your email (${maskedEmail}).\n\nReply with the code to confirm.`, "Markdown");
        return new Response("OK", { status: 200 });
      }

      // Normal vendor messages (quotes, etc.)
      const { data: openWOs } = await supabase.from("work_orders").select("id, scope, status, property_id").eq("vendor_id", vendorMatch.id).in("status", ["dispatched", "open"]);
      if (openWOs && openWOs.length > 0) {
        const amountMatch = text.match(/\$?([\d,]+(?:\.\d{1,2})?)/);
        const extractedAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
        const targetWO = openWOs[0];
        await supabase.from("work_order_messages").insert({ work_order_id: targetWO.id, sender_type: "vendor", sender_name: vendorMatch.name, channel: "telegram", message: text, extracted_amount: extractedAmount });

        if (extractedAmount && extractedAmount > 0) {
          await supabase.from("work_orders").update({ status: "quoted" as any, quoted_amount: extractedAmount }).eq("id", targetWO.id);
          const { data: prop } = await supabase.from("properties").select("user_id, address").eq("id", targetWO.property_id).single();
          if (prop?.user_id) {
            await supabase.from("notifications").insert({ user_id: prop.user_id, title: "Vendor Quote Received", message: `${vendorMatch.name} quoted $${extractedAmount.toLocaleString()} for "${targetWO.scope.substring(0, 80)}" at ${prop.address}`, priority: "high", category: "work_orders", property_id: targetWO.property_id, entity_type: "work_order", entity_id: targetWO.id });
          }
          await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, `✅ Got it! Your quote of $${extractedAmount.toLocaleString()} for "${targetWO.scope.substring(0, 60)}" has been submitted.`);
        } else {
          await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, `📝 Message logged for work order: "${targetWO.scope.substring(0, 60)}". To submit a quote, include the dollar amount (e.g. $2,500).`);
        }
      } else {
        await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, `Thanks for your message! No open work orders found assigned to you right now.`);
      }
      return new Response("OK", { status: 200 });
    }

    // --- Owner/User message handling ---
    if (!telegramUser || !telegramUser.is_active) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "⚠️ Your account is not linked. Please link from Settings in CitiSignal.");
      return new Response("OK", { status: 200 });
    }

    const userId = telegramUser.user_id;

    // Handle /status command
    if (text === "/status") {
      const summary = await getPortfolioSummary(supabase, userId);
      await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, summary, "Markdown");
      return new Response("OK", { status: 200 });
    }

    // Handle /alerts command
    if (text === "/alerts") {
      const { data: prefs } = await supabase
        .from("email_preferences")
        .select("telegram_new_violations, telegram_status_changes, telegram_new_applications, telegram_expirations, telegram_daily_summary, telegram_critical_alerts")
        .eq("user_id", userId)
        .single();

      if (!prefs) {
        await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "⚠️ No notification preferences found. Please set up alerts in CitiSignal Settings.");
        return new Response("OK", { status: 200 });
      }

      const toggleEmoji = (val: boolean) => val ? "✅" : "☐";

      await sendTelegram(
        TELEGRAM_BOT_TOKEN,
        chatId,
        `🔔 *Your Telegram Alerts*\n\n` +
        `${toggleEmoji(prefs.telegram_new_violations)} New Violations\n` +
        `${toggleEmoji(prefs.telegram_status_changes)} Status Changes\n` +
        `${toggleEmoji(prefs.telegram_new_applications)} New Applications\n` +
        `${toggleEmoji(prefs.telegram_expirations)} Expiring Insurance/Docs\n` +
        `${toggleEmoji(prefs.telegram_daily_summary)} Daily Summary\n` +
        `${toggleEmoji(prefs.telegram_critical_alerts)} Critical Alerts (SWO/Vacate)\n\n` +
        `To change these, visit Settings in CitiSignal.`,
        "Markdown"
      );
      return new Response("OK", { status: 200 });
    }

    // Handle photo messages — damage assessment + lease lookup
    if (photo && photo.length > 0) {
      console.log("Photo received, running damage assessment");
      await sendTypingAction(TELEGRAM_BOT_TOKEN, chatId);
      const largestPhoto = photo[photo.length - 1];

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "⚠️ AI service not configured.");
        return new Response("OK", { status: 200 });
      }

      const { context: propertyContext, properties: userProperties } = await getPropertyContext(supabase, userId);

      const reply = await handleDamagePhoto(
        supabase, userId, largestPhoto.file_id, caption,
        userProperties, TELEGRAM_BOT_TOKEN, LOVABLE_API_KEY
      );

      const truncatedReply = reply.length > 4000 ? reply.slice(0, 4000) + "\n\n_...truncated_" : reply;
      await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, truncatedReply, "Markdown");

      // Log to property chat
      try {
        const matchedProperty = caption
          ? findMentionedProperty(caption, userProperties)
          : userProperties.length === 1 ? userProperties[0] : null;
        if (matchedProperty) {
          await logToPropertyChat(supabase, userId, matchedProperty.id,
            `[via Telegram Photo] ${caption || "Damage photo sent"}`,
            `[via Telegram Photo Analysis] ${reply}`);
        }
      } catch (logErr) {
        console.error("Error logging photo analysis:", logErr);
      }

      return new Response("OK", { status: 200 });
    }

    // If message has no text at this point, skip
    if (!text) {
      return new Response("OK", { status: 200 });
    }

    // Show typing indicator immediately so user knows bot is working
    await sendTypingAction(TELEGRAM_BOT_TOKEN, chatId);

    // AI-powered query: fetch property context and ask AI
    console.log("Fetching property context for user:", userId);
    const { context: propertyContext, properties: userProperties } = await getPropertyContext(supabase, userId);
    console.log("Property context length:", propertyContext.length, "chars, properties:", userProperties.length);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "⚠️ AI service not configured.");
      return new Response("OK", { status: 200 });
    }

    let reply: string;

    // Route lease-specific questions to dedicated handler with stronger model + citations
    if (isLeaseQuestion(text)) {
      console.log("Detected lease question, routing to lease Q&A pipeline");
      reply = await handleLeaseQuestion(supabase, userId, text, propertyContext, userProperties, LOVABLE_API_KEY);
    } else {
      // General property question — use expanded context with all data
      const systemPrompt = `You are CitiSignal Bot, a Telegram assistant for NYC property owners.
You have access to the user's complete property portfolio data below. Answer questions concisely for Telegram (max 4000 chars).
Use Markdown formatting sparingly (bold for emphasis, bullet points for lists).
If the user asks about a property not in their portfolio, say so.
If you can't determine the answer from the data, say so honestly.

When answering, ALWAYS cite your data source:
- For violations: include the violation number and agency
- For applications: include the application number
- For work orders: include the scope and status
- For documents: include the document name
- For tenant info: include the unit number and company name
- For financial data: include the tax year or PO number

PORTFOLIO DATA:
${propertyContext}

RULES:
- Be brief and direct — this is Telegram, not a report
- Reference specific numbers, dates, amounts
- For compliance questions, check both violations AND compliance_requirements
- For tax questions, check property_taxes data
- For lease questions, check BOTH the structured tenant data AND the Documents section
- For work order questions, check work_orders and purchase_orders
- For "do I have a ___" questions, check the Documents on File list
- For vendor questions, check the Vendor Directory
- For "what changed" questions, check Recent Activity
- Always mention the property address when referencing data
- When answering questions about lease obligations, legal responsibilities, penalties, or compliance deadlines, end your response with:
"⚠️ This is informational only — not legal advice. Consult a licensed attorney or expeditor for legal matters."`;

      console.log("Calling AI, system prompt length:", systemPrompt.length);
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
        }),
      });

      console.log("AI response status:", aiResponse.status);

      if (!aiResponse.ok) {
        console.error("AI error:", aiResponse.status, await aiResponse.text().catch(() => ""));
        if (aiResponse.status === 429) {
          reply = "⚠️ Rate limit reached. Please try again in a moment.";
        } else if (aiResponse.status === 402) {
          reply = "⚠️ AI credits depleted. Contact admin.";
        } else {
          reply = "⚠️ Error processing your request. Please try again.";
        }
      } else {
        const aiData = await aiResponse.json();
        reply = aiData.choices?.[0]?.message?.content || "No response generated.";
      }
    }

    console.log("AI reply length:", reply.length);

    // Telegram max message length is 4096
    const truncatedReply = reply.length > 4000 ? reply.slice(0, 4000) + "\n\n_...truncated_" : reply;
    await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, truncatedReply, "Markdown");
    console.log("Telegram reply sent");

    // Log Q&A to property AI conversation
    try {
      const matchedProperty = findMentionedProperty(text, userProperties);
      if (matchedProperty) {
        await logToPropertyChat(supabase, userId, matchedProperty.id, 
          `[via Telegram] ${text}`, `[via Telegram] ${reply}`);
        console.log("Logged to property chat:", matchedProperty.address);
      }
    } catch (logErr) {
      console.error("Error logging to property chat:", logErr);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return new Response("OK", { status: 200 });
  }
});

// ─── Helper Functions ───

async function sendTypingAction(token: string, chatId: number) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    });
  } catch (e) {
    console.error("Typing action error:", e);
  }
}

async function sendTelegram(token: string, chatId: number, text: string, parseMode?: string) {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Telegram sendMessage error:", errText);
    if (parseMode) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    }
  }

  // Log outbound message (best-effort)
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const [{ data: tUser }, { data: vMatch }] = await Promise.all([
      supabase.from("telegram_users").select("user_id").eq("chat_id", chatId).maybeSingle(),
      supabase.from("vendors").select("id").eq("telegram_chat_id", chatId).maybeSingle(),
    ]);
    await supabase.from("telegram_messages").insert({
      chat_id: chatId,
      user_id: tUser?.user_id || null,
      vendor_id: vMatch?.id || null,
      direction: "outbound",
      message_text: text,
    });
  } catch (e) { console.error("Log outbound err:", e); }
}

// ─── Lease Question Detection ───

function isLeaseQuestion(text: string): boolean {
  const leaseKeywords = [
    "lease", "rent", "tenant", "sublease", "sublet", "landlord",
    "escalation", "renewal", "termination", "eviction", "security deposit",
    "cam", "common area", "triple net", "nnn", "gross lease",
    "option to renew", "right of first refusal", "assignment",
    "permitted use", "exclusive use", "co-tenancy", "radius restriction",
    "percentage rent", "breakpoint", "base year", "operating expenses",
    "tenant improvement", "build out", "free rent", "abatement",
    "holdover", "surrender", "estoppel", "subordination", "attornment",
    "condemnation", "casualty", "force majeure", "default", "cure period",
    "article", "section", "clause", "paragraph", "exhibit",
    "what does the lease say", "according to the lease", "in the lease"
  ];
  const lower = text.toLowerCase();
  return leaseKeywords.some(kw => lower.includes(kw));
}

// ─── Lease Q&A Handler ───

async function handleLeaseQuestion(
  supabase: any, userId: string, text: string, propertyContext: string,
  properties: any[], LOVABLE_API_KEY: string
): Promise<string> {
  const matchedProperty = findMentionedProperty(text, properties);
  const propertyIds = matchedProperty ? [matchedProperty.id] : properties.map((p: any) => p.id);

  const { data: leaseDocs } = await supabase
    .from("property_documents")
    .select("id, document_name, document_type, extracted_text, property_id")
    .in("property_id", propertyIds)
    .not("extracted_text", "is", null);

  // Filter to lease-related docs
  const leaseRelated = leaseDocs?.filter((d: any) =>
    ["lease", "lease_amendment", "lease_rider", "sublease", "assignment_of_lease", "other"].includes(d.document_type) ||
    /lease|rent|tenant|sublease/i.test(d.document_name)
  ) || [];

  if (leaseRelated.length === 0) {
    return "I don't have any lease documents with extracted text for this property. Please upload the lease PDF and extract the text first using the Documents tab in CitiSignal.";
  }

  let leaseContent = "";
  for (const doc of leaseRelated) {
    const prop = properties.find((p: any) => p.id === doc.property_id);
    leaseContent += `\n\n===== DOCUMENT: "${doc.document_name}" (${doc.document_type}) — Property: ${prop?.address || "Unknown"} =====\n`;
    leaseContent += doc.extracted_text || "";
    leaseContent += `\n===== END OF "${doc.document_name}" =====\n`;
  }

  const systemPrompt = `You are CitiSignal's Lease Q&A assistant on Telegram. You answer questions about commercial and residential lease agreements. You MUST follow these strict rules:

1. ONLY answer based on the provided lease document content and structured tenant data
2. NEVER provide legal advice — you are a factual reference tool only
3. ALWAYS cite exactly where you found the answer using this format:
   📄 Source: "[Document Name]" — Section X.X / Page Y / Article Z
   If the text doesn't have clear section markers, quote the relevant passage (max 2 sentences) and note approximately where it appears in the document.
4. If the answer is NOT found in any document, say: "I couldn't find this in your uploaded lease documents."
5. Be concise — this is Telegram, max 4000 chars
6. Highlight important dates, dollar amounts, and deadlines in bold
7. For questions about multiple leases, organize the answer by property/unit

STRUCTURED TENANT DATA:
${propertyContext}

LEASE DOCUMENTS:
${leaseContent.slice(0, 120000)}`;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    }),
  });

  if (!aiResponse.ok) {
    if (aiResponse.status === 429) return "⚠️ Rate limit reached. Please try again in a moment.";
    if (aiResponse.status === 402) return "⚠️ AI credits depleted. Contact admin.";
    return "⚠️ Error processing lease question. Please try again.";
  }

  const aiData = await aiResponse.json();
  return aiData.choices?.[0]?.message?.content || "No response generated.";
}

// ─── Damage Photo Handler ───

async function handleDamagePhoto(
  supabase: any, userId: string, photoFileId: string, caption: string,
  properties: any[], TELEGRAM_BOT_TOKEN: string, LOVABLE_API_KEY: string
): Promise<string> {
  // Download photo from Telegram
  const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${photoFileId}`);
  const fileData = await fileRes.json();
  const filePath = fileData.result?.file_path;
  if (!filePath) return "⚠️ Couldn't retrieve the photo. Please try again.";

  const photoUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
  const photoRes = await fetch(photoUrl);
  const photoBuffer = await photoRes.arrayBuffer();
  const photoBytes = new Uint8Array(photoBuffer);

  // Convert to base64 in chunks
  const chunkSize = 8192;
  let binaryString = '';
  for (let i = 0; i < photoBytes.length; i += chunkSize) {
    const chunk = photoBytes.subarray(i, Math.min(i + chunkSize, photoBytes.length));
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64Photo = btoa(binaryString);

  // Identify property
  const matchedProperty = caption
    ? findMentionedProperty(caption, properties)
    : properties.length === 1 ? properties[0] : null;

  const propertyIds = matchedProperty ? [matchedProperty.id] : properties.map((p: any) => p.id);

  // Get lease documents
  const { data: leaseDocs } = await supabase
    .from("property_documents")
    .select("document_name, document_type, extracted_text, property_id")
    .in("property_id", propertyIds)
    .not("extracted_text", "is", null);

  const leaseText = leaseDocs?.map((d: any) => {
    const prop = properties.find((p: any) => p.id === d.property_id);
    return `===== "${d.document_name}" (${prop?.address || "Unknown"}) =====\n${d.extracted_text?.slice(0, 60000) || ""}`;
  }).join("\n\n") || "";

  const systemPrompt = `You are CitiSignal's property damage assessment assistant. A property owner has sent a photo of damage at their building. Your job is to:

1. DESCRIBE what type of damage you see in the photo
2. SEARCH the provided lease document(s) for clauses that assign responsibility for this type of damage/repair
3. CITE the exact section, article, or page where the responsibility is defined
4. If the lease doesn't clearly address this type of damage, say so and suggest which general maintenance/repair clause might apply

FORMAT your response as:

📸 *Damage Identified:* [description]

📄 *Lease Reference:*
Source: "[Document Name]" — [Section/Article/Page]
[Quote the relevant clause, max 2 sentences]

👤 *Responsibility:* [Landlord / Tenant / Shared — based on what the lease says]

⚠️ _This is factual information extracted from your lease document, not legal advice._

${caption ? `The owner's description: "${caption}"` : "No description provided — analyze the photo only."}

LEASE DOCUMENTS:
${leaseText.slice(0, 100000)}`;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: caption || "What type of damage is this and who is responsible according to my lease?" },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Photo}` } },
          ],
        },
      ],
    }),
  });

  if (!aiResponse.ok) return "⚠️ Error analyzing the photo. Please try again.";

  const aiData = await aiResponse.json();
  return aiData.choices?.[0]?.message?.content || "No analysis generated.";
}

// ─── Portfolio Summary (Change 4: expanded) ───

async function getPortfolioSummary(supabase: any, userId: string): Promise<string> {
  const { data: properties } = await supabase.from("properties").select("id, address").eq("user_id", userId);

  if (!properties || properties.length === 0) {
    return "📊 *Portfolio Status*\n\nNo properties found in your account.";
  }

  const propertyIds = properties.map((p: any) => p.id);

  const [violationsRes, workOrdersRes, taxesRes, tenantsRes, openAppsRes, expiringInsRes] = await Promise.all([
    supabase.from("violations").select("id, status, severity, is_stop_work_order, is_vacate_order").in("property_id", propertyIds).eq("status", "open"),
    supabase.from("work_orders").select("id, status").in("property_id", propertyIds).in("status", ["open", "in_progress", "dispatched", "quoted"]),
    supabase.from("property_taxes").select("balance_due").in("property_id", propertyIds).gt("balance_due", 0),
    supabase.from("tenants").select("id, lease_end, status").in("property_id", propertyIds).eq("status", "active"),
    supabase.from("applications").select("id, status").in("property_id", propertyIds),
    supabase.from("tenant_insurance_policies").select("id").in("property_id", propertyIds).lte("expiration_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).gte("expiration_date", new Date().toISOString()),
  ]);

  const violations = violationsRes.data || [];
  const openViolations = violations.length;
  const critical = violations.filter((v: any) => v.severity === "critical" || v.is_stop_work_order || v.is_vacate_order).length;

  const totalTaxDue = (taxesRes.data || []).reduce((sum: number, t: any) => sum + (t.balance_due || 0), 0);

  const tenants = tenantsRes.data || [];
  const activeTenants = tenants.length;
  const expiringIn90Days = tenants.filter((t: any) => {
    if (!t.lease_end) return false;
    const daysLeft = (new Date(t.lease_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft > 0 && daysLeft <= 90;
  }).length;

  // Filter open applications (exclude terminal)
  const TERMINAL = ["signed off", "completed", "withdrawn", "disapproved", "cancelled"];
  const openApps = (openAppsRes.data || []).filter((a: any) => !TERMINAL.some((t: string) => (a.status || "").toLowerCase().includes(t)));

  const expiringInsurance = expiringInsRes.data || [];

  let msg = `📊 *Portfolio Status*\n\n`;
  msg += `🏢 Properties: *${properties.length}*\n`;
  msg += `⚠️ Open Violations: *${openViolations}*`;
  if (critical > 0) msg += ` (🔴 ${critical} critical)`;
  msg += `\n`;
  msg += `📋 Active Work Orders: *${workOrdersRes.data?.length || 0}*\n`;
  msg += `📝 Open Applications: *${openApps.length}*\n`;
  msg += `👥 Active Tenants: *${activeTenants}*`;
  if (expiringIn90Days > 0) msg += ` (⏰ ${expiringIn90Days} lease${expiringIn90Days > 1 ? 's' : ''} expiring in 90 days)`;
  msg += `\n`;
  if (totalTaxDue > 0) msg += `💰 Tax Balance Due: *$${totalTaxDue.toLocaleString()}*\n`;
  if (expiringInsurance.length > 0) {
    msg += `🛡️ Insurance: *${expiringInsurance.length}* polic${expiringInsurance.length > 1 ? 'ies' : 'y'} expiring in 30 days\n`;
  }

  return msg;
}

// ─── Property Context (Change 1: expanded with all data) ───

async function getPropertyContext(supabase: any, userId: string): Promise<{ context: string; properties: any[] }> {
  const { data: properties } = await supabase
    .from("properties")
    .select("id, address, borough, bin, bbl, stories, dwelling_units, year_built, zoning_district, compliance_status, co_status, co_data")
    .eq("user_id", userId);

  if (!properties || properties.length === 0) return { context: "No properties found.", properties: [] };

  let context = "";

  for (const prop of properties) {
    context += `\n--- PROPERTY: ${prop.address} ---\n`;
    context += `Borough: ${prop.borough || "N/A"}, BIN: ${prop.bin || "N/A"}, BBL: ${prop.bbl || "N/A"}\n`;
    context += `Stories: ${prop.stories || "N/A"}, Units: ${prop.dwelling_units || "N/A"}, Built: ${prop.year_built || "N/A"}\n`;
    context += `CO Status: ${prop.co_status || "Unknown"}\n`;
    if (prop.co_data) {
      try {
        const coInfo = typeof prop.co_data === 'string' ? JSON.parse(prop.co_data) : prop.co_data;
        context += `Certificate of Occupancy Data: ${JSON.stringify(coInfo).slice(0, 2000)}\n`;
      } catch { context += `CO Data: ${String(prop.co_data).slice(0, 2000)}\n`; }
    }

    // Open Violations
    const { data: violations } = await supabase
      .from("violations")
      .select("violation_number, agency, status, severity, issued_date, description_raw, hearing_date, penalty_amount, is_stop_work_order, is_vacate_order")
      .eq("property_id", prop.id)
      .eq("status", "open")
      .order("issued_date", { ascending: false })
      .limit(20);

    if (violations && violations.length > 0) {
      context += `Open Violations (${violations.length}):\n`;
      for (const v of violations) {
        context += `  • ${v.agency} #${v.violation_number} (${v.severity || "normal"}) - ${v.description_raw?.slice(0, 80) || "No description"}`;
        if (v.hearing_date) context += ` | Hearing: ${v.hearing_date}`;
        if (v.penalty_amount) context += ` | Penalty: $${v.penalty_amount}`;
        if (v.is_stop_work_order) context += " ⛔ SWO";
        if (v.is_vacate_order) context += " 🚨 VACATE";
        context += "\n";
      }
    } else {
      context += "Open Violations: None\n";
    }

    // Recently Resolved Violations
    const { data: closedViolations } = await supabase
      .from("violations")
      .select("violation_number, agency, status, severity, issued_date, resolved_date, description_raw, penalty_amount")
      .eq("property_id", prop.id)
      .neq("status", "open")
      .order("resolved_date", { ascending: false })
      .limit(15);

    if (closedViolations && closedViolations.length > 0) {
      context += `Recently Resolved Violations (${closedViolations.length}):\n`;
      for (const v of closedViolations) {
        context += `  • ${v.agency} #${v.violation_number} — ${v.status}`;
        if (v.resolved_date) context += ` | Resolved: ${v.resolved_date}`;
        if (v.penalty_amount) context += ` | Penalty: $${v.penalty_amount}`;
        context += ` | ${v.description_raw?.slice(0, 60) || "No description"}`;
        context += "\n";
      }
    }

    // DOB Complaints
    const allViolationData = [...(violations || []), ...(closedViolations || [])];
    const complaints = allViolationData.filter((v: any) => v.violation_number?.startsWith("COMP-"));
    if (complaints.length > 0) {
      context += `DOB Complaints (${complaints.length}):\n`;
      for (const c of complaints) {
        context += `  • ${c.violation_number} — ${c.status} | ${c.description_raw?.slice(0, 100) || "No description"}`;
        if (c.issued_date) context += ` | Filed: ${c.issued_date}`;
        context += "\n";
      }
    }

    // Compliance
    const { data: compliance } = await supabase
      .from("compliance_requirements")
      .select("local_law, requirement_name, status, due_date")
      .eq("property_id", prop.id)
      .in("status", ["pending", "overdue"]);

    if (compliance && compliance.length > 0) {
      context += `Compliance Items:\n`;
      for (const c of compliance) {
        context += `  • ${c.local_law}: ${c.requirement_name} — ${c.status}${c.due_date ? ` (due ${c.due_date})` : ""}\n`;
      }
    }

    // Taxes
    const { data: taxes } = await supabase
      .from("property_taxes")
      .select("tax_year, payment_status, balance_due, protest_status")
      .eq("property_id", prop.id)
      .order("tax_year", { ascending: false })
      .limit(3);

    if (taxes && taxes.length > 0) {
      context += `Recent Taxes:\n`;
      for (const t of taxes) {
        context += `  • ${t.tax_year}: ${t.payment_status}${t.balance_due ? ` ($${t.balance_due} due)` : ""}${t.protest_status ? ` | Protest: ${t.protest_status}` : ""}\n`;
      }
    }

    // Tenants & Leases
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, company_name, unit_number, lease_start, lease_end, lease_type, rent_amount, security_deposit, renewal_option_date, status, contact_name, contact_phone, contact_email, notes")
      .eq("property_id", prop.id)
      .order("unit_number", { ascending: true });

    if (tenants && tenants.length > 0) {
      context += `Tenants (${tenants.length}):\n`;
      for (const t of tenants) {
        context += `  • Unit ${t.unit_number || "N/A"}: ${t.company_name} (${t.status})`;
        if (t.rent_amount) context += ` | Rent: $${t.rent_amount.toLocaleString()}/mo`;
        if (t.lease_start) context += ` | Lease: ${t.lease_start}`;
        if (t.lease_end) context += ` to ${t.lease_end}`;
        if (t.lease_type) context += ` (${t.lease_type})`;
        if (t.renewal_option_date) context += ` | Renewal option: ${t.renewal_option_date}`;
        if (t.contact_name) context += ` | Contact: ${t.contact_name}`;
        if (t.contact_phone) context += ` ${t.contact_phone}`;
        if (t.contact_email) context += ` ${t.contact_email}`;
        if (t.notes) context += ` | Notes: ${t.notes.slice(0, 200)}`;
        context += "\n";
      }
    }

    // Tenant Insurance
    const { data: tenantInsurance } = await supabase
      .from("tenant_insurance_policies")
      .select("tenant_id, policy_type, carrier_name, coverage_amount, effective_date, expiration_date, status, additional_insured, additional_insured_required, policy_number")
      .eq("property_id", prop.id);

    if (tenantInsurance && tenantInsurance.length > 0) {
      context += `Tenant Insurance Policies (${tenantInsurance.length}):\n`;
      for (const ins of tenantInsurance) {
        context += `  • ${ins.policy_type}: ${ins.carrier_name || "Unknown carrier"}`;
        if (ins.coverage_amount) context += ` | Coverage: $${ins.coverage_amount.toLocaleString()}`;
        if (ins.expiration_date) context += ` | Expires: ${ins.expiration_date}`;
        context += ` | Status: ${ins.status}`;
        if (ins.additional_insured_required && !ins.additional_insured) context += " ⚠️ ADDITIONAL INSURED MISSING";
        context += "\n";
      }
    }

    // Applications & Permits
    const { data: applications } = await supabase
      .from("applications")
      .select("application_number, application_type, status, filing_date, approval_date, expiration_date, job_type, work_type, description, estimated_cost, owner_name, tenant_name")
      .eq("property_id", prop.id)
      .order("filing_date", { ascending: false })
      .limit(25);

    if (applications && applications.length > 0) {
      const openApps = applications.filter((a: any) =>
        !["signed off", "completed", "withdrawn"].includes((a.status || "").toLowerCase())
      );
      const closedApps = applications.filter((a: any) =>
        ["signed off", "completed", "withdrawn"].includes((a.status || "").toLowerCase())
      );

      if (openApps.length > 0) {
        context += `Open Applications (${openApps.length}):\n`;
        for (const a of openApps) {
          context += `  • ${a.application_type} #${a.application_number} — ${a.status || "Unknown"}`;
          if (a.job_type) context += ` | Type: ${a.job_type}`;
          if (a.work_type) context += ` (${a.work_type})`;
          if (a.filing_date) context += ` | Filed: ${a.filing_date}`;
          if (a.estimated_cost) context += ` | Est. Cost: $${a.estimated_cost.toLocaleString()}`;
          if (a.description) context += ` | ${a.description.slice(0, 100)}`;
          context += "\n";
        }
      }
      if (closedApps.length > 0) {
        context += `Completed Applications (${closedApps.length}):\n`;
        for (const a of closedApps.slice(0, 10)) {
          context += `  • ${a.application_type} #${a.application_number} — ${a.status}`;
          if (a.approval_date) context += ` | Approved: ${a.approval_date}`;
          if (a.expiration_date) context += ` | Expires: ${a.expiration_date}`;
          context += "\n";
        }
      }
    } else {
      context += "Applications: None on file\n";
    }

    // Work Orders
    const { data: workOrders } = await supabase
      .from("work_orders")
      .select("id, scope, status, priority, due_date, quoted_amount, approved_amount, vendor_id, created_at, completed_at, payment_status, notes, linked_violation_id")
      .eq("property_id", prop.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (workOrders && workOrders.length > 0) {
      context += `Work Orders (${workOrders.length}):\n`;
      for (const wo of workOrders) {
        context += `  • [${wo.status.toUpperCase()}] ${wo.scope.slice(0, 100)}`;
        if (wo.priority !== "normal") context += ` (${wo.priority} priority)`;
        if (wo.quoted_amount) context += ` | Quoted: $${wo.quoted_amount.toLocaleString()}`;
        if (wo.approved_amount) context += ` | Approved: $${wo.approved_amount.toLocaleString()}`;
        if (wo.due_date) context += ` | Due: ${wo.due_date}`;
        if (wo.payment_status) context += ` | Payment: ${wo.payment_status}`;
        if (wo.completed_at) context += ` | Completed: ${wo.completed_at.split("T")[0]}`;
        context += "\n";
      }
    }

    // Purchase Orders
    const { data: purchaseOrders } = await supabase
      .from("purchase_orders")
      .select("po_number, amount, status, scope, created_at, owner_signed_at, vendor_signed_at, vendor_id")
      .eq("property_id", prop.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (purchaseOrders && purchaseOrders.length > 0) {
      context += `Purchase Orders (${purchaseOrders.length}):\n`;
      for (const po of purchaseOrders) {
        context += `  • ${po.po_number}: $${po.amount.toLocaleString()} — ${po.status}`;
        if (po.owner_signed_at) context += ` | Owner signed: ${po.owner_signed_at.split("T")[0]}`;
        if (po.vendor_signed_at) context += ` | Vendor signed: ${po.vendor_signed_at.split("T")[0]}`;
        context += ` | ${po.scope.slice(0, 80)}`;
        context += "\n";
      }
    }

    // All Documents (metadata + extracted text)
    const { data: allDocs } = await supabase
      .from("property_documents")
      .select("id, document_name, document_type, extracted_text, expiration_date, created_at")
      .eq("property_id", prop.id)
      .order("created_at", { ascending: false });

    if (allDocs && allDocs.length > 0) {
      context += `Documents on File (${allDocs.length}):\n`;
      for (const d of allDocs) {
        context += `  • ${d.document_name} (${d.document_type})`;
        if (d.expiration_date) context += ` | Expires: ${d.expiration_date}`;
        context += ` | Uploaded: ${d.created_at.split("T")[0]}`;
        context += d.extracted_text ? " ✅ Text extracted" : " ⚠️ No text extracted";
        context += "\n";
        if (d.extracted_text) {
          const maxPerDoc = 40000;
          const excerpt = d.extracted_text.slice(0, maxPerDoc);
          context += `    Content: ${excerpt}${d.extracted_text.length > maxPerDoc ? "...(truncated)" : ""}\n`;
        }
      }
    } else {
      context += "Documents: None uploaded\n";
    }

    // Recent Changes (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentChanges } = await supabase
      .from("change_log")
      .select("change_type, entity_type, description, created_at")
      .eq("property_id", prop.id)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(15);

    if (recentChanges && recentChanges.length > 0) {
      context += `Recent Activity (last 7 days):\n`;
      for (const ch of recentChanges) {
        context += `  • ${ch.created_at.split("T")[0]}: ${ch.change_type} ${ch.entity_type} — ${ch.description?.slice(0, 100) || ""}\n`;
      }
    }
  }

  // Vendor Directory (user-level, outside property loop)
  const { data: vendors } = await supabase
    .from("vendors")
    .select("name, trade_type, phone_number, email, status, avg_rating, license_number, coi_expiration_date")
    .eq("user_id", userId)
    .eq("status", "active");

  if (vendors && vendors.length > 0) {
    context += `\n--- VENDOR DIRECTORY ---\n`;
    for (const v of vendors) {
      context += `  • ${v.name} (${v.trade_type || "General"})`;
      if (v.phone_number) context += ` | ${v.phone_number}`;
      if (v.email) context += ` | ${v.email}`;
      if (v.avg_rating) context += ` | Rating: ${v.avg_rating}/5`;
      if (v.license_number) context += ` | Lic: ${v.license_number}`;
      if (v.coi_expiration_date) context += ` | COI expires: ${v.coi_expiration_date}`;
      context += "\n";
    }
  }

  return { context, properties };
}

// ─── Property Matching ───

function findMentionedProperty(text: string, properties: any[]): any | null {
  if (!properties || properties.length === 0) return null;
  const lowerText = text.toLowerCase();
  
  for (const prop of properties) {
    const addr = prop.address.toLowerCase();
    const parts = addr.split(/\s+/);
    const streetNumber = parts[0];
    
    if (streetNumber && parts[1] && lowerText.includes(streetNumber) && lowerText.includes(parts[1].toLowerCase().replace(",", ""))) {
      return prop;
    }
  }
  
  if (properties.length === 1) return properties[0];
  return null;
}

// ─── Chat Logging ───

async function logToPropertyChat(supabase: any, userId: string, propertyId: string, userMsg: string, aiMsg: string) {
  let { data: conversation } = await supabase
    .from("property_ai_conversations")
    .select("id")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    const { data: newConv, error } = await supabase
      .from("property_ai_conversations")
      .insert({ property_id: propertyId, user_id: userId })
      .select("id")
      .single();
    if (error) throw error;
    conversation = newConv;
  }

  await supabase.from("property_ai_messages").insert([
    { conversation_id: conversation.id, role: "user", content: userMsg },
    { conversation_id: conversation.id, role: "assistant", content: aiMsg },
  ]);

  await supabase
    .from("property_ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversation.id);
}
