import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromAddress = Deno.env.get("RESEND_FROM_ADDRESS") || "CitiSignal <no-reply@citisignal.com>";

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error("Missing required environment variables");
    }

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin access required");

    // Parse body
    const body = await req.json();
    const { recipientEmail, inviteCode } = body;

    if (!recipientEmail || !inviteCode) {
      throw new Error("recipientEmail and inviteCode are required");
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error("Invalid email address");
    }

    const appUrl = "https://www.citisignal.com";
    const signupUrl = `${appUrl}/auth`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to CitiSignal</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px 16px 0 0;padding:36px 32px;text-align:center;">
      <div style="font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">📡 CitiSignal</div>
      <div style="color:#94a3b8;font-size:14px;margin-top:8px;">NYC Property Compliance Platform</div>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;padding:36px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
      <h1 style="color:#0f172a;font-size:22px;font-weight:700;margin:0 0 12px 0;">You're invited! 🎉</h1>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
        You've been invited to join <strong>CitiSignal</strong> — the all-in-one platform for NYC property compliance. 
        Monitor DOB, ECB, and HPD violations, track deadlines, manage vendors, and stay ahead of every compliance requirement.
      </p>

      <!-- Invite Code Box -->
      <div style="background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
        <p style="color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px 0;">Your Invite Code</p>
        <div style="font-size:32px;font-weight:800;color:#0f172a;letter-spacing:6px;font-family:monospace;">${inviteCode}</div>
        <p style="color:#94a3b8;font-size:12px;margin:10px 0 0 0;">Enter this code when creating your account</p>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${signupUrl}" style="display:inline-block;background:linear-gradient(135deg,#0f172a,#334155);color:#ffffff;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
          Create My Account →
        </a>
      </div>

      <!-- Steps -->
      <div style="background:#f8fafc;border-radius:10px;padding:20px 24px;">
        <p style="color:#374151;font-size:13px;font-weight:700;margin:0 0 12px 0;">How to get started:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td style="padding:6px 0;vertical-align:top;">
              <span style="background:#0f172a;color:white;border-radius:50%;width:20px;height:20px;display:inline-block;text-align:center;line-height:20px;font-size:11px;font-weight:700;margin-right:10px;">1</span>
              <span style="color:#475569;font-size:13px;">Go to <a href="${signupUrl}" style="color:#0f172a;font-weight:600;">citisignal.com/auth</a></span>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;vertical-align:top;">
              <span style="background:#0f172a;color:white;border-radius:50%;width:20px;height:20px;display:inline-block;text-align:center;line-height:20px;font-size:11px;font-weight:700;margin-right:10px;">2</span>
              <span style="color:#475569;font-size:13px;">Click <strong>Sign up</strong> and enter your email &amp; password</span>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;vertical-align:top;">
              <span style="background:#0f172a;color:white;border-radius:50%;width:20px;height:20px;display:inline-block;text-align:center;line-height:20px;font-size:11px;font-weight:700;margin-right:10px;">3</span>
              <span style="color:#475569;font-size:13px;">Enter invite code <strong style="font-family:monospace;">${inviteCode}</strong> and create your account</span>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;vertical-align:top;">
              <span style="background:#0f172a;color:white;border-radius:50%;width:20px;height:20px;display:inline-block;text-align:center;line-height:20px;font-size:11px;font-weight:700;margin-right:10px;">4</span>
              <span style="color:#475569;font-size:13px;">Confirm your email and start monitoring your properties</span>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f1f5f9;padding:20px 32px;border-radius:0 0 16px 16px;text-align:center;border:1px solid #e2e8f0;border-top:none;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">© ${new Date().getFullYear()} CitiSignal. All rights reserved.</p>
      <p style="color:#94a3b8;font-size:12px;margin:6px 0 0;">Questions? Reply to this email or visit <a href="${appUrl}" style="color:#64748b;">citisignal.com</a></p>
    </div>
  </div>
</body>
</html>`;

    // Send email via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromAddress,
        to: [recipientEmail],
        subject: `You're invited to CitiSignal — use code ${inviteCode}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      throw new Error(`Email send failed: ${err}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
