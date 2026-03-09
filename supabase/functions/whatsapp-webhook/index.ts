/**
 * whatsapp-webhook — Inbound WhatsApp Message Handler (via Twilio)
 * 
 * STATUS: DISABLED (2026-03-02)
 * 
 * This function handles inbound WhatsApp messages routed through Twilio's
 * WhatsApp Business API. It supports:
 * - Account linking (LINK <code>)
 * - AI-powered property queries (Gemini Flash-Lite)
 * - Vendor quote extraction and work order updates
 * - Portfolio status summaries
 * 
 * TO RE-ENABLE:
 * 1. Ensure Twilio WhatsApp sandbox or production number is configured.
 * 2. Add Twilio request signature validation (CRITICAL — without this,
 *    anyone can POST fake messages and manipulate work order data).
 * 3. Replace Base64 link codes with cryptographic tokens (the current
 *    btoa(userId) approach exposes internal UUIDs).
 * 4. Implement email confirmation code flow for PO signing (see
 *    telegram-webhook/index.ts for the reference implementation using
 *    the pending_po_confirmations table). Use channel='whatsapp' and
 *    chat_id=phoneNumber.
 * 5. Remove the early-return below.
 * 6. Set the Twilio WhatsApp webhook URL to this function's endpoint.
 * 
 * REQUIRED SECRETS:
 * - TWILIO_AUTH_TOKEN (for signature validation)
 * - RESEND_API_KEY (for PO confirmation emails)
 * - LOVABLE_API_KEY (for AI responses)
 * 
 * TABLES USED:
 * - whatsapp_users (account linking)
 * - vendors / work_orders / work_order_messages (vendor quote flow)
 * - pending_po_confirmations (email 2FA for PO signing)
 * - properties / violations / compliance_requirements (AI context)
 * - property_ai_conversations / property_ai_messages (chat logging)
 * - notifications (owner alerts on vendor quotes)
 * 
 * SEE ALSO:
 * - src/components/settings/WhatsAppTab.tsx (UI for linking)
 * - supabase/functions/telegram-webhook/ (reference implementation)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

async function parseFormData(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── DISABLED: WhatsApp processing is temporarily turned off ──
  console.log("whatsapp-webhook called but is currently DISABLED");
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>',
    { headers: { "Content-Type": "application/xml" } }
  );

  /* ── ORIGINAL IMPLEMENTATION ──
  
  See git history for the full implementation including:
  - handleLinkCommand() — account linking via Base64 codes
  - handleVendorMessage() — vendor detection, quote extraction, WO updates
  - getPortfolioSummary() — STATUS command handler
  - getPropertyContext() — builds AI context from user's properties
  - AI query flow using Gemini Flash-Lite
  - twimlResponse() — XML response builder for Twilio
  
  console.log("WhatsApp Webhook received");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Twilio sends WhatsApp messages as form-encoded data
    const formData = await parseFormData(req);
    const from = formData.From; // e.g. "whatsapp:+15551234567"
    const to = formData.To;
    const body = formData.Body;
    const messageSid = formData.MessageSid;
    const profileName = formData.ProfileName; // WhatsApp display name

    console.log(`Inbound WhatsApp from ${from}: ${body}`);

    if (!from || !body) {
      return twimlResponse("");
    }

    // Extract raw phone number from "whatsapp:+15551234567" format
    const rawPhone = from.replace("whatsapp:", "").replace(/\D/g, "");
    const normalizedPhone = rawPhone.slice(-10);

    // ── LINK COMMAND ──
    // User sends "LINK <code>" to connect their CitiSignal account
    const linkMatch = body.trim().match(/^LINK\s+(.+)$/i);
    if (linkMatch) {
      return await handleLinkCommand(supabase, linkMatch[1].trim(), rawPhone, profileName || "WhatsApp User");
    }

    // ── UNLINK COMMAND ──
    if (body.trim().toUpperCase() === "UNLINK") {
      await supabase
        .from("whatsapp_users")
        .update({ is_active: false })
        .eq("phone_number", rawPhone);
      return twimlResponse("✅ Account unlinked. You'll no longer receive alerts via WhatsApp.");
    }

    // ── HELP COMMAND ──
    if (body.trim().toUpperCase() === "HELP") {
      return twimlResponse(
        "📋 *CitiSignal WhatsApp Bot*\n\n" +
        "• Just type a question about your properties\n" +
        "• \"Violations at 123 Main St\"\n" +
        "• \"Compliance status\"\n" +
        "• \"Upcoming hearings\"\n\n" +
        "Commands:\n" +
        "STATUS - Portfolio overview\n" +
        "UNLINK - Disconnect account\n" +
        "HELP - Show this message"
      );
    }

    // ── LINKED USER LOOKUP (check first to prioritize user over vendor) ──
    const { data: waUser } = await supabase
      .from("whatsapp_users")
      .select("user_id, is_active")
      .eq("phone_number", rawPhone)
      .eq("is_active", true)
      .maybeSingle();

    // ── VENDOR DETECTION (only if NOT a linked user) ──
    if (!waUser) {
      const { data: vendorMatch } = await supabase
        .from("vendors")
        .select("id, name, phone_number")
        .not("phone_number", "is", null)
        .limit(100);

      const matchedVendor = (vendorMatch || []).find((v: any) => {
        const vPhone = (v.phone_number || "").replace(/\D/g, "").slice(-10);
        return vPhone === normalizedPhone && vPhone.length === 10;
      });

      if (matchedVendor) {
        console.log(`Vendor detected: ${matchedVendor.name} (${matchedVendor.id})`);
        return await handleVendorMessage(supabase, matchedVendor, body, messageSid, lovableApiKey);
      }
    }

    if (!waUser) {
      return twimlResponse(
        "👋 Welcome to CitiSignal!\n\n" +
        "To get started, link your account from Settings > WhatsApp in the CitiSignal dashboard.\n\n" +
        "Once linked, you can query violations, compliance status, and more — all from WhatsApp."
      );
    }

    const userId = waUser.user_id;

    // ── STATUS COMMAND ──
    if (body.trim().toUpperCase() === "STATUS") {
      const summary = await getPortfolioSummary(supabase, userId);
      return twimlResponse(summary);
    }

    // ── AI-POWERED QUERY ──
    const { context: propertyContext, properties: userProperties } = await getPropertyContext(supabase, userId);

    const systemPrompt = `You are CitiSignal Bot, a WhatsApp assistant for NYC property owners.
You have access to the user's property portfolio data below. Answer questions concisely for WhatsApp (max 1500 chars).
Be professional but friendly. Use simple formatting (no markdown bold, use CAPS for emphasis).

PORTFOLIO DATA:
${propertyContext}

RULES:
- Be brief and direct — this is WhatsApp, not a report
- Reference specific violation numbers, dates, amounts
- For compliance questions, check both violations AND compliance_requirements
- For tax questions, check property_taxes data
- For lease questions, check the Documents section
- Always mention the property address when referencing data`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: body },
        ],
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI error:", aiResponse.status);
      return twimlResponse("⚠️ Error processing your request. Please try again.");
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content ||
      "I'm having trouble processing your request. Please try again.";

    // WhatsApp max is 4096 chars but we keep it shorter for readability
    const truncatedReply = reply.length > 1500 ? reply.slice(0, 1500) + "\n\n...truncated" : reply;

    // Log conversation to property activity
    try {
      const matchedProperty = findMentionedProperty(body, userProperties);
      if (matchedProperty) {
        await logToPropertyChat(supabase, userId, matchedProperty.id,
          `[via WhatsApp] ${body}`, `[via WhatsApp] ${truncatedReply}`);
      }
    } catch (logErr) {
      console.error("Error logging to property chat:", logErr);
    }

    return twimlResponse(truncatedReply);
  } catch (error) {
    console.error("WhatsApp Webhook error:", error);
    return twimlResponse("Sorry, there was an error processing your message. Please try again later.");
  }
  */
});

