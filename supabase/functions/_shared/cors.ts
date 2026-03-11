/**
 * Dynamic CORS origin check
 * 
 * Validates against ALLOWED_ORIGINS env var plus Lovable preview/published domains.
 * Set ALLOWED_ORIGINS as a comma-separated list of domains in Supabase secrets.
 * Example: "https://app.citisignal.com,https://sms-property-pal.lovable.app"
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const allowedOriginsRaw = Deno.env.get("ALLOWED_ORIGINS") || "";
  const allowedOrigins = allowedOriginsRaw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const origin = req.headers.get("Origin") || "";

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    Vary: "Origin",
  };

  const isLovableOrigin =
    origin.endsWith(".lovableproject.com") ||
    origin.endsWith(".lovable.app") ||
    origin.endsWith("-preview--lovable.app");

  const normalizeHost = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  };

  const originHost = normalizeHost(origin);
  const matchesConfiguredOrigin = allowedOrigins.some((allowed) => {
    if (allowed === origin) return true;
    const allowedHost = normalizeHost(allowed);
    return Boolean(originHost && allowedHost && originHost === allowedHost);
  });

  if (isLovableOrigin || matchesConfiguredOrigin) {
    headers["Access-Control-Allow-Origin"] = origin;
    return headers;
  }

  if (allowedOrigins.length === 0) {
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }

  headers["Access-Control-Allow-Origin"] = allowedOrigins[0];
  return headers;
}
