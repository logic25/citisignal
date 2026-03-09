import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { emailHeader, emailBody, emailFooter } from "../_shared/email-template.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { vendor_email, vendor_name, property_address, scope_of_work, work_order_id } = await req.json();

    if (!vendor_email || !scope_of_work) {
      return new Response(JSON.stringify({ error: "vendor_email and scope_of_work are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromAddress = Deno.env.get("RESEND_FROM_ADDRESS") || "CitiSignal <notifications@citisignal.com>";
    const appUrl = Deno.env.get("APP_URL") || "https://app.citisignal.com";

    const html = emailHeader('New Work Order') +
      emailBody(`
        <p style="color:#1e293b;font-size:15px;margin:0 0 16px;">Hi ${vendor_name || 'there'},</p>
        <p style="color:#64748b;font-size:14px;margin:0 0 20px;">
          You've been assigned a new work order${property_address ? ` for <strong>${property_address}</strong>` : ''}.
        </p>
        <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;margin:0 0 8px;">Scope of Work</p>
          <p style="color:#1e293b;font-size:14px;margin:0;white-space:pre-line;">${scope_of_work.substring(0, 1000)}</p>
        </div>
        <div style="text-align:center;">
          <a href="${appUrl}/dashboard/work-orders" style="display:inline-block;background:linear-gradient(135deg,#0f172a,#334155);color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
            View Work Order →
          </a>
        </div>
      `) +
      emailFooter();

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [vendor_email],
        subject: `New Work Order${property_address ? ` — ${property_address}` : ''}`,
        html,
      }),
    });

    const result = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the email
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    await supabase.from("email_log").insert({
      user_id: user.id,
      email_type: "work_order_notification",
      subject: `Work Order — ${property_address || 'New'}`,
      recipient_email: vendor_email,
      metadata: { work_order_id, vendor_name },
    });

    return new Response(JSON.stringify({ success: true, resend_id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Work order notification error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