// ── LINK COMMAND HANDLER (uses secure tokens from pending_account_links) ──
async function handleLinkCommand(supabase: any, token: string, phone: string, displayName: string) {
  try {
    // Look up the secure token
    const { data: linkRecord, error: linkErr } = await supabase
      .from("pending_account_links")
      .select("id, user_id, expires_at, used")
      .eq("token", token)
      .eq("channel", "whatsapp")
      .eq("used", false)
      .maybeSingle();

    if (!linkRecord || linkErr) {
      return twimlResponse("❌ Invalid or expired link code. Please generate a new one from Settings > WhatsApp in CitiSignal.");
    }

    if (new Date(linkRecord.expires_at) < new Date()) {
      return twimlResponse("❌ This link has expired. Please generate a new one from Settings > WhatsApp in CitiSignal.");
    }

    // Mark token as used
    await supabase.from("pending_account_links").update({ used: true }).eq("id", linkRecord.id);

    const { error } = await supabase
      .from("whatsapp_users")
      .upsert(
        {
          user_id: linkRecord.user_id,
          phone_number: phone,
          display_name: displayName,
          is_active: true,
          linked_at: new Date().toISOString(),
        },
        { onConflict: "phone_number" }
      );

    if (error) {
      console.error("Error linking WhatsApp user:", error);
      return twimlResponse("❌ Failed to link account. Please try again.");
    }

    return twimlResponse(
      `✅ Account linked!\n\n` +
      `Welcome to CitiSignal, ${displayName}! You can now:\n\n` +
      `• Ask about your properties and violations\n` +
      `• Get compliance status updates\n` +
      `• Query hearings and deadlines\n\n` +
      `Try: "Show violations for 123 Main St"\n\n` +
      `Type HELP for all commands.`
    );
  } catch {
    return twimlResponse("❌ Invalid link code. Please generate a new one from Settings > WhatsApp in CitiSignal.");
  }
}

