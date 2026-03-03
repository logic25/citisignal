import { supabase } from '@/integrations/supabase/client';

interface ApiLogEntry {
  endpoint: string;
  url: string;
  status_code: number | null;
  response_time_ms: number;
  error_message: string | null;
  property_id?: string | null;
  user_id?: string | null;
}

// Detect endpoint name from URL
function detectEndpoint(url: string): string {
  if (url.includes('64uk-42ks')) return 'PLUTO';
  if (url.includes('ic3t-wcy2')) return 'DOB_JOBS';
  if (url.includes('3h2n-5cm9')) return 'DOB_VIOLATIONS_OLD';
  if (url.includes('855j-jady')) return 'DOB_VIOLATIONS_NEW';
  if (url.includes('6bgk-3dad')) return 'ECB';
  if (url.includes('wvxf-dwi5')) return 'HPD';
  if (url.includes('jz4z-kudi')) return 'OATH';
  if (url.includes('eabe-havv')) return 'DOB_COMPLAINTS';
  if (url.includes('avgm-ztsb')) return 'FDNY_DIRECT';
  if (url.includes('w9ak-ipjd')) return 'DOB_NOW_BUILD';
  if (url.includes('xxbr-ypig')) return 'DOB_NOW_LIMITED_ALT';
  if (url.includes('dm9a-ab7w')) return 'DOB_NOW_ELECTRICAL';
  if (url.includes('kfp4-dz4h')) return 'DOB_NOW_ELEVATOR';
  if (url.includes('ipu4-2q9a')) return 'DOB_PERMITS';
  if (url.includes('bs8b-p36w')) return 'DOB_CO';
  if (url.includes('bc8t-ecyu') || url.includes('pad')) return 'PAD';
  if (url.includes('jt7v-77mi') || url.includes('geoclient')) return 'GEOCLIENT';
  if (url.includes('data.cityofnewyork.us')) return 'NYC_OTHER';
  return 'UNKNOWN';
}

// Fire-and-forget log to Supabase
function logToDatabase(entry: ApiLogEntry) {
  supabase
    .from('api_call_logs')
    .insert(entry)
    .then(({ error }) => {
      if (error) console.warn('Failed to log API call:', error.message);
    });
}

/**
 * Logged fetch wrapper for NYC Open Data API calls.
 * Drop-in replacement for fetch() that logs call metrics.
 */
export async function loggedFetch(
  url: string | URL,
  init?: RequestInit,
  context?: { propertyId?: string; userId?: string }
): Promise<Response> {
  const urlStr = url.toString();
  const endpoint = detectEndpoint(urlStr);
  const start = performance.now();

  try {
    const response = await fetch(url, init);
    const elapsed = Math.round(performance.now() - start);

    logToDatabase({
      endpoint,
      url: urlStr.substring(0, 500),
      status_code: response.status,
      response_time_ms: elapsed,
      error_message: response.ok ? null : `HTTP ${response.status} ${response.statusText}`,
      property_id: context?.propertyId || null,
      user_id: context?.userId || null,
    });

    return response;
  } catch (error: any) {
    const elapsed = Math.round(performance.now() - start);

    logToDatabase({
      endpoint,
      url: urlStr.substring(0, 500),
      status_code: null,
      response_time_ms: elapsed,
      error_message: error?.message || 'Network error',
      property_id: context?.propertyId || null,
      user_id: context?.userId || null,
    });

    throw error;
  }
}
