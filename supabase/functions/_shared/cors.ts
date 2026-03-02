/**
 * Security Fix 27: Dynamic CORS origin check
 * 
 * Replaces wildcard "*" CORS with origin validation against ALLOWED_ORIGINS env var.
 * Set ALLOWED_ORIGINS as a comma-separated list of domains in Supabase secrets.
 * Example: "https://app.citisignal.com,https://sms-property-pal.lovable.app"
 * 
 * Falls back to wildcard in development if ALLOWED_ORIGINS is not set.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const allowedOriginsRaw = Deno.env.get("ALLOWED_ORIGINS") || "";
  const allowedOrigins = allowedOriginsRaw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const origin = req.headers.get("Origin") || "";

  // If no ALLOWED_ORIGINS configured, fall back to wildcard (dev mode)
  if (allowedOrigins.length === 0) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    };
  }

  const isAllowed = allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    Vary: "Origin",
  };
}
