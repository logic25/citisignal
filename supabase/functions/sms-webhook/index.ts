/**
 * sms-webhook — Inbound SMS Handler (Twilio Webhook)
 * 
 * STATUS: DISABLED (2026-03-02)
 * 
 * This function handles inbound SMS messages from Twilio. It detects
 * whether the sender is a known vendor (and extracts quote amounts)
 * or a tenant/owner (and responds with AI-powered property context).
 * 
 * TO RE-ENABLE:
 * 1. Ensure Twilio secrets are configured.
 * 2. Add Twilio request signature validation (CRITICAL — see security audit).
 *    Without signature validation, anyone can spoof inbound messages and
 *    manipulate work order quotes.
 * 3. Remove the early-return below.
 * 4. Configure the Twilio webhook URL to point to this function.
 * 
 * SECURITY NOTE:
 * Before re-enabling, implement Twilio signature validation using the
 * X-Twilio-Signature header and TWILIO_AUTH_TOKEN. See:
 * https://www.twilio.com/docs/usage/security#validating-requests
 * 
 * REQUIRED SECRETS:
 * - TWILIO_AUTH_TOKEN (for signature validation)
 * - LOVABLE_API_KEY (for AI responses)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── DISABLED: Inbound SMS processing is temporarily turned off ──
  console.log("sms-webhook called but is currently DISABLED");
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "Content-Type": "application/xml" } }
  );

  /* ── ORIGINAL IMPLEMENTATION (uncomment to re-enable) ──
  
  // ... (full original implementation was here)
  // See git history for the complete vendor detection, AI response,
  // and property context logic.
  
  */
});
