/**
 * send-sms — Twilio SMS Edge Function
 * 
 * STATUS: DISABLED (2026-03-02)
 * 
 * This function sends outbound SMS messages via the Twilio API.
 * It is currently disabled while we evaluate messaging costs and
 * migrate vendor communication to email-first workflows.
 * 
 * TO RE-ENABLE:
 * 1. Ensure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER
 *    secrets are configured in Lovable Cloud.
 * 2. Remove the early-return "disabled" response below.
 * 3. Add Twilio request signature validation for inbound webhooks
 *    (see security audit notes).
 * 
 * REQUIRED SECRETS:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER
 * 
 * CALLED BY:
 * - CreateWorkOrderDialog.tsx (vendor dispatch)
 * - PropertyWorkOrdersTab.tsx (approve/reject/counter quotes)
 * - WorkOrdersPage.tsx (dispatch flow)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── DISABLED: SMS sending is temporarily turned off ──
  // All callers handle this gracefully (try/catch with toast.warning).
  // Remove this block to re-enable Twilio SMS.
  console.log("send-sms called but is currently DISABLED");
  return new Response(
    JSON.stringify({
      success: false,
      error: "SMS is temporarily disabled. Vendor will be notified via email instead.",
    }),
    {
      status: 200, // 200 so callers don't treat it as a crash
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );

  /* ── ORIGINAL IMPLEMENTATION (uncomment to re-enable) ──

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      throw new Error("Twilio credentials not configured");
    }

    const { to, message } = await req.json();

    if (!to || typeof to !== "string") {
      throw new Error("Phone number 'to' is required");
    }
    if (!message || typeof message !== "string") {
      throw new Error("Message is required");
    }
    if (message.length > 1600) {
      throw new Error("Message too long (max 1600 characters)");
    }

    // Format phone number (ensure +1 prefix for US numbers)
    let formattedTo = to.replace(/\D/g, "");
    if (formattedTo.length === 10) {
      formattedTo = `+1${formattedTo}`;
    } else if (!formattedTo.startsWith("+")) {
      formattedTo = `+${formattedTo}`;
    }

    if (formattedTo.length < 10 || formattedTo.length > 16) {
      throw new Error("Invalid phone number format");
    }

    // TODO: Add Twilio request signature validation before re-enabling
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
      body: new URLSearchParams({
        To: formattedTo,
        From: twilioPhoneNumber,
        Body: message,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Twilio API error:", responseData);
      throw new Error(responseData.message || `Twilio error: ${response.status}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_sid: responseData.sid,
        status: responseData.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending SMS:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  */
});