// ── VENDOR MESSAGE HANDLER ──
async function handleVendorMessage(
  supabase: any,
  vendor: { id: string; name: string },
  body: string,
  messageSid: string | undefined,
  lovableApiKey: string
) {
  const { data: openWOs } = await supabase
    .from("work_orders")
    .select("id, scope, status, property_id")
    .eq("vendor_id", vendor.id)
    .in("status", ["open", "dispatched"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (!openWOs || openWOs.length === 0) {
    return twimlResponse(`Thanks ${vendor.name}. We don't have an open work order for you right now. Your message has been noted.`);
  }

  // Extract dollar amount
  const amountMatch = body.match(/\$?([\d,]+(?:\.\d{1,2})?)/);
  const extractedAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : null;

  const targetWO = openWOs[0];

  // Log message
  await supabase.from("work_order_messages").insert({
    work_order_id: targetWO.id,
    sender_type: "vendor",
    sender_name: vendor.name,
    channel: "whatsapp",
    message: body,
    extracted_amount: extractedAmount && extractedAmount > 0 ? extractedAmount : null,
  });

  if (extractedAmount && extractedAmount > 0) {
    await supabase.from("work_orders").update({
      quoted_amount: extractedAmount,
      status: "quoted",
    }).eq("id", targetWO.id);

    const { data: prop } = await supabase
      .from("properties")
      .select("address, user_id")
      .eq("id", targetWO.property_id)
      .single();

    if (prop?.user_id) {
      await supabase.from("notifications").insert({
        user_id: prop.user_id,
        title: `Quote Received: $${extractedAmount.toLocaleString()}`,
        message: `${vendor.name} quoted $${extractedAmount.toLocaleString()} via WhatsApp for work at ${prop.address || "your property"}.`,
        priority: "high",
        category: "work_orders",
        property_id: targetWO.property_id,
        entity_type: "work_order",
        entity_id: targetWO.id,
      });
    }

    return twimlResponse(`Got it! Your quote of $${extractedAmount.toLocaleString()} for "${targetWO.scope.substring(0, 60)}" has been recorded. The owner will review and get back to you.`);
  }

  return twimlResponse(`Thanks ${vendor.name}, your message has been noted for work order: "${targetWO.scope.substring(0, 80)}".`);
}

// ── PORTFOLIO SUMMARY ──
async function getPortfolioSummary(supabase: any, userId: string): Promise<string> {
  const { data: properties } = await supabase
    .from("properties")
    .select("id, address")
    .eq("user_id", userId);

  if (!properties || properties.length === 0) {
    return "📊 Portfolio Status\n\nNo properties found in your account.";
  }

  const propertyIds = properties.map((p: any) => p.id);

  const [{ data: violations }, { data: workOrders }, { data: taxes }] = await Promise.all([
    supabase.from("violations").select("id, severity, is_stop_work_order, is_vacate_order")
      .in("property_id", propertyIds).eq("status", "open"),
    supabase.from("work_orders").select("id, status")
      .in("property_id", propertyIds).in("status", ["open", "in_progress"]),
    supabase.from("property_taxes").select("balance_due")
      .in("property_id", propertyIds).gt("balance_due", 0),
  ]);

  const openViolations = violations?.length || 0;
  const critical = violations?.filter(
    (v: any) => v.severity === "critical" || v.is_stop_work_order || v.is_vacate_order
  ).length || 0;
  const totalTaxDue = taxes?.reduce((sum: number, t: any) => sum + (t.balance_due || 0), 0) || 0;

  let msg = `📊 Portfolio Status\n\n`;
  msg += `🏢 Properties: ${properties.length}\n`;
  msg += `⚠️ Open Violations: ${openViolations}`;
  if (critical > 0) msg += ` (🔴 ${critical} critical)`;
  msg += `\n`;
  msg += `📋 Active Work Orders: ${workOrders?.length || 0}\n`;
  if (totalTaxDue > 0) msg += `💰 Tax Balance Due: $${totalTaxDue.toLocaleString()}\n`;

  return msg;
}

// ── PROPERTY CONTEXT (mirrors telegram-webhook) ──
async function getPropertyContext(supabase: any, userId: string): Promise<{ context: string; properties: any[] }> {
  const { data: properties } = await supabase
    .from("properties")
    .select("id, address, borough, bin, bbl, stories, dwelling_units, year_built, zoning_district, compliance_status, co_status")
    .eq("user_id", userId);

  if (!properties || properties.length === 0) return { context: "No properties found.", properties: [] };

  let context = "";

  for (const prop of properties) {
    context += `\n--- PROPERTY: ${prop.address} ---\n`;
    context += `Borough: ${prop.borough || "N/A"}, BIN: ${prop.bin || "N/A"}, BBL: ${prop.bbl || "N/A"}\n`;
    context += `Stories: ${prop.stories || "N/A"}, Units: ${prop.dwelling_units || "N/A"}, Built: ${prop.year_built || "N/A"}\n`;

    const { data: violations } = await supabase
      .from("violations")
      .select("violation_number, agency, status, severity, issued_date, description_raw, hearing_date, penalty_amount")
      .eq("property_id", prop.id)
      .eq("status", "open")
      .order("issued_date", { ascending: false })
      .limit(15);

    if (violations && violations.length > 0) {
      context += `Open Violations (${violations.length}):\n`;
      for (const v of violations) {
        context += `  • ${v.agency} #${v.violation_number} (${v.severity || "normal"}) - ${v.description_raw?.slice(0, 80) || "No description"}`;
        if (v.hearing_date) context += ` | Hearing: ${v.hearing_date}`;
        if (v.penalty_amount) context += ` | $${v.penalty_amount}`;
        context += "\n";
      }
    } else {
      context += "Open Violations: None\n";
    }

    const { data: compliance } = await supabase
      .from("compliance_requirements")
      .select("local_law, requirement_name, status, due_date")
      .eq("property_id", prop.id)
      .in("status", ["pending", "overdue"]);

    if (compliance && compliance.length > 0) {
      context += `Compliance:\n`;
      for (const c of compliance) {
        context += `  • ${c.local_law}: ${c.requirement_name} — ${c.status}${c.due_date ? ` (due ${c.due_date})` : ""}\n`;
      }
    }

    const { data: taxes } = await supabase
      .from("property_taxes")
      .select("tax_year, payment_status, balance_due")
      .eq("property_id", prop.id)
      .order("tax_year", { ascending: false })
      .limit(2);

    if (taxes && taxes.length > 0) {
      context += `Taxes:\n`;
      for (const t of taxes) {
        context += `  • ${t.tax_year}: ${t.payment_status}${t.balance_due ? ` ($${t.balance_due} due)` : ""}\n`;
      }
    }
  }

  // Keep context manageable for WhatsApp (shorter than Telegram due to response length constraints)
  if (context.length > 20000) {
    context = context.slice(0, 20000) + "\n...(context truncated)";
  }

  return { context, properties };
}

// ── HELPERS ──
function findMentionedProperty(text: string, properties: any[]): any | null {
  if (!properties || properties.length === 0) return null;
  const lowerText = text.toLowerCase();

  for (const prop of properties) {
    const addr = prop.address.toLowerCase();
    const parts = addr.split(/\s+/);
    const streetNumber = parts[0];
    if (streetNumber && parts[1] && lowerText.includes(streetNumber) && lowerText.includes(parts[1].replace(",", ""))) {
      return prop;
    }
  }

  if (properties.length === 1) return properties[0];
  return null;
}

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

function twimlResponse(message: string) {
  if (!message) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>',
      { headers: { "Content-Type": "application/xml" } }
    );
  }

  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Message>${escaped}</Message>\n</Response>`,
    { headers: { "Content-Type": "application/xml" } }
  );
}
