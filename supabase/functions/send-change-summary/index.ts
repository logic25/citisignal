import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function buildChangeSummaryHtml(data: {
  userName: string;
  properties: Array<{
    address: string;
    changes: Array<{
      entity_type: string;
      change_type: string;
      entity_label: string;
      description: string;
      previous_value: string | null;
      new_value: string | null;
      created_at: string;
    }>;
  }>;
  totalChanges: number;
  appUrl: string;
  date: string;
}): string {
  const { userName, properties, totalChanges, appUrl, date } = data;

  // 6a: Detect critical changes and count categories
  const CRITICAL_KEYWORDS_SUMMARY = ['stop work', 'swo', 'vacate', 'cease', 'imminent danger'];
  const criticalChanges: Array<{ entity_label: string; description: string; address: string }> = [];
  let newCount = 0;
  let changedCount = 0;

  for (const prop of properties) {
    for (const c of prop.changes) {
      const desc = (c.description || '').toLowerCase();
      if (CRITICAL_KEYWORDS_SUMMARY.some(k => desc.includes(k))) {
        criticalChanges.push({ entity_label: c.entity_label, description: c.description, address: prop.address });
      }
      if (c.change_type === 'new') newCount++;
      else changedCount++;
    }
  }

  const propertyBlocks = properties.map(prop => {
    const changeRows = prop.changes.map(c => {
      const icon = c.entity_type === 'violation' ? '⚠️' : '📋';
      const typeBg = c.change_type === 'new' ? '#dcfce7' : '#fef3c7';
      const typeColor = c.change_type === 'new' ? '#166534' : '#92400e';
      const typeLabel = c.change_type === 'new' ? 'NEW' : 'CHANGED';

      return `
        <div style="border-bottom:1px solid #f1f5f9;padding:12px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;">${icon}</td>
            <td>
              <div style="margin-bottom:4px;">
                <span style="font-weight:600;color:#1e293b;font-size:13px;">${c.entity_label}</span>
                <span style="background:${typeBg};color:${typeColor};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;margin-left:8px;text-transform:uppercase;">${typeLabel}</span>
              </div>
              <p style="color:#64748b;font-size:12px;margin:0;line-height:1.4;">${c.description}</p>
              ${c.change_type === 'status_change' ? `<p style="color:#94a3b8;font-size:11px;margin:4px 0 0;"><strong>${c.previous_value}</strong> → <strong style="color:#0f172a;">${c.new_value}</strong></p>` : ''}
              <p style="color:#cbd5e1;font-size:10px;margin:4px 0 0;">${formatDate(c.created_at)}</p>
            </td>
          </tr></table>
        </div>
      `;
    }).join("");

    return `
      <div style="background:#ffffff;border-radius:12px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0;">
        <h3 style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 12px;">🏢 ${prop.address}</h3>
        ${changeRows}
      </div>
    `;
  }).join("");

  // 6b: SWO banner
  const swoBanner = criticalChanges.length > 0 ? criticalChanges.map(c => `
    <div style="background:#dc2626;padding:14px 24px;border:1px solid #b91c1c;border-top:0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;width:32px;">
          <div style="background:rgba(255,255,255,0.2);border-radius:8px;width:32px;height:32px;text-align:center;line-height:32px;font-size:16px;color:#fff;font-weight:900;">!</div>
        </td>
        <td style="padding-left:12px;vertical-align:middle;">
          <p style="color:#ffffff;font-size:14px;font-weight:800;margin:0;text-transform:uppercase;letter-spacing:0.5px;">${c.description.toLowerCase().includes('vacate') ? 'Vacate Order Issued' : 'Stop Work Order Issued'}</p>
          <p style="color:#fecaca;font-size:12px;margin:2px 0 0;line-height:1.4;">
            <strong>${c.entity_label}</strong> at <strong>${c.address}</strong> — All construction must cease immediately.
          </p>
        </td>
        <td style="width:120px;text-align:right;vertical-align:middle;">
          <a href="${appUrl}/dashboard" style="display:inline-block;background:#ffffff;color:#dc2626;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap;">View →</a>
        </td>
      </tr></table>
    </div>`).join('') : '';

  // 6c: Stats bar
  const statsBar = `
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${criticalChanges.length > 0 ? `<td style="text-align:center;padding:8px;">
        <div style="font-size:24px;font-weight:800;color:#dc2626;">${criticalChanges.length}</div>
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Critical</div>
      </td>` : ''}
      <td style="text-align:center;padding:8px;">
        <div style="font-size:24px;font-weight:800;color:#22c55e;">${newCount}</div>
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">New</div>
      </td>
      <td style="text-align:center;padding:8px;">
        <div style="font-size:24px;font-weight:800;color:#f59e0b;">${changedCount}</div>
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Changed</div>
      </td>
      <td style="text-align:center;padding:8px;">
        <div style="font-size:24px;font-weight:800;color:#0f172a;">${totalChanges}</div>
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Total</div>
      </td>
    </tr></table>`;

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
        <td style="background:#334155;border-radius:10px;padding:8px;vertical-align:middle;width:40px;height:40px;text-align:center;">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNC45IDE5LjFDMSAxNS4yIDEgOC44IDQuOSA0LjkiPjwvcGF0aD48cGF0aCBkPSJNNy44IDE2LjJjLTIuMy0yLjMtMi4zLTYuMSAwLTguNSI+PC9wYXRoPjxwYXRoIGQ9Ik0xNi4yIDcuOGMyLjMgMi4zIDIuMyA2LjEgMCA4LjUiPjwvcGF0aD48cGF0aCBkPSJNMTkuMSA0LjljMy45IDMuOSAzLjkgMTAuMiAwIDE0LjEiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIyIj48L2NpcmNsZT48L3N2Zz4K" alt="CitiSignal" style="width:24px;height:24px;display:block;margin:0 auto;" />
        </td>
        <td style="padding-left:12px;vertical-align:middle;"><span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">CitiSignal</span></td>
      </tr></table>
      <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Daily Change Summary</div>
      <div style="color:#64748b;font-size:12px;margin-top:4px;">${date}</div>
    </div>

    ${swoBanner}

    <div style="background:#ffffff;padding:20px 32px;text-align:center;border-bottom:1px solid #e2e8f0;">
      ${statsBar}
    </div>

    <div style="background:#ffffff;padding:20px 32px 12px;border-bottom:1px solid #f1f5f9;">
      <p style="color:#1e293b;font-size:15px;margin:0;">Hi ${userName || "there"},</p>
      <p style="color:#64748b;font-size:13px;margin:6px 0 0;">Here's what changed across your properties since the last sync.</p>
    </div>

    <div style="background:#f1f5f9;padding:24px 20px;">
      ${propertyBlocks}
    </div>

    <div style="background:#ffffff;padding:24px 32px;text-align:center;border-top:1px solid #e2e8f0;">
      <a href="${appUrl}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#0f172a,#334155);color:#ffffff;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:13px;">
        Review Changes →
      </a>
    </div>

    <div style="background:linear-gradient(135deg,#fef3c7,#fff7ed);padding:28px 32px;text-align:center;border-top:1px solid #fde68a;">
      <p style="color:#92400e;font-size:16px;font-weight:700;margin:0 0 8px;">Need help with compliance?</p>
      <p style="color:#78350f;font-size:13px;margin:0 0 16px;line-height:1.5;">
        Green Light Expediting LLC specializes in NYC DOB violations, permits, and code compliance.
      </p>
      <a href="mailto:info@greenlightexpediting.com?subject=Compliance%20Help" style="display:inline-block;background:#ea580c;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
        ✉️ Contact Green Light Expediting
      </a>
      <p style="color:#b45309;font-size:11px;margin:12px 0 0;">
        Green Light Expediting LLC · <a href="https://www.greenlightexpediting.com" style="color:#b45309;text-decoration:underline;">www.greenlightexpediting.com</a>
      </p>
    </div>

    <div style="padding:20px 32px;text-align:center;border-radius:0 0 16px 16px;background:#fff;border-top:1px solid #f1f5f9;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">
        <a href="${appUrl}/dashboard/settings" style="color:#64748b;text-decoration:underline;">Manage preferences</a> · <a href="${appUrl}/dashboard/settings" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
      </p>
      <p style="color:#cbd5e1;font-size:10px;margin:8px 0 0;">© ${new Date().getFullYear()} CitiSignal</p>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase env");
    if (!resendApiKey) throw new Error("Missing RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all un-notified changes grouped by user
    const { data: changes, error: changeError } = await supabase
      .from("change_log")
      .select("*")
      .eq("notified", false)
      .order("created_at", { ascending: false })
      .limit(500);

    if (changeError) throw changeError;
    if (!changes || changes.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No changes to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by user_id
    const byUser = new Map<string, any[]>();
    for (const c of changes) {
      if (!byUser.has(c.user_id)) byUser.set(c.user_id, []);
      byUser.get(c.user_id)!.push(c);
    }

    let emailsSent = 0;
    const changeIds: string[] = [];

    for (const [userId, userChanges] of byUser) {
      try {
        // Check user preferences
        const { data: prefs } = await supabase.from("email_preferences").select("*").eq("user_id", userId).single();
        
        // Check individual notification flags
        const notifyViolations = prefs?.notify_new_violations ?? true;
        const notifyStatusChanges = prefs?.notify_status_changes ?? true;
        const notifyApplications = prefs?.notify_new_applications ?? true;
        
        // If ALL relevant preferences are false, skip entirely
        if (!notifyViolations && !notifyStatusChanges && !notifyApplications) {
          console.log(`Skipping digest for user ${userId} — all notifications disabled`);
          continue;
        }
        
        // Filter changes based on preferences
        const filteredChanges = userChanges.filter(c => {
          if (c.entity_type === 'violation' && c.change_type === 'new' && !notifyViolations) return false;
          if (c.entity_type === 'violation' && c.change_type === 'status_change' && !notifyStatusChanges) return false;
          if (c.entity_type === 'application' && !notifyApplications) return false;
          return true;
        });
        
        if (filteredChanges.length === 0) {
          console.log(`Skipping digest for user ${userId} — no changes match preferences`);
          // Still mark as notified
          changeIds.push(...userChanges.map(c => c.id));
          continue;
        }

        // Get user info
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        if (!user?.email) continue;

        const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", userId).single();

        // Get property addresses
        const propertyIds = [...new Set(userChanges.map(c => c.property_id))];
        const { data: propData } = await supabase.from("properties").select("id, address").in("id", propertyIds);
        const propMap = new Map((propData || []).map(p => [p.id, p.address]));

        // Group filtered changes by property
        const byProperty = new Map<string, any[]>();
        for (const c of filteredChanges) {
          const addr = propMap.get(c.property_id) || "Unknown";
          if (!byProperty.has(addr)) byProperty.set(addr, []);
          byProperty.get(addr)!.push(c);
        }

        const propertyData = Array.from(byProperty.entries()).map(([address, changes]) => ({
          address,
          changes: changes.map(c => ({
            entity_type: c.entity_type,
            change_type: c.change_type,
            entity_label: c.entity_label,
            description: c.description,
            previous_value: c.previous_value,
            new_value: c.new_value,
            created_at: c.created_at,
          })),
        }));

        const appUrl = Deno.env.get("APP_URL") || "https://app.citisignal.com";
        const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

        const html = buildChangeSummaryHtml({
          userName: profile?.display_name || "",
          properties: propertyData,
          totalChanges: filteredChanges.length,
          appUrl,
          date,
        });

        // Send email
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            from: Deno.env.get("RESEND_FROM_ADDRESS") || "CitiSignal <notifications@citisignal.com>",
            to: [user.email],
            subject: `🔄 ${filteredChanges.length} changes detected — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            html,
          }),
        });

        if (resendRes.ok) {
          emailsSent++;
          changeIds.push(...userChanges.map(c => c.id));

          await supabase.from("email_log").insert({
            user_id: userId,
            email_type: "change_summary",
            subject: `${filteredChanges.length} changes detected`,
            recipient_email: user.email,
            metadata: { total_changes: userChanges.length, properties_count: propertyIds.length },
          });
        } else {
          const err = await resendRes.json();
          console.error("Resend error:", err);
        }

        // Send Telegram alerts if user opted in
        try {
          const { data: telegramPrefs } = await supabase
            .from("email_preferences")
            .select("telegram_new_violations, telegram_status_changes, telegram_critical_alerts, telegram_daily_summary")
            .eq("user_id", userId)
            .single();

          const { data: telegramUser } = await supabase
            .from("telegram_users")
            .select("chat_id, is_active")
            .eq("user_id", userId)
            .eq("is_active", true)
            .single();

          if (telegramUser && telegramPrefs) {
            let telegramMsg = "";
            let shouldSend = false;

            // Critical alerts
            const criticalChanges = filteredChanges.filter((c: any) =>
              c.description?.toLowerCase().includes("stop work") ||
              c.description?.toLowerCase().includes("vacate") ||
              c.description?.toLowerCase().includes("swo")
            );
            if (criticalChanges.length > 0 && telegramPrefs.telegram_critical_alerts) {
              telegramMsg += `🚨 *CRITICAL ALERT*\n`;
              for (const c of criticalChanges) {
                telegramMsg += `⛔ ${c.entity_label}\n${c.description?.slice(0, 120)}\n\n`;
              }
              shouldSend = true;
            }

            // New violations
            const newViolations = filteredChanges.filter((c: any) => c.entity_type === 'violation' && c.change_type === 'new');
            if (newViolations.length > 0 && telegramPrefs.telegram_new_violations) {
              telegramMsg += `⚠️ *${newViolations.length} New Violation${newViolations.length > 1 ? "s" : ""}*\n`;
              for (const v of newViolations.slice(0, 5)) {
                telegramMsg += `• ${v.entity_label} — ${v.description?.slice(0, 80)}\n`;
              }
              if (newViolations.length > 5) telegramMsg += `_...and ${newViolations.length - 5} more_\n`;
              telegramMsg += "\n";
              shouldSend = true;
            }

            // Status changes
            const statusChanges = filteredChanges.filter((c: any) => c.change_type === 'status_change');
            if (statusChanges.length > 0 && telegramPrefs.telegram_status_changes) {
              telegramMsg += `🔄 *${statusChanges.length} Status Change${statusChanges.length > 1 ? "s" : ""}*\n`;
              for (const s of statusChanges.slice(0, 5)) {
                telegramMsg += `• ${s.entity_label}: ${s.previous_value} → *${s.new_value}*\n`;
              }
              if (statusChanges.length > 5) telegramMsg += `_...and ${statusChanges.length - 5} more_\n`;
              telegramMsg += "\n";
              shouldSend = true;
            }

            // Daily summary fallback
            if (telegramPrefs.telegram_daily_summary && !shouldSend) {
              telegramMsg = `📡 *Daily Summary*\n${filteredChanges.length} changes detected across your properties.\nUse /status for details.`;
              shouldSend = true;
            }

            if (shouldSend && telegramMsg) {
              await supabase.functions.invoke("send-telegram", {
                body: { user_id: userId, message: telegramMsg.slice(0, 4000), parse_mode: "Markdown" },
              });
              console.log("Sent Telegram alert to user:", userId);
            }
          }
        } catch (telegramErr) {
          console.error("Error sending Telegram alert:", telegramErr);
        }
      } catch (e) {
        console.error(`Error sending summary to user ${userId}:`, e);
      }
    }

    // Mark changes as notified
    if (changeIds.length > 0) {
      await supabase.from("change_log").update({ notified: true }).in("id", changeIds);
    }

    return new Response(
      JSON.stringify({ success: true, emails_sent: emailsSent, changes_notified: changeIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Change summary error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
