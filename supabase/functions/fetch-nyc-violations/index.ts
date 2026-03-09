import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// NYC Open Data API endpoints (Socrata) - No API key needed, 1000 req/hr limit
const NYC_OPEN_DATA_ENDPOINTS = {
  DOB_OLD: "https://data.cityofnewyork.us/resource/3h2n-5cm9.json",
  DOB_NEW: "https://data.cityofnewyork.us/resource/855j-jady.json",
  ECB: "https://data.cityofnewyork.us/resource/6bgk-3dad.json",
  HPD: "https://data.cityofnewyork.us/resource/wvxf-dwi5.json",
  // OATH Hearings Division - main dataset for ALL agency violations
  OATH_HEARINGS: "https://data.cityofnewyork.us/resource/jz4z-kudi.json",
  // DOB Complaints
  DOB_COMPLAINTS: "https://data.cityofnewyork.us/resource/eabe-havv.json",
  // Additional agency datasets
  DEP: "https://data.cityofnewyork.us/resource/xbs2-bdct.json",
  DOT: "https://data.cityofnewyork.us/resource/w286-9scw.json",
  DSNY: "https://data.cityofnewyork.us/resource/erm2-nwe9.json",
  LPC: "https://data.cityofnewyork.us/resource/wyev-xvpj.json",
  DOF: "https://data.cityofnewyork.us/resource/bnx9-e6tj.json",
  CO: "https://data.cityofnewyork.us/resource/bs8b-p36w.json",
  // Application endpoints
  DOB_BIS_JOBS: "https://data.cityofnewyork.us/resource/ic3t-wcy2.json",
  DOB_NOW_BUILD: "https://data.cityofnewyork.us/resource/w9ak-ipjd.json",
  DOB_NOW_LIMITED_ALT: "https://data.cityofnewyork.us/resource/xxbr-ypig.json",
  DOB_NOW_ELECTRICAL: "https://data.cityofnewyork.us/resource/dm9a-ab7w.json",
  DOB_NOW_ELEVATOR: "https://data.cityofnewyork.us/resource/kfp4-dz4h.json",
  DOB_PERMIT_ISSUANCE: "https://data.cityofnewyork.us/resource/ipu4-2q9a.json",
};

// Agency name mappings for OATH dataset — each agency may have multiple sub-names
const OATH_AGENCY_NAMES: Record<string, string[]> = {
  FDNY: ["FIRE DEPARTMENT OF NYC"],
  DEP: ["DEPT OF ENVIRONMENT PROT", "DEP - BUREAU OF ENV. COMPLIANC", "DEP - BWSO", "ENV PROTECT"],
  DOT: ["DEPT OF TRANSPORTATION", "DEPT OF TRAN"],
  DSNY: ["SANITATION DEPT", "SANITATION OTHERS", "SANITATION RECYCLING", "SANITATION POLICE"],
  LPC: ["LANDMARKS PRESERV COMM", "LANDMARKS PRESERVATION COMM"],
  DOF: ["DEPT OF FINANCE"],
  DOHMH: ["DOHMH - BFSCS", "PCS - DOHMH", "DOHMH - PEST CONTROL", "COOLING TOWERS - DOHMH", "DOH MENTAL HEALTH", "DEPT OF HEALTH"],
};

type AgencyType = "DOB" | "ECB" | "FDNY" | "HPD" | "DEP" | "DOT" | "DSNY" | "LPC" | "DOF" | "DOHMH";

interface ViolationRecord {
  agency: AgencyType;
  violation_number: string;
  issued_date: string;
  hearing_date: string | null;
  cure_due_date: string | null;
  description_raw: string | null;
  property_id: string;
  severity: string | null;
  violation_class: string | null;
  violation_type: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
  penalty_amount: number | null;
  respondent_name: string | null;
  synced_at: string;
  source?: string;
  oath_status?: string | null;
  status: 'open' | 'in_progress' | 'closed';
  // Complaint-specific fields
  complaint_category?: string | null;
  disposition_code?: string | null;
  disposition_comments?: string | null;
  priority?: string | null;
  complaint_number?: string | null;
}

// DOB violation code prefixes and their meanings
const DOB_CODE_PREFIXES: Record<string, { type: string; description: string }> = {
  'FTC-VT-PER': { type: 'elevator', description: 'Failure to Correct - Elevator Periodic Test' },
  'FTC-VT-CAT1': { type: 'elevator', description: 'Failure to Correct - Elevator Category 1 Test' },
  'FTC-VT-CAT5': { type: 'elevator', description: 'Failure to Correct - Elevator Category 5 Test' },
  'FTF-VT-PER': { type: 'elevator', description: 'Failure to File - Elevator Periodic Test' },
  'FTF-VT-CAT1': { type: 'elevator', description: 'Failure to File - Elevator Category 1 Test' },
  'FTF-VT-CAT5': { type: 'elevator', description: 'Failure to File - Elevator Category 5 Test' },
  'FTC-EN-BENCH': { type: 'elevator', description: 'Failure to Correct - Elevator Benchmarking' },
  'FTF-EN-BENCH': { type: 'elevator', description: 'Failure to File - Elevator Benchmarking' },
  'FTC-AEU-HAZ': { type: 'elevator', description: 'Failure to Correct - Elevator Hazardous Condition' },
  'FTF-AEU-HAZ': { type: 'elevator', description: 'Failure to File - Elevator Hazardous Condition' },
  'FTF-PL-PER': { type: 'gas_piping', description: 'Failure to File - Gas Piping Periodic Inspection (Local Law 152)' },
  'FTC-PL-PER': { type: 'gas_piping', description: 'Failure to Correct - Gas Piping Periodic Inspection (Local Law 152)' },
  'FTF-PL': { type: 'plumbing', description: 'Failure to File - Plumbing Compliance' },
  'FTC-PL': { type: 'plumbing', description: 'Failure to Correct - Plumbing Compliance' },
  'FTF-BL-PER': { type: 'hvac', description: 'Failure to File - Boiler Periodic Inspection' },
  'FTC-BL-PER': { type: 'hvac', description: 'Failure to Correct - Boiler Periodic Inspection' },
  'FTF-SP-PER': { type: 'fire_safety', description: 'Failure to File - Sprinkler Periodic Inspection' },
  'FTC-SP-PER': { type: 'fire_safety', description: 'Failure to Correct - Sprinkler Periodic Inspection' },
  'FTF-FA-PER': { type: 'structural', description: 'Failure to File - Façade Periodic Inspection (LL11/FISP)' },
  'FTC-FA-PER': { type: 'structural', description: 'Failure to Correct - Façade Periodic Inspection (LL11/FISP)' },
  'FTF-RE-PER': { type: 'structural', description: 'Failure to File - Retaining Wall Periodic Inspection' },
  'FTC-RE-PER': { type: 'structural', description: 'Failure to Correct - Retaining Wall Periodic Inspection' },
};

// Decode a DOB violation code into a human-readable description
function decodeDOBViolationCode(code: string | null): { type: string; description: string } | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  
  // Try exact prefix matches (longest first)
  const sortedPrefixes = Object.keys(DOB_CODE_PREFIXES).sort((a, b) => b.length - a.length);
  for (const prefix of sortedPrefixes) {
    if (upper.includes(prefix)) {
      return DOB_CODE_PREFIXES[prefix];
    }
  }
  
  // Generic FTF/FTC patterns
  if (upper.includes('FTF')) return { type: 'compliance', description: 'Failure to File - Compliance Document' };
  if (upper.includes('FTC')) return { type: 'compliance', description: 'Failure to Correct - Compliance Issue' };
  if (upper.includes('NOD')) return { type: 'compliance', description: 'Notice of Deficiency' };
  
  return null;
}

// Extract violation type from description or category
function extractViolationType(description: string | null, category: string | null, agency: string): string | null {
  const text = `${description || ''} ${category || ''}`.toLowerCase();
  
  // First try DOB code decoding for precise classification
  const decoded = decodeDOBViolationCode(description);
  if (decoded) return decoded.type;
  
  // Elevator-related (specific terms only, not generic FTF/FTC)
  if (text.includes('elevator') || text.includes('escalator') || text.includes('convey') || 
      text.includes('lift') || text.includes('dumbwaiter')) {
    return 'elevator';
  }
  // Gas piping / LL152
  if (text.includes('gas piping') || text.includes('ll152') || text.includes('local law 152') ||
      text.includes('gas leak') || text.includes('gas line')) {
    return 'gas_piping';
  }
  // Plumbing
  if (text.includes('plumb') || text.includes('water') || text.includes('sewer') || 
      text.includes('drain') || text.includes('pipe') || text.includes('backflow')) {
    return 'plumbing';
  }
  // Electrical
  if (text.includes('electric') || text.includes('wiring') || text.includes('outlet') || 
      text.includes('circuit') || text.includes('panel') || text.includes('volt')) {
    return 'electrical';
  }
  // Fire safety
  if (text.includes('fire') || text.includes('sprinkler') || text.includes('smoke') || 
      text.includes('alarm') || text.includes('extinguish') || text.includes('egress') ||
      agency === 'FDNY') {
    return 'fire_safety';
  }
  // Structural
  if (text.includes('structur') || text.includes('foundation') || text.includes('beam') || 
      text.includes('column') || text.includes('load') || text.includes('crack') ||
      text.includes('facade') || text.includes('parapet') || text.includes('ll11')) {
    return 'structural';
  }
  // Construction/permits
  if (text.includes('permit') || text.includes('work without') || text.includes('construction') ||
      text.includes('alteration') || text.includes('demolition')) {
    return 'construction';
  }
  // HVAC/Boiler
  if (text.includes('boiler') || text.includes('hvac') || text.includes('heating') || 
      text.includes('ventilat') || text.includes('air condition') || text.includes('gas')) {
    return 'hvac';
  }
  // Housing/maintenance (HPD)
  if (text.includes('maint') || text.includes('repair') || text.includes('paint') ||
      text.includes('lead') || text.includes('mold') || text.includes('pest') ||
      text.includes('rodent') || text.includes('vermin') || agency === 'HPD') {
    return 'housing';
  }
  // Sanitation
  if (text.includes('sanit') || text.includes('garbage') || text.includes('trash') ||
      text.includes('refuse') || text.includes('recycl') || agency === 'DSNY') {
    return 'sanitation';
  }
  // Landmarks
  if (text.includes('landmark') || text.includes('historic') || text.includes('preserv') ||
      agency === 'LPC') {
    return 'landmarks';
  }
  // Environmental
  if (text.includes('environ') || text.includes('asbestos') || text.includes('hazard') ||
      text.includes('pollut') || agency === 'DEP') {
    return 'environmental';
  }
  // Signage
  if (text.includes('sign') || text.includes('billboard') || text.includes('awning')) {
    return 'signage';
  }
  // Zoning
  if (text.includes('zoning') || text.includes('certificate of occupancy') || text.includes('c of o') ||
      text.includes('use group') || text.includes('occupancy')) {
    return 'zoning';
  }
  
  return 'other';
}

// Statuses that indicate a violation is resolved/closed
const CLOSED_STATUSES = [
  'WRITTEN OFF', 'CLOSED', 'DISMISSED', 'PAID', 'RESOLVED', 'COMPLIED',
  'SETTLED', 'SATISFIED', 'VACATED', 'WAIVED', 'NO PENALTY', 'DEFAULT - PAID'
];

// BIS Portal scraper — PAUSED per request
// const TERMINAL_BIS_STATUSES = ['I', 'U', 'X', '3'];


async function sendSMSAlert(
  supabaseUrl: string,
  supabaseServiceKey: string,
  to: string,
  message: string
): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ to, message }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("SMS send failed:", error);
    } else {
      console.log("SMS alert sent successfully");
    }
  } catch (error) {
    console.error("Error sending SMS:", error);
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Allow service role key for server-to-server calls (e.g., scheduled-sync)
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === supabaseServiceKey;

    let authenticatedUserId: string | null = null;

    if (!isServiceRole) {
      // Verify the user for client calls
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
      authenticatedUserId = user.id;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { bin, bbl, property_id, applicable_agencies, send_sms_alert } = await req.json();

    // Input validation
    if (!bin && !bbl) {
      throw new Error("BIN or BBL is required");
    }
    if (bin && (typeof bin !== "string" || !/^\d{7}$/.test(bin))) {
      throw new Error("Invalid BIN format (must be 7 digits)");
    }
    if (bbl && (typeof bbl !== "string" || !/^\d{10}$/.test(bbl))) {
      throw new Error("Invalid BBL format (must be 10 digits)");
    }
    if (property_id && (typeof property_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(property_id))) {
      throw new Error("Invalid property_id format");
    }
    if (applicable_agencies && (!Array.isArray(applicable_agencies) || applicable_agencies.some((a: unknown) => typeof a !== "string"))) {
      throw new Error("Invalid applicable_agencies format");
    }

    // Verify property ownership (skip for service role calls like scheduled-sync)
    if (property_id && !isServiceRole) {
      const { data: prop, error: propErr } = await supabase
        .from("properties")
        .select("user_id")
        .eq("id", property_id)
        .single();
      if (propErr || !prop || prop.user_id !== authenticatedUserId) {
        return new Response(JSON.stringify({ error: "Forbidden: not your property" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse BBL into components for OATH lookups
    let borough = "";
    let block = "";
    let lot = "";
    if (bbl && bbl.length >= 10) {
      borough = bbl.charAt(0);
      block = bbl.substring(1, 6);
      lot = bbl.substring(6, 10);
    }

    console.log(`Fetching violations for BIN: ${bin}, BBL: ${bbl} (Borough: ${borough}, Block: ${block}, Lot: ${lot}), Agencies: ${(applicable_agencies || []).join(', ')}`);

    const violations: ViolationRecord[] = [];
    const agenciesToSync: string[] = applicable_agencies || ["DOB", "ECB", "HPD", "FDNY", "DEP", "DOT", "DSNY", "DOF", "DOHMH"];
    const now = new Date().toISOString();

    // Clean up old BIS Jobs-based SWO violations (false positives from special_action_status)
    if (property_id) {
      const { count } = await supabase
        .from('violations')
        .delete()
        .eq('property_id', property_id)
        .like('violation_number', 'SWO-%')
        .select('*', { count: 'exact', head: true });
      if (count && count > 0) {
        console.log(`Cleaned up ${count} old BIS Jobs SWO violations`);
      }
    }

    // Log API call metrics to api_call_logs table
    async function logApiCall(
      endpoint: string,
      url: string,
      statusCode: number | null,
      responseTimeMs: number,
      errorMessage: string | null,
      propId: string | null
    ) {
      try {
        await supabase.from('api_call_logs').insert({
          endpoint,
          url: url.substring(0, 500),
          status_code: statusCode,
          response_time_ms: responseTimeMs,
          error_message: errorMessage,
          property_id: propId,
        });
      } catch (e) {
        console.warn('Failed to log API call:', e);
      }
    }

    // Map safeFetch agency labels to standardized endpoint names
    const endpointNameMap: Record<string, string> = {
      DOB_OLD: 'DOB_VIOLATIONS_OLD',
      DOB_NEW: 'DOB_VIOLATIONS_NEW',
      ECB: 'ECB',
      HPD: 'HPD',
      DOB_COMPLAINTS: 'DOB_COMPLAINTS',
      DOB_BIS_JOBS: 'DOB_JOBS',
      DOB_NOW_BUILD: 'DOB_NOW_BUILD',
      DOB_NOW_LIMITED_ALT: 'DOB_NOW_LIMITED_ALT',
      DOB_NOW_ELECTRICAL: 'DOB_NOW_ELECTRICAL',
      DOB_NOW_ELEVATOR: 'DOB_NOW_ELEVATOR',
      DOB_PERMIT_ISSUANCE: 'DOB_PERMITS',
      FDNY_DIRECT: 'FDNY_DIRECT',
    };

    function resolveEndpointName(agency: string): string {
      // Direct mapping
      if (endpointNameMap[agency]) return endpointNameMap[agency];
      // OATH sub-agency pattern: "FDNY/OATH/FIRE DEPARTMENT OF NYC" -> "OATH_FDNY"
      if (agency.includes('/OATH/')) {
        const parts = agency.split('/');
        return `OATH_${parts[0]}`;
      }
      // OATH reconciliation pattern
      if (agency.startsWith('OATH_RECON/')) return 'OATH';
      return agency;
    }

    // Fetch with timeout and single retry
    async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { signal: controller.signal });
        return response;
      } finally {
        clearTimeout(timeout);
      }
    }

    // Robust date normalization for various NYC API formats
    function normalizeDate(dateStr: string | null | undefined): string | null {
      if (!dateStr) return null;
      const cleaned = dateStr.trim();
      // ISO format: 2024-01-15T00:00:00
      if (cleaned.includes('T')) return cleaned.split('T')[0];
      // MM/DD/YYYY
      const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (slashMatch) {
        const [, m, d, y] = slashMatch;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      // YYYYMMDD (common in NYC Open Data)
      const compactMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);
      if (compactMatch) {
        return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
      }
      // YYYY-MM-DD already
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
      // Last resort
      const parsed = new Date(cleaned);
      if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
      return null;
    }

    // Log sync health per endpoint
    async function logSyncHealth(
      endpointName: string,
      status: 'success' | 'empty' | 'error' | 'timeout',
      resultCount: number,
      errorMessage: string | null,
      responseTimeMs: number
    ) {
      try {
        await supabase.from('sync_health_logs').insert({
          property_id: property_id || null,
          endpoint_name: endpointName,
          status,
          result_count: resultCount,
          error_message: errorMessage,
          response_time_ms: responseTimeMs,
        });
      } catch (e) {
        console.warn('Failed to log sync health:', e);
      }
    }

    const safeFetch = async (url: string, agency: string): Promise<unknown[]> => {
      const endpointName = resolveEndpointName(agency);
      const attempt = async (): Promise<{ data: unknown[]; shouldRetry: boolean }> => {
        const start = Date.now();
        try {
          console.log(`Fetching ${agency}: ${url}`);
          const response = await fetchWithTimeout(url);
          const elapsed = Date.now() - start;
          if (!response.ok) {
            console.error(`${agency} API error: ${response.status}`);
            await logApiCall(endpointName, url, response.status, elapsed, `HTTP ${response.status}`, property_id || null);
            return { data: [], shouldRetry: response.status >= 500 || response.status === 429 };
          }
          const data = await response.json();
          await logApiCall(endpointName, url, response.status, elapsed, null, property_id || null);
          return { data, shouldRetry: false };
        } catch (error) {
          const elapsed = Date.now() - start;
          const errMsg = error instanceof DOMException && error.name === 'AbortError'
            ? 'Timeout after 15s'
            : (error as Error)?.message || 'Network error';
          console.error(`${agency} fetch error:`, errMsg);
          await logApiCall(endpointName, url, null, elapsed, errMsg, property_id || null);
          return { data: [], shouldRetry: true };
        }
      };

      // First attempt
      const fetchStart = Date.now();
      const first = await attempt();
      if (!first.shouldRetry) {
        const elapsed = Date.now() - fetchStart;
        const resultCount = first.data.length;
        const healthStatus = resultCount > 0 ? 'success' : 'empty';
        await logSyncHealth(endpointName, healthStatus, resultCount, null, elapsed);
        return first.data;
      }

      // Retry once only for transient failures (timeout/network/5xx/429)
      console.log(`${agency}: Retrying once...`);
      const second = await attempt();
      const elapsed = Date.now() - fetchStart;
      if (second.data.length > 0) {
        await logSyncHealth(endpointName, 'success', second.data.length, null, elapsed);
      } else if (second.shouldRetry) {
        await logSyncHealth(endpointName, 'timeout', 0, 'Failed after retry', elapsed);
      } else {
        await logSyncHealth(endpointName, second.data.length > 0 ? 'success' : 'empty', second.data.length, null, elapsed);
      }
      return second.data;
    };

    const boroughNames: Record<string, string> = {
      "1": "MANHATTAN",
      "2": "BRONX",
      "3": "BROOKLYN",
      "4": "QUEENS",
      "5": "STATEN ISLAND",
    };
    const boroughName = boroughNames[borough] || "";

    // Helper to fetch violations from OATH dataset for a specific agency
    const fetchOATHViolations = async (agency: AgencyType): Promise<void> => {
      if (!borough || !block || !lot || !boroughName) {
        console.log(`${agency}: Skipped - requires valid BBL for OATH lookup`);
        return;
      }

      const oathAgencyNames = OATH_AGENCY_NAMES[agency];
      if (!oathAgencyNames || oathAgencyNames.length === 0) {
        console.log(`${agency}: No OATH agency mapping found`);
        return;
      }

      // Query OATH for each sub-agency name
      for (const oathAgencyName of oathAgencyNames) {
        const data = await safeFetch(
          `${NYC_OPEN_DATA_ENDPOINTS.OATH_HEARINGS}?issuing_agency=${encodeURIComponent(oathAgencyName)}&violation_location_borough=${encodeURIComponent(boroughName)}&violation_location_block_no=${block}&violation_location_lot_no=${lot}&$limit=1000&$order=violation_date DESC`,
          `${agency}/OATH/${oathAgencyName}`
        );

        console.log(`Found ${data.length} ${agency} violations from OATH (${oathAgencyName})`);
        if (data.length > 0) {
          const sample = data[0] as Record<string, unknown>;
          console.log(
            `${agency}/OATH sample keys: ${Object.keys(sample).slice(0, 40).join(", ")}`
          );
        }

        for (const v of data as Record<string, unknown>[]) {
          const violationNum = v.ticket_number as string;
          const issueDate = v.violation_date as string;

          // Combine multiple OATH fields so values like "Written Off" aren't lost.
          const oathStatus = [
            v.hearing_status,
            v.hearing_result,
            v.compliance_status,
            v.violation_status,
            v.status,
          ]
            .map((s) => (typeof s === 'string' ? s.trim() : ''))
            .filter(Boolean)
            .join(' | ');

          if (violationNum && issueDate) {
            // Determine if violation is closed based on OATH status
            const isResolved = CLOSED_STATUSES.some(s => 
              oathStatus.toUpperCase().includes(s)
            );

            const description = [
              v.charge_1_code_description,
              v.charge_2_code_description,
              v.charge_3_code_description,
            ].filter(Boolean).join("; ") || `${agency} Violation`;

            const violationClass = (v.charge_1_code || v.charge_1_code_section) as string || null;
            violations.push({
              agency,
              violation_number: String(violationNum),
              issued_date: normalizeDate(issueDate) || issueDate,
              hearing_date: normalizeDate(v.hearing_date as string),
              cure_due_date: null,
              description_raw: description,
              property_id,
              severity: agency === "FDNY" || agency === "LPC" ? "critical" : "medium",
              violation_class: violationClass,
              violation_type: extractViolationType(description, violationClass, agency),
              is_stop_work_order: false,
              is_vacate_order: false,
              penalty_amount: v.penalty_imposed ? parseFloat(v.penalty_imposed as string) :
                             v.total_violation_amount ? parseFloat(v.total_violation_amount as string) : null,
              respondent_name: v.respondent_last_name ?
                `${v.respondent_first_name || ""} ${v.respondent_last_name}`.trim() : null,
              synced_at: now,
              source: "oath",
              oath_status: oathStatus || null,
              status: isResolved ? 'closed' : 'open',
            });
          }
        }
      }
    };

    // Fetch DOB Violations
    if (agenciesToSync.includes("DOB")) {
      const [dobOldData, dobNewData] = await Promise.all([
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_OLD}?bin=${bin}&$limit=1000&$order=issue_date DESC`, "DOB_OLD"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_NEW}?bin=${bin}&$limit=1000&$order=violation_issue_date DESC`, "DOB_NEW"),
      ]);

      console.log(`Found ${dobOldData.length} DOB (old) violations, ${dobNewData.length} DOB (new) violations`);

      for (const v of dobOldData as Record<string, unknown>[]) {
        const violationNum = (v.violation_number || v.ecb_violation_number || v.number) as string;
        const issueDate = v.issue_date as string;
        const dobStatus = (v.disposition_status || v.status || "") as string;

        if (violationNum && issueDate) {
          const isResolved = CLOSED_STATUSES.some(s => 
            dobStatus.toUpperCase().includes(s)
          ) || dobStatus.toUpperCase().includes('CURED') || dobStatus.toUpperCase().includes('COMPLIED');

          const descRaw = (v.description || v.violation_category || v.violation_type) as string || null;
          const violClass = (v.violation_category || v.class) as string || null;
          violations.push({
            agency: "DOB",
            violation_number: violationNum,
            issued_date: normalizeDate(issueDate) || issueDate,
            hearing_date: null,
            cure_due_date: null,
            description_raw: descRaw,
            property_id,
            severity: (v.violation_type || v.severity) as string || null,
            violation_class: violClass,
            violation_type: extractViolationType(descRaw, violClass, "DOB"),
            is_stop_work_order: String(v.disposition_comments || "").toLowerCase().includes("stop work"),
            is_vacate_order: String(v.disposition_comments || "").toLowerCase().includes("vacate"),
            penalty_amount: v.penality_imposed ? parseFloat(v.penality_imposed as string) : null,
            respondent_name: (v.respondent_name || v.owner) as string || null,
            synced_at: now,
            source: "dob_bis",
            oath_status: dobStatus || null,
            status: isResolved ? 'closed' : 'open',
          });
        }
      }

      for (const v of dobNewData as Record<string, unknown>[]) {
        const violationNum = v.violation_number as string;
        const issueDate = v.violation_issue_date as string;
        const dobStatus = (v.disposition_status || v.status || "") as string;

        if (violationNum && issueDate) {
          const isResolved = CLOSED_STATUSES.some(s => 
            dobStatus.toUpperCase().includes(s)
          ) || dobStatus.toUpperCase().includes('CURED') || dobStatus.toUpperCase().includes('COMPLIED');

          const descRawNew = (v.violation_description || v.violation_type) as string || null;
          const violClassNew = v.violation_category as string || null;
          violations.push({
            agency: "DOB",
            violation_number: violationNum,
            issued_date: normalizeDate(issueDate) || issueDate,
            hearing_date: null,
            cure_due_date: normalizeDate(v.cure_date as string),
            description_raw: descRawNew,
            property_id,
            severity: v.violation_type as string || null,
            violation_class: violClassNew,
            violation_type: extractViolationType(descRawNew, violClassNew, "DOB"),
            is_stop_work_order: String(v.violation_description || "").toLowerCase().includes("stop work"),
            is_vacate_order: String(v.violation_description || "").toLowerCase().includes("vacate"),
            penalty_amount: v.penalty_amount ? parseFloat(v.penalty_amount as string) : null,
            respondent_name: v.respondent_name as string || null,
            synced_at: now,
            source: "dob_now",
            oath_status: dobStatus || null,
            status: isResolved ? 'closed' : 'open',
          });
        }
      }
    }

    // Fetch ECB Violations
    if (agenciesToSync.includes("ECB")) {
      const ecbData = await safeFetch(
        `${NYC_OPEN_DATA_ENDPOINTS.ECB}?bin=${bin}&$limit=1000&$order=issue_date DESC`,
        "ECB"
      );

      console.log(`Found ${ecbData.length} ECB violations`);

      for (const v of ecbData as Record<string, unknown>[]) {
        const violationNum = v.ecb_violation_number as string;
        const issueDate = v.issue_date as string;
        const ecbStatus = (v.ecb_violation_status || v.status || "") as string;

        if (violationNum && issueDate) {
          const isResolved = CLOSED_STATUSES.some(s => 
            ecbStatus.toUpperCase().includes(s)
          ) || ecbStatus.toUpperCase().includes('RESOLVE') || ecbStatus.toUpperCase().includes('CERTIF');

          const ecbDescRaw = (v.violation_description || v.infraction_code1) as string || null;
          violations.push({
            agency: "ECB",
            violation_number: violationNum,
            issued_date: normalizeDate(issueDate) || issueDate,
            hearing_date: normalizeDate(v.scheduled_hearing_date as string),
            cure_due_date: null,
            description_raw: ecbDescRaw,
            property_id,
            severity: (v.severity || v.aggravated_level) as string || null,
            violation_class: null,
            violation_type: extractViolationType(ecbDescRaw, null, "ECB"),
            is_stop_work_order: false,
            is_vacate_order: false,
            penalty_amount: v.penality_imposed ? parseFloat(v.penality_imposed as string) : null,
            respondent_name: v.respondent_name as string || null,
            synced_at: now,
            source: "ecb",
            oath_status: ecbStatus || null,
            status: isResolved ? 'closed' : 'open',
          });
        }
      }
    }

    // Fetch HPD Violations
    if (agenciesToSync.includes("HPD") && bbl) {
      const hpdData = await safeFetch(
        `${NYC_OPEN_DATA_ENDPOINTS.HPD}?bbl=${bbl}&$limit=1000&$order=inspectiondate DESC`,
        "HPD"
      );

      console.log(`Found ${hpdData.length} HPD violations`);

      for (const v of hpdData as Record<string, unknown>[]) {
        const violationNum = v.violationid as string;
        const issueDate = v.inspectiondate as string;
        const hpdStatus = (v.currentstatus || v.status || "") as string;

        if (violationNum && issueDate) {
          // HPD uses different status terms
          const isResolved = hpdStatus.toUpperCase().includes('CERTIF') || 
                            hpdStatus.toUpperCase().includes('CLOSED') ||
                            hpdStatus.toUpperCase().includes('DISMISS');

          const hpdDescRaw = (v.novdescription || v.novissueddate) as string || null;
          const hpdClass = v.class as string || null;
          violations.push({
            agency: "HPD",
            violation_number: String(violationNum),
            issued_date: normalizeDate(issueDate) || issueDate,
            hearing_date: null,
            cure_due_date: normalizeDate(v.certifieddate as string),
            description_raw: hpdDescRaw,
            property_id,
            severity: hpdClass,
            violation_class: hpdClass,
            violation_type: extractViolationType(hpdDescRaw, hpdClass, "HPD"),
            is_stop_work_order: false,
            is_vacate_order: String(v.novdescription || "").toLowerCase().includes("vacate"),
            penalty_amount: null,
            respondent_name: null,
            synced_at: now,
            source: "hpd",
            oath_status: hpdStatus || null,
            status: isResolved ? 'closed' : 'open',
          });
        }
      }
    }

    // Fetch DOB Complaints
    if (agenciesToSync.includes("DOB") && bin) {
      const complaintsData = await safeFetch(
        `${NYC_OPEN_DATA_ENDPOINTS.DOB_COMPLAINTS}?bin=${bin}&$limit=1000&$order=date_entered DESC`,
        "DOB_COMPLAINTS"
      );

      console.log(`Found ${complaintsData.length} DOB complaints`);

      for (const v of complaintsData as Record<string, unknown>[]) {
        const complaintNum = v.complaint_number as string;
        const dateEntered = v.date_entered as string;

        if (complaintNum && dateEntered) {
          const dispositionCode = (v.disposition_code || "") as string;
          const dispositionDate = v.disposition_date as string || null;

          // SWO detection from disposition codes (authoritative source matching BIS portal)
          const SWO_PLACE_CODES = ['L1', 'H5'];      // Codes that place an SWO
          const SWO_RESCIND_CODES = ['L2', 'L3'];     // Codes that lift an SWO
          const SWO_ENFORCE_CODES = ['H3', 'H4'];     // Codes for SWO violations
          const upperDisp = dispositionCode.toUpperCase();
          const isSWOPlaced = SWO_PLACE_CODES.includes(upperDisp);
          const isSWORescinded = SWO_RESCIND_CODES.includes(upperDisp);
          const isSWOEnforcement = SWO_ENFORCE_CODES.includes(upperDisp);
          const isSWORelated = isSWOPlaced || isSWORescinded || isSWOEnforcement;

          // For SWO complaints, "CLOSED" status means complaint was processed, NOT that SWO was lifted.
          // SWO is only lifted by L2/L3 disposition codes.
          const isResolved = dispositionCode === "I2" || dispositionCode === "C1" ||
                            dispositionCode === "A1" ||
                            (!isSWORelated && dispositionDate !== null);

          const category = (v.complaint_category || "") as string;
          const status_desc = (v.status || "") as string;
          const descRaw = [
            category,
            v.unit ? `Unit: ${v.unit}` : null,
            v.special_condition ? `Special: ${v.special_condition}` : null,
            v.comments ? `${v.comments}` : null,
          ].filter(Boolean).join(" — ");

          const dispositionComments = (v.disposition_comments || v.inspection_disposition_comments || "") as string;
          const priorityVal = (v.priority || "") as string;
          const complaintNumStr = String(complaintNum);

          violations.push({
            agency: "DOB",
            violation_number: `COMP-${complaintNum}`,
            issued_date: normalizeDate(dateEntered) || dateEntered,
            hearing_date: null,
            cure_due_date: null,
            description_raw: isSWOPlaced
              ? `Partial Stop Work Order — Complaint #${complaintNum}`
              : isSWORescinded
              ? `Stop Work Order Rescinded — Complaint #${complaintNum}`
              : descRaw || `DOB Complaint #${complaintNum}`,
            property_id,
            severity: isSWOPlaced ? "critical" :
                      priorityVal === "A" ? "critical" :
                      priorityVal === "B" ? "medium" : "low",
            violation_class: category,
            violation_type: isSWOPlaced ? "Partial Stop Work Order" :
                            isSWORescinded ? "Stop Work Order Rescinded" :
                            extractViolationType(descRaw, category, "DOB"),
            is_stop_work_order: isSWOPlaced,
            is_vacate_order: false,
            penalty_amount: null,
            respondent_name: null,
            synced_at: now,
            source: "dob_complaints",
            oath_status: status_desc || null,
            status: isSWORescinded ? 'closed' : (isSWOPlaced ? 'open' : (isResolved ? 'closed' : 'open')),
            // Complaint-specific enrichment fields
            complaint_category: category || null,
            disposition_code: dispositionCode || null,
            disposition_comments: dispositionComments || null,
            priority: priorityVal || null,
            complaint_number: complaintNumStr,
          });
        }
      }

      // Update property-level SWO flag based on complaint dispositions
      if (property_id) {
        const swoFromComplaints = violations.filter(v =>
          v.source === 'dob_complaints' && v.is_stop_work_order === true
        );
        if (swoFromComplaints.length > 0) {
          await supabase
            .from('properties')
            .update({ special_status: 'stop_work_order' })
            .eq('id', property_id);
          console.log(`Set property SWO flag: ${swoFromComplaints.length} active SWO complaints found`);
        }
      }
    }

    // Fetch violations from OATH for agencies that use it
    const oathAgencies: AgencyType[] = ["FDNY", "DEP", "DOT", "DSNY", "LPC", "DOF", "DOHMH"];
    for (const agency of oathAgencies) {
      if (agenciesToSync.includes(agency)) {
        await fetchOATHViolations(agency);
      }
    }

    // ===== OATH RECONCILIATION FOR ECB VIOLATIONS =====
    // Cross-reference ECB violations with OATH hearing outcomes
    if (agenciesToSync.includes("ECB") && property_id) {
      try {
        // Get all open ECB violations for this property
        const { data: openECBViolations } = await supabase
          .from("violations")
          .select("id, violation_number, status")
          .eq("property_id", property_id)
          .eq("agency", "ECB")
          .eq("status", "open");

        if (openECBViolations && openECBViolations.length > 0) {
          console.log(`OATH Reconciliation: Checking ${openECBViolations.length} open ECB violations`);
          
          for (const ecbViol of openECBViolations) {
            try {
              // Query OATH by violation_number (ECB summons number)
              const oathData = await safeFetch(
                `${NYC_OPEN_DATA_ENDPOINTS.OATH_HEARINGS}?ticket_number=${encodeURIComponent(ecbViol.violation_number)}&$limit=5&$order=hearing_date DESC`,
                `OATH_RECON/${ecbViol.violation_number}`
              );

              if (oathData.length > 0) {
                const latest = oathData[0] as Record<string, unknown>;
                
                const hearingStatus = (latest.hearing_status || '') as string;
                const hearingResult = (latest.hearing_result || '') as string;
                const disposition = hearingResult || hearingStatus;
                const hearingDate = latest.hearing_date ? (latest.hearing_date as string).split('T')[0] : null;
                const penaltyImposed = latest.penalty_imposed ? parseFloat(latest.penalty_imposed as string) : null;
                const amountPaid = latest.total_amount_paid ? parseFloat(latest.total_amount_paid as string) : null;
                const balanceDue = latest.amount_due ? parseFloat(latest.amount_due as string) : null;

                // Upsert into oath_hearings
                const { error: oathUpsertErr } = await supabase
                  .from("oath_hearings")
                  .upsert({
                    summons_number: ecbViol.violation_number,
                    hearing_date: hearingDate,
                    hearing_status: hearingStatus,
                    disposition: disposition,
                    disposition_date: hearingDate,
                    penalty_amount: penaltyImposed,
                    amount_paid: amountPaid,
                    balance_due: balanceDue,
                    penalty_paid: (balanceDue !== null && balanceDue <= 0) || false,
                    violation_id: ecbViol.id,
                    property_id,
                    last_synced_at: now,
                    raw_data: latest,
                  }, { onConflict: 'summons_number' });
                
                if (oathUpsertErr) {
                  console.error(`OATH upsert error for ${ecbViol.violation_number}:`, oathUpsertErr);
                } else {
                  console.log(`  OATH hearing saved for ${ecbViol.violation_number}: ${disposition}`);
                }

                // Auto-close if dismissed or not guilty
                const dispositionUpper = disposition.toUpperCase();
                if (dispositionUpper.includes('DISMISSED') || dispositionUpper.includes('NOT GUILTY') || 
                    dispositionUpper.includes('WRITTEN OFF') || dispositionUpper.includes('VACATED')) {
                  await supabase
                    .from("violations")
                    .update({
                      status: 'closed',
                      disposition_code: disposition,
                      disposition_comments: `OATH: ${disposition}`,
                    })
                    .eq("id", ecbViol.id);

                  console.log(`  OATH auto-closed ECB ${ecbViol.violation_number}: ${disposition}`);
                } else {
                  // Update OATH status on the violation even if not closing
                  const oathStatusStr = [hearingStatus, hearingResult].filter(Boolean).join(' | ');
                  if (oathStatusStr) {
                    await supabase
                      .from("violations")
                      .update({
                        oath_status: oathStatusStr,
                        penalty_amount: penaltyImposed ?? undefined,
                        amount_paid: amountPaid ?? undefined,
                        balance_due: balanceDue ?? undefined,
                      })
                      .eq("id", ecbViol.id);
                  }
                }
              }

              // Rate limit: small delay between OATH lookups
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (oathErr) {
              console.error(`OATH reconciliation error for ${ecbViol.violation_number}:`, oathErr);
            }
          }
        }
      } catch (oathReconcileErr) {
        console.error("OATH reconciliation error:", oathReconcileErr);
      }
    }

    // Deduplicate by composite key: agency + violation_number
    // Different agencies can have overlapping violation numbers
    const uniqueViolations = Array.from(
      new Map(violations.map((v) => [`${v.agency}:${v.violation_number}`, v])).values()
    );

    console.log(`Total unique violations: ${uniqueViolations.length}`);

    let newViolationsCount = 0;
    let criticalCount = 0;
    let propertyAddress = "";
    let ownerPhone = "";

    // Get property info for SMS
    if (property_id) {
      const { data: propertyData } = await supabase
        .from("properties")
        .select("address, owner_phone, sms_enabled")
        .eq("id", property_id)
        .single();

      if (propertyData) {
        propertyAddress = propertyData.address || "";
        ownerPhone = propertyData.owner_phone || "";
      }
    }

    // Insert new violations + refresh status for existing ones
    if (uniqueViolations.length > 0 && property_id) {
      // We refresh existing records every sync so OATH "Written Off" (etc.) actually updates counters.
      const { data: existingViolations, error: existingError } = await supabase
        .from("violations")
        .select("id, violation_number, agency")
        .eq("property_id", property_id);

      if (existingError) {
        console.error("Error fetching existing violations:", existingError);
      }

      // Use composite key for matching existing violations
      const existingMap = new Map(
        (existingViolations || []).map((v) => [`${v.agency}:${v.violation_number}`, v.id] as const)
      );

       const newViolations = uniqueViolations.filter(
         (v) => !existingMap.has(`${v.agency}:${v.violation_number}`)
       );

       const existingToUpdate = uniqueViolations.filter((v) =>
         existingMap.has(`${v.agency}:${v.violation_number}`)
       );

       console.log(
         `Existing violations in DB: ${existingMap.size}. New: ${newViolations.length}. Refreshing existing: ${existingToUpdate.length}.`
       );

      newViolationsCount = newViolations.length;
      criticalCount = uniqueViolations.filter(
        (v) => v.is_stop_work_order || v.is_vacate_order || v.severity === "critical"
      ).length;

      // Insert new — source IS a valid DB column, keep it
      if (newViolations.length > 0) {
        const violationsToInsert = newViolations;

        const { error: insertError } = await supabase
          .from("violations")
          .upsert(violationsToInsert, {
            onConflict: 'property_id,violation_number,agency',
            ignoreDuplicates: false,
          });

        if (insertError) {
          console.error("Error inserting violations:", insertError);
        } else {
          console.log(`Inserted ${newViolations.length} new violations`);
        }
      }

      // Update existing (status + oath_status + complaint fields + synced_at, etc.)
      if (existingToUpdate.length > 0) {
        const updateResults = await Promise.all(
          existingToUpdate.map(async (v) => {
            const id = existingMap.get(`${v.agency}:${v.violation_number}`);
            if (!id) return { ok: true };

            const { error } = await supabase
              .from("violations")
              .update({
                agency: v.agency,
                issued_date: v.issued_date,
                hearing_date: v.hearing_date,
                cure_due_date: v.cure_due_date,
                description_raw: v.description_raw,
                severity: v.severity,
                violation_class: v.violation_class,
                violation_type: v.violation_type,
                is_stop_work_order: v.is_stop_work_order,
                is_vacate_order: v.is_vacate_order,
                penalty_amount: v.penalty_amount,
                respondent_name: v.respondent_name,
                synced_at: v.synced_at,
                oath_status: v.oath_status ?? null,
                status: v.status,
                source: v.source ?? null,
                // Complaint-specific fields
                complaint_category: v.complaint_category ?? null,
                disposition_code: v.disposition_code ?? null,
                disposition_comments: v.disposition_comments ?? null,
                priority: v.priority ?? null,
                complaint_number: v.complaint_number ?? null,
              })
              .eq("id", id);

            if (error) {
              console.error(
                `Error updating violation ${v.violation_number} (${v.agency}):`,
                error
              );
              return { ok: false };
            }

            return { ok: true };
          })
        );

        const failed = updateResults.filter((r) => !r.ok).length;
        console.log(
          `Updated ${existingToUpdate.length - failed}/${existingToUpdate.length} existing violations with latest OATH/status data`
        );
      }

      // Update property last_synced_at
      await supabase
        .from("properties")
        .update({ last_synced_at: now })
        .eq("id", property_id);

      // === Auto-populate owner_name from PLUTO if not already set ===
      if (bin) {
        const { data: propCheck } = await supabase
          .from("properties")
          .select("owner_name")
          .eq("id", property_id)
          .single();

        if (!propCheck?.owner_name) {
          try {
            const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=bin='${bin}'&$limit=1&$select=ownername`;
            const plutoResp = await fetch(plutoUrl);
            if (plutoResp.ok) {
              const plutoData = await plutoResp.json();
              if (plutoData.length > 0 && plutoData[0].ownername) {
                await supabase
                  .from("properties")
                  .update({ owner_name: plutoData[0].ownername })
                  .eq("id", property_id);
                console.log(`Owner name populated from PLUTO: ${plutoData[0].ownername}`);
              }
            }
          } catch (e) {
            console.warn("PLUTO owner lookup failed:", e);
          }

          // Fallback: use owner from the most recent application if PLUTO didn't work
          const { data: propRecheck } = await supabase
            .from("properties")
            .select("owner_name")
            .eq("id", property_id)
            .single();

          if (!propRecheck?.owner_name) {
            const { data: latestApp } = await supabase
              .from("applications")
              .select("owner_name")
              .eq("property_id", property_id)
              .not("owner_name", "is", null)
              .order("filing_date", { ascending: false })
              .limit(1)
              .single();

            if (latestApp?.owner_name) {
              await supabase
                .from("properties")
                .update({ owner_name: latestApp.owner_name })
                .eq("id", property_id);
              console.log(`Owner name populated from latest application: ${latestApp.owner_name}`);
            }
          }
        }
      }

      // Log activity
      const activityDescription = newViolationsCount > 0
        ? `Found ${newViolationsCount} new violation${newViolationsCount > 1 ? 's' : ''} from NYC Open Data`
        : 'No new violations found';

      await supabase.from("property_activity_log").insert({
        property_id,
        activity_type: "sync",
        title: `Violation Sync Completed`,
        description: activityDescription,
        metadata: {
          agencies_synced: agenciesToSync.join(", "),
          total_found: uniqueViolations.length,
          new_violations: newViolationsCount,
          critical_count: criticalCount,
        },
      });

      // Log individual new violations (first 5)
      if (newViolationsCount > 0) {
        const violationLogs = newViolations.slice(0, 5).map(v => ({
          property_id,
          activity_type: "violation_added",
          title: `New ${v.agency} Violation`,
          description: v.description_raw?.substring(0, 200) || `Violation #${v.violation_number}`,
          metadata: {
            violation_number: v.violation_number,
            agency: v.agency,
            issued_date: v.issued_date,
          },
        }));

        await supabase.from("property_activity_log").insert(violationLogs);
      }

      // Send SMS alert if enabled and new violations found
      if (send_sms_alert !== false && newViolationsCount > 0 && ownerPhone) {
        let smsMessage = `🚨 ${newViolationsCount} new violation${newViolationsCount > 1 ? 's' : ''} found at ${propertyAddress}`;

        if (criticalCount > 0) {
          smsMessage += ` ⚠️ ${criticalCount} CRITICAL`;
        }

        smsMessage += `. Agencies: ${agenciesToSync.join(", ")}. Log in to review.`;

        await sendSMSAlert(supabaseUrl, supabaseServiceKey, ownerPhone, smsMessage);

        // Log SMS sent
        await supabase.from("property_activity_log").insert({
          property_id,
          activity_type: "sms_sent",
          title: "SMS Alert Sent",
          description: `Notified owner about ${newViolationsCount} new violations`,
          metadata: { to: ownerPhone.slice(-4) },
        });
      }
    }

    // ===== APPLICATIONS SYNC =====
    const applicationRecords: Array<{
      property_id: string;
      application_number: string;
      application_type: string;
      agency: string;
      source: string;
      status: string | null;
      filing_date: string | null;
      approval_date: string | null;
      expiration_date: string | null;
      job_type: string | null;
      work_type: string | null;
      description: string | null;
      applicant_name: string | null;
      owner_name: string | null;
      estimated_cost: number | null;
      stories: number | null;
      dwelling_units: number | null;
      floor_area: number | null;
      raw_data?: Record<string, unknown> | null;
    }> = [];

    // Fetch DOB BIS Job Application Filings
    if (bin) {
      const [bisJobs, dobNowBuild, dobNowLimitedAlt, dobNowElectrical, dobNowElevator, permitIssuanceData] = await Promise.all([
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_BIS_JOBS}?bin__=${bin}&$limit=200&$order=latest_action_date DESC`, "DOB_BIS_JOBS"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_NOW_BUILD}?bin=${bin}&$limit=200&$order=filing_date DESC`, "DOB_NOW_BUILD"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_NOW_LIMITED_ALT}?location_bin=${bin}&$limit=200&$order=filing_date DESC`, "DOB_NOW_LIMITED_ALT"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_NOW_ELECTRICAL}?bin=${bin}&$limit=200&$order=filing_date DESC`, "DOB_NOW_ELECTRICAL"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_NOW_ELEVATOR}?bin=${bin}&$limit=200&$order=filing_date DESC`, "DOB_NOW_ELEVATOR"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_PERMIT_ISSUANCE}?bin__=${bin}&$limit=2000&$order=issuance_date DESC`, "DOB_PERMIT_ISSUANCE"),
      ]);

      console.log(`Found ${bisJobs.length} BIS jobs, ${dobNowBuild.length} Build, ${dobNowLimitedAlt.length} Limited Alt, ${dobNowElectrical.length} Electrical, ${dobNowElevator.length} Elevator apps, ${permitIssuanceData.length} permit issuance records`);

      // Group permit issuance records by parent job number
      const permitsByJob = new Map<string, Array<Record<string, unknown>>>();
      for (const p of permitIssuanceData as Record<string, unknown>[]) {
        const jobKey = String(p.job__ || '');
        if (!jobKey) continue;
        if (!permitsByJob.has(jobKey)) permitsByJob.set(jobKey, []);
        permitsByJob.get(jobKey)!.push(p);
      }

      // ── Step 1: Deduplicate BIS rows by job__ + doc__ (keep latest dobrundate) ──
      const bisDeduped = new Map<string, Record<string, unknown>>();
      for (const j of bisJobs as Record<string, unknown>[]) {
        const jobNum = j.job__ as string;
        const docNum = j.doc__ as string || '01';
        if (!jobNum) continue;
        const key = `${jobNum}-${docNum}`;
        const existing = bisDeduped.get(key);
        if (existing) {
          // Parse MM/DD/YYYY dates properly — string comparison fails for this format
          const parseRunDate = (d: unknown): number => {
            const s = String(d || '');
            const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
            return m ? new Date(+m[3], +m[1] - 1, +m[2]).getTime() : 0;
          };
          if (parseRunDate(j.dobrundate) > parseRunDate(existing.dobrundate)) {
            bisDeduped.set(key, j);
          }
        } else {
          bisDeduped.set(key, j);
        }
      }

      // ── Step 2: Group deduplicated rows by job number ──
      const bisJobGroups = new Map<string, Record<string, unknown>[]>();
      for (const row of bisDeduped.values()) {
        const jobNum = row.job__ as string;
        if (!bisJobGroups.has(jobNum)) bisJobGroups.set(jobNum, []);
        bisJobGroups.get(jobNum)!.push(row);
      }

      console.log(`BIS: ${bisJobs.length} raw rows → ${bisDeduped.size} deduped → ${bisJobGroups.size} unique jobs`);

      // ── Step 3: Build one application record per job ──
      for (const [jobNum, docs] of bisJobGroups) {
        // Sort docs by doc number ascending; Doc 01 is primary
        docs.sort((a, b) => String(a.doc__ || '01').localeCompare(String(b.doc__ || '01')));
        const primary = docs[0]; // Doc 01 (or lowest)

        const jobType = (primary.job_type as string) || null;
        const jobTypeLabel = jobType === 'NB' ? 'New Building' :
                            jobType === 'A1' ? 'Alteration Type 1' :
                            jobType === 'A2' ? 'Alteration Type 2' :
                            jobType === 'A3' ? 'Alteration Type 3' :
                            jobType === 'DM' ? 'Demolition' :
                            jobType === 'SG' ? 'Sign' :
                            jobType || 'Job Filing';

        // Use primary doc for status (already deduped to latest dobrundate)
        // Check withdrawal_flag first, then fall back to description text pattern
        const hasWithdrawalFlag = primary.withdrawal_flag && primary.withdrawal_flag !== '0' && primary.withdrawal_flag !== 'N';
        const descriptionText = String(primary.job_description || '').trim();
        const hasWithdrawnInDescription = /^JOB WITHDRAWN/i.test(descriptionText);

        const rawJobStatus = (primary.job_status as string) || '';
        const appStatus: string | null = (hasWithdrawalFlag || hasWithdrawnInDescription)
          ? 'Withdrawn'
          : rawJobStatus || (primary.latest_action_date ? 'Filed' : null);

        // ── Build bis_documents array ──
        const bisDocuments = docs.map(d => {
          const docNum = String(d.doc__ || '01');
          // Derive work_type from flag fields
          const workParts: string[] = [];
          if (d.other_description || d.job_description) workParts.push(String(d.other_description || d.job_description || ''));
          if (d.plumbing && String(d.plumbing).toUpperCase() === 'X') workParts.push('Plumbing');
          if (d.mechanical && String(d.mechanical).toUpperCase() === 'X') workParts.push('Mechanical');
          if (d.sprinkler && String(d.sprinkler).toUpperCase() === 'X') workParts.push('Sprinkler');
          if (d.boiler && String(d.boiler).toUpperCase() === 'X') workParts.push('Boiler');
          if (d.fuel_burning && String(d.fuel_burning).toUpperCase() === 'X') workParts.push('Fuel Burning');
          if (d.fuel_storage && String(d.fuel_storage).toUpperCase() === 'X') workParts.push('Fuel Storage');
          if (d.standpipe && String(d.standpipe).toUpperCase() === 'X') workParts.push('Standpipe');
          if (d.fire_alarm && String(d.fire_alarm).toUpperCase() === 'X') workParts.push('Fire Alarm');
          if (d.equipment_work && String(d.equipment_work).toUpperCase() === 'X') workParts.push('Equipment');
          if (d.fire_suppression && String(d.fire_suppression).toUpperCase() === 'X') workParts.push('Fire Suppression');
          if (d.curb_cut && String(d.curb_cut).toUpperCase() === 'X') workParts.push('Curb Cut');

          const docEntry: Record<string, unknown> = {
            doc_number: docNum,
            applicant_name: (d.applicant_s_first_name && d.applicant_s_last_name)
              ? `${d.applicant_s_first_name} ${d.applicant_s_last_name}`.trim()
              : null,
            applicant_professional_title: d.applicant_professional_title || null,
            applicant_license_number: d.applicant_license__ || null,
            description: String(d.job_description || ''),
            work_type: workParts.join(', ') || null,
            job_status: d.job_status || null,
            job_status_descrp: d.job_status_descrp || null,
            permits: [] as Array<Record<string, unknown>>,
          };
          return docEntry;
        });

        // ── Step 4: Merge permit data into bis_documents ──
        const jobPermits = permitsByJob.get(String(jobNum)) || [];
        // Group permits by doc number
        const permitsByDoc = new Map<string, Array<Record<string, unknown>>>();
        for (const p of jobPermits) {
          const pDoc = String(p.job_doc___ || '01');
          if (!permitsByDoc.has(pDoc)) permitsByDoc.set(pDoc, []);
          permitsByDoc.get(pDoc)!.push(p);
        }

        for (const bisDoc of bisDocuments) {
          const docPermits = permitsByDoc.get(bisDoc.doc_number as string) || [];
          // Deduplicate permits by doc + sequence
          const seenPermits = new Set<string>();
          const dedupedPermits = docPermits.filter(p => {
            const key = `${String(p.job_doc___ || '')}-${String(p.permit_sequence___ || '')}`;
            if (seenPermits.has(key)) return false;
            seenPermits.add(key);
            return true;
          });

          bisDoc.permits = dedupedPermits
            .sort((a, b) => String(a.permit_sequence___ || '').localeCompare(String(b.permit_sequence___ || '')))
            .map(p => ({
              permit_type: p.permit_type || null,
              permit_status: p.permit_status || null,
              filing_status: p.filing_status || null,
              permit_sequence: p.permit_sequence___ || null,
              issuance_date: p.issuance_date ? String(p.issuance_date).split('T')[0] : null,
              expiration_date: p.expiration_date ? String(p.expiration_date).split('T')[0] : null,
              job_start_date: p.job_start_date ? String(p.job_start_date).split('T')[0] : null,
              permittee_first_name: p.permittee_s_first_name || null,
              permittee_last_name: p.permittee_s_last_name || null,
              permittee_business_name: p.permittee_s_business_name || null,
              permittee_license_type: p.permittee_s_license_type || null,
              permittee_license_number: p.permittee_s_license__ || null,
              permittee_phone: p.permittee_s_phone__ || null,
              owner_first_name: p.owner_s_first_name || null,
              owner_last_name: p.owner_s_last_name || null,
              owner_business_name: p.owner_s_business_name || null,
            }));
        }

        // Build raw_data with bis_documents + backward-compat permits array
        const rawData: Record<string, unknown> = {
          bis_documents: bisDocuments,
        };

        // Also keep flat permits array for backward compat
        if (jobPermits.length > 0) {
          const seenFlat = new Set<string>();
          rawData.permits = jobPermits.filter(p => {
            const key = `${String(p.job_doc___ || '')}-${String(p.permit_sequence___ || '')}`;
            if (seenFlat.has(key)) return false;
            seenFlat.add(key);
            return true;
          }).sort((a, b) => {
            const docA = String(a.job_doc___ || '');
            const docB = String(b.job_doc___ || '');
            if (docA !== docB) return docA.localeCompare(docB);
            return String(a.permit_sequence___ || '').localeCompare(String(b.permit_sequence___ || ''));
          }).map(p => ({
            job_doc: String(p.job_doc___ || ''),
            permit_type: p.permit_type || null,
            permit_status: p.permit_status || null,
            filing_status: p.filing_status || null,
            permit_sequence: p.permit_sequence___ || null,
            issuance_date: p.issuance_date ? String(p.issuance_date).split('T')[0] : null,
            expiration_date: p.expiration_date ? String(p.expiration_date).split('T')[0] : null,
            job_start_date: p.job_start_date ? String(p.job_start_date).split('T')[0] : null,
            permittee_first_name: p.permittee_s_first_name || null,
            permittee_last_name: p.permittee_s_last_name || null,
            permittee_business_name: p.permittee_s_business_name || null,
            permittee_license_type: p.permittee_s_license_type || null,
            permittee_license_number: p.permittee_s_license__ || null,
            permittee_phone: p.permittee_s_phone__ || null,
            owner_first_name: p.owner_s_first_name || null,
            owner_last_name: p.owner_s_last_name || null,
            owner_business_name: p.owner_s_business_name || null,
          }));
        }

        applicationRecords.push({
          property_id,
          application_number: String(jobNum),
          application_type: jobTypeLabel,
          agency: 'DOB',
          source: 'DOB BIS',
          status: appStatus,
          filing_date: primary.pre__filing_date ? (primary.pre__filing_date as string).split('T')[0] :
                       primary.latest_action_date ? (primary.latest_action_date as string).split('T')[0] : null,
          approval_date: primary.approved_date ? (primary.approved_date as string).split('T')[0] :
                         primary.fully_permitted_date ? (primary.fully_permitted_date as string).split('T')[0] : null,
          expiration_date: primary.job_status_descrp?.toString().toLowerCase().includes('expired') ? 
                          (primary.latest_action_date as string)?.split('T')[0] || null : null,
          job_type: jobType,
          work_type: (primary.building_type as string) || null,
          description: [
            primary.job_description,
            primary.building_type ? `Building Type: ${primary.building_type}` : null,
          ].filter(Boolean).join(' — ') || null,
          applicant_name: (primary.applicant_s_first_name && primary.applicant_s_last_name)
            ? `${primary.applicant_s_first_name} ${primary.applicant_s_last_name}`.trim()
            : null,
          owner_name: (primary.owner_s_first_name && primary.owner_s_last_name)
            ? `${primary.owner_s_first_name} ${primary.owner_s_last_name}`.trim()
            : (primary.owner_s_business_name as string) || null,
          estimated_cost: primary.initial_cost ? parseFloat(primary.initial_cost as string) : null,
          stories: primary.proposed_no_of_stories ? parseInt(primary.proposed_no_of_stories as string) : null,
          dwelling_units: primary.proposed_dwelling_units ? parseInt(primary.proposed_dwelling_units as string) : null,
          floor_area: primary.proposed_zoning_sqft ? parseFloat(primary.proposed_zoning_sqft as string) : null,
          raw_data: rawData,
        });
      }

      for (const a of dobNowBuild as Record<string, unknown>[]) {
        const appNum = (a.job_filing_number || a.dobrunjobnumber) as string;
        if (!appNum) continue;

        const jobType = (a.job_type as string) || null;
        const workOnFloor = (a.work_on_floor as string) || null;
        const aptCondo = (a.apt_condo_no_s as string) || null;

        const descParts = [
          workOnFloor,
          a.building_type ? `Building Type: ${a.building_type}` : null,
        ].filter(Boolean);

        applicationRecords.push({
          property_id,
          application_number: String(appNum),
          application_type: jobType || 'DOB NOW Filing',
          agency: 'DOB',
          source: 'DOB NOW Build',
          status: (a.filing_status as string) || (a.current_status_date ? 'Filed' : null),
          filing_date: a.filing_date ? (a.filing_date as string).split('T')[0] : null,
          approval_date: a.approved_date ? (a.approved_date as string).split('T')[0] : null,
          expiration_date: a.expiration_date ? (a.expiration_date as string).split('T')[0] : null,
          job_type: jobType,
          work_type: (a.building_type as string) || null,
          description: descParts.join(' — ') || null,
          applicant_name: (a.applicant_first_name && a.applicant_last_name)
            ? `${a.applicant_first_name} ${a.applicant_last_name}`.trim()
            : null,
          owner_name: (a.owner_s_business_name as string) || 
            ((a.owner_first_name && a.owner_last_name)
              ? `${a.owner_first_name} ${a.owner_last_name}`.trim()
              : null),
          estimated_cost: a.initial_cost ? parseFloat(a.initial_cost as string) : null,
          stories: a.proposed_no_of_stories ? parseInt(a.proposed_no_of_stories as string) : null,
          dwelling_units: a.proposed_dwelling_units ? parseInt(a.proposed_dwelling_units as string) : null,
          floor_area: a.total_construction_floor_area ? parseFloat(a.total_construction_floor_area as string) : null,
          raw_data: {
            apt_condo: aptCondo,
            applicant_license: a.applicant_license || null,
            applicant_title: a.applicant_professional_title || null,
            applicant_business_name: a.applicant_business_name || null,
            applicant_phone: a.applicant_phone || null,
            applicant_email: a.applicant_email || null,
            filing_rep_name: (a.filing_representative_first_name && a.filing_representative_last_name)
              ? `${a.filing_representative_first_name} ${a.filing_representative_last_name}`.trim()
              : null,
            filing_rep_company: a.filing_representative_business_name || null,
            work_on_floor: workOnFloor,
            first_permit_date: a.first_permit_date ? (a.first_permit_date as string).split('T')[0] : null,
            special_inspection: a.specialinspectionrequirement || null,
            special_inspection_agency: a.special_inspection_agency_number || null,
            progress_inspection: a.progressinspectionrequirement || null,
            progress_inspection_agency: a.progress_inspection_agency_number || null,
            review_building_code: a.review_building_code || null,
            plumbing_work: a.plumbing_work_type === '1',
            sprinkler_work: a.sprinkler_work_type === '1',
            existing_stories: a.existing_stories || null,
            existing_height: a.existing_height || null,
            proposed_stories: a.proposed_no_of_stories || null,
            proposed_height: a.proposed_height || null,
          },
        });
      }

      // DOB NOW: Build – Limited Alteration Applications (plumbing, fire suppression, oil work, etc.)
      // Group by job_number so I1 + P1 + S1 for the same job are merged into one record
      const laaByJob = new Map<string, Record<string, unknown>[]>();
      for (const la of dobNowLimitedAlt as Record<string, unknown>[]) {
        const jobNum = la.job_number as string;
        if (!jobNum) continue;
        if (!laaByJob.has(jobNum)) laaByJob.set(jobNum, []);
        laaByJob.get(jobNum)!.push(la);
      }

      for (const [jobNum, filings] of laaByJob) {
        // Sort: I1 first, then by filing_number
        filings.sort((a, b) => {
          const aNum = String(a.filing_number || '');
          const bNum = String(b.filing_number || '');
          const aIsI = aNum.startsWith('I');
          const bIsI = bNum.startsWith('I');
          if (aIsI && !bIsI) return -1;
          if (!aIsI && bIsI) return 1;
          return aNum.localeCompare(bNum);
        });

        const i1 = filings.find(f => String(f.filing_number || '').startsWith('I'));
        const primary = i1 || filings[0];

        // Use I1 status as authoritative; if I1 is terminal, job is terminal
        const i1Status = i1 ? (i1.filing_status_name as string) || null : null;
        const primaryStatus = (primary.filing_status_name as string) || null;
        const status = i1Status || primaryStatus;

        applicationRecords.push({
          property_id,
          application_number: String(jobNum),
          application_type: (primary.work_type_name as string) || 'Limited Alteration',
          agency: 'DOB',
          source: 'DOB NOW Limited Alt',
          status,
          filing_date: primary.filing_date ? (primary.filing_date as string).split('T')[0] : null,
          approval_date: primary.permit_issued_date ? (primary.permit_issued_date as string).split('T')[0] : null,
          expiration_date: primary.permit_expiration_date ? (primary.permit_expiration_date as string).split('T')[0] : null,
          job_type: (primary.filing_type_name as string) || null,
          work_type: (primary.work_type_name as string) || null,
          description: (primary.proposed_work_summary as string) || null,
          applicant_name: null,
          owner_name: null,
          estimated_cost: null,
          stories: null,
          dwelling_units: null,
          floor_area: null,
          raw_data: {
            building_type: primary.building_type_name || null,
            inspection_type: primary.inspection_type_name || null,
            inspection_date: primary.inspection_date ? (primary.inspection_date as string).split('T')[0] : null,
            signoff_date: primary.laasign_off_date ? (primary.laasign_off_date as string).split('T')[0] : null,
            filing_count: filings.length,
            filings: filings.map(f => ({
              filing_number: f.filing_number || null,
              filing_type: f.filing_type_name || null,
              status: f.filing_status_name || null,
              permit_number: f.permit_number || null,
            })),
          },
        });
      }

      // DOB NOW: Electrical Permit Applications
      for (const el of dobNowElectrical as Record<string, unknown>[]) {
        const appNum = (el.job_filing_number || el.job_number) as string;
        if (!appNum) continue;

        applicationRecords.push({
          property_id,
          application_number: String(appNum),
          application_type: 'Electrical Permit',
          agency: 'DOB',
          source: 'DOB NOW Electrical',
          status: (el.filing_status as string) || null,
          filing_date: el.filing_date ? (el.filing_date as string).split('T')[0] : null,
          approval_date: null,
          expiration_date: null,
          job_type: (el.filing_type as string) || null,
          work_type: 'Electrical',
          description: (el.job_description as string) || null,
          applicant_name: (el.applicant_first_name && el.applicant_last_name)
            ? `${el.applicant_first_name} ${el.applicant_last_name}`.trim()
            : null,
          owner_name: (el.owner_first_name && el.owner_last_name)
            ? `${el.owner_first_name} ${el.owner_last_name}`.trim()
            : null,
          estimated_cost: null,
          stories: null,
          dwelling_units: null,
          floor_area: null,
          raw_data: {
            license_type: el.license_type || null,
            license_number: el.license_number || null,
            firm_name: el.firm_name || null,
            firm_number: el.firm_number || null,
            building_use_type: el.building_use_type || null,
            general_wiring: el.general_wiring || null,
            lighting_work: el.lighting_work || null,
            hvac_wiring: el.hvac_wiring || null,
            total_meters: el.total_meters || null,
            job_start_date: el.job_start_date ? (el.job_start_date as string).split('T')[0] : null,
            completion_date: el.completion_date ? (el.completion_date as string).split('T')[0] : null,
          },
        });
      }

      // DOB NOW: Build – Elevator Permit Applications
      for (const ev of dobNowElevator as Record<string, unknown>[]) {
        const appNum = (ev.job_filing_number || ev.job_number) as string;
        if (!appNum) continue;

        applicationRecords.push({
          property_id,
          application_number: String(appNum),
          application_type: (ev.elevatordevicetype as string) || 'Elevator Permit',
          agency: 'DOB',
          source: 'DOB NOW Elevator',
          status: (ev.filing_status as string) || null,
          filing_date: ev.filing_date ? (ev.filing_date as string).split('T')[0] : null,
          approval_date: ev.permit_entire_date ? (ev.permit_entire_date as string).split('T')[0] : null,
          expiration_date: ev.permit_expiration_date ? (ev.permit_expiration_date as string).split('T')[0] : null,
          job_type: (ev.filing_type as string) || null,
          work_type: (ev.filingstatus_or_filingincludes as string) || 'Elevator',
          description: (ev.descriptionofwork as string) || null,
          applicant_name: (ev.applicant_firstname && ev.applicant_lastname)
            ? `${ev.applicant_firstname} ${ev.applicant_lastname}`.trim()
            : null,
          owner_name: (ev.owner_businessname as string) ||
            ((ev.owner_firstname && ev.owner_lastname)
              ? `${ev.owner_firstname} ${ev.owner_lastname}`.trim()
              : null),
          estimated_cost: ev.estimated_cost ? parseFloat(ev.estimated_cost as string) : null,
          stories: ev.buildingstories ? parseInt(ev.buildingstories as string) : null,
          dwelling_units: null,
          floor_area: ev.total_construction_floor ? parseFloat(ev.total_construction_floor as string) : null,
          raw_data: {
            device_type: ev.elevatordevicetype || null,
            building_code: ev.building_code || null,
            design_professional: ev.designprofessional || null,
            design_professional_license: ev.designprofessional_license || null,
            applicant_business: ev.applicant_businessname || null,
            applicant_license: ev.applicant_license_number || null,
            asbestos_compliance: ev.asbestosabatementcompliance || null,
          },
        });
      }
    }

    // Deduplicate applications by source + application_number
    // When duplicates exist (e.g., DOB NOW I1 + P1 for same job), prefer terminal status
    const TERMINAL_STATUSES_LC = [
      'signed off', 'signed-off', 'sign-off', 'completed', 'complete',
      'co issued', 'letter of completion', 'loc issued', 'withdrawn',
      'filing withdrawn', 'disapproved', 'suspended', 'cancelled', 'cancel',
    ];
    const isTerminalStatus = (s: string | null) => {
      if (!s) return false;
      const lower = s.toLowerCase();
      return TERMINAL_STATUSES_LC.some(t => lower.includes(t));
    };

    const appMap = new Map<string, typeof applicationRecords[0]>();
    for (const a of applicationRecords) {
      const key = `${a.source}:${a.application_number}`;
      const existing = appMap.get(key);
      if (!existing) {
        appMap.set(key, a);
      } else {
        // If the existing record has a terminal status, keep it — don't overwrite with an active amendment
        if (isTerminalStatus(existing.status)) {
          // Keep existing terminal status
        } else {
          // Overwrite with newer record (or if new record is terminal, it wins)
          appMap.set(key, a);
        }
      }
    }
    const uniqueApps = Array.from(appMap.values());

    let newAppsCount = 0;
    if (uniqueApps.length > 0 && property_id) {
      const { data: existingApps } = await supabase
        .from('applications')
        .select('id, application_number, source')
        .eq('property_id', property_id);

      const existingAppKeys = new Set(
        (existingApps || []).map(a => `${a.source}:${a.application_number}`)
      );

      const newApps = uniqueApps.filter(a => !existingAppKeys.has(`${a.source}:${a.application_number}`));
      newAppsCount = newApps.length;

      console.log(`Applications: ${existingAppKeys.size} existing, ${newApps.length} new`);

      if (newApps.length > 0) {
        const { error: appInsertError } = await supabase
          .from('applications')
          .upsert(newApps, {
            onConflict: 'property_id,source,application_number',
            ignoreDuplicates: false,
          });

        if (appInsertError) {
          console.error('Error inserting applications:', appInsertError);
        } else {
          console.log(`Inserted ${newApps.length} new applications`);
        }
      }

      // Update existing applications with latest data
      const appsToUpdate = uniqueApps.filter(a => existingAppKeys.has(`${a.source}:${a.application_number}`));
      if (appsToUpdate.length > 0) {
        for (const app of appsToUpdate) {
          const existingApp = (existingApps || []).find(
            e => `${e.source}:${e.application_number}` === `${app.source}:${app.application_number}`
          );
          if (!existingApp) continue;

          const { error: updateError } = await supabase
            .from('applications')
            .update({
              status: app.status,
              approval_date: app.approval_date,
              expiration_date: app.expiration_date,
              description: app.description,
              applicant_name: app.applicant_name,
              owner_name: app.owner_name,
              estimated_cost: app.estimated_cost,
              raw_data: app.raw_data || null,
            })
            .eq('id', existingApp.id);

          if (updateError) {
            console.error(`Error updating application ${app.application_number}:`, updateError);
          }
        }
        console.log(`Updated ${appsToUpdate.length} existing applications`);
      }
    }

    // ===== CERTIFICATE OF OCCUPANCY SYNC =====
    let coFound = false;
    if (bin) {
      try {
        // Strategy 1: Check the DOB NOW CO dataset (post-2012)
        const coData = await safeFetch(
          `${NYC_OPEN_DATA_ENDPOINTS.CO}?bin=${bin}&$limit=10&$order=c_o_issue_date%20DESC`,
          "CO"
        );

        console.log(`Found ${coData.length} CO records in DOB NOW dataset for BIN ${bin}`);

        if (coData.length > 0) {
          const latest = coData[0] as Record<string, unknown>;
          const coType = (latest.issue_type || latest.job_type || '') as string;
          const issuanceDate = (latest.c_o_issue_date || '') as string;
          const jobNumber = (latest.job_number || '') as string;
          
          let coStatus = 'valid';
          if (coType.toLowerCase().includes('temporary') || coType.toLowerCase().includes('tco')) {
            const expDate = latest.expiration_dd || latest.expiration_date;
            if (expDate && new Date(expDate as string) < new Date()) {
              coStatus = 'expired_tco';
            } else {
              coStatus = 'temporary';
            }
          }

          const coMetadata = {
            source: 'DOB_NOW_CO',
            type: coType,
            issuance_date: issuanceDate ? (issuanceDate as string).split('T')[0] : null,
            job_number: jobNumber || null,
            total_records: coData.length,
            latest_raw: latest,
          };

          await supabase
            .from('properties')
            .update({ co_status: coStatus, co_data: coMetadata })
            .eq('id', property_id);

          coFound = true;
          console.log(`CO status updated from DOB NOW: ${coStatus} (type: ${coType})`);

          // Create document reference
          const { data: existingCODoc } = await supabase
            .from('property_documents')
            .select('id')
            .eq('property_id', property_id)
            .eq('document_type', 'certificate_of_occupancy')
            .limit(1);

          if (!existingCODoc || existingCODoc.length === 0) {
            const coDescription = `${coType || 'Certificate of Occupancy'} — Issued ${issuanceDate ? new Date(issuanceDate as string).toLocaleDateString() : 'N/A'}${jobNumber ? ` (Job #${jobNumber})` : ''}`;
            const dobNowUrl = `https://a810-dobnow.nyc.gov/Publish/#!/certificate/${jobNumber || bin}`;

            await supabase.from('property_documents').insert({
              property_id,
              document_name: `Certificate of Occupancy${coType ? ` (${coType})` : ''}`,
              document_type: 'certificate_of_occupancy',
              description: coDescription,
              file_url: dobNowUrl,
              file_type: 'link',
              metadata: coMetadata,
            });
            console.log(`CO document reference created (DOB NOW)`);
          }
        }

        // Strategy 2: If no CO in DOB NOW dataset, check BIS Jobs for CO status codes
        // BIS job_status: X = signed off (CO issued), H = completed, I = signed-off, J = plan exam
        if (!coFound) {
          const bisJobs = await safeFetch(
            `${NYC_OPEN_DATA_ENDPOINTS.DOB_BIS_JOBS}?bin__=${bin}&$limit=50&$order=latest_action_date%20DESC`,
            "BIS_CO_CHECK"
          );

          const BIS_CO_STATUSES: Record<string, string> = {
            'x': 'signed off',
            'h': 'completed',
            'i': 'signed off',
            'u': 'completed',
          };

          // Find CO job: ONLY NB (New Building) and A1 (Major Alteration) can receive a CO.
          // A2/A3 are minor alterations and never result in a new CO.
          // If a NB or A1 is signed off (X or I), that means a CO was issued.
          const coJob = (bisJobs as Record<string, unknown>[]).find(j => {
            const status = ((j.job_status || '') as string).toLowerCase();
            const jobType = ((j.job_type || '') as string).toUpperCase();
            const isCOJobType = jobType === 'NB' || jobType === 'A1';
            return isCOJobType && (status in BIS_CO_STATUSES);
          });

          if (coJob) {
            const jobStatus = ((coJob.job_status || '') as string).toLowerCase();
            const statusLabel = BIS_CO_STATUSES[jobStatus] || 'signed off';
            const jobNumber = (coJob.job__ || '') as string;
            const jobType = (coJob.job_type || '') as string;
            const signoffDate = (coJob.signoff_date || coJob.latest_action_date || '') as string;

            const coMetadata = {
              source: 'BIS_JOBS',
              type: `BIS ${statusLabel}`,
              job_number: jobNumber,
              job_type: jobType,
              job_status: jobStatus,
              status_label: statusLabel,
              signoff_date: signoffDate,
            };

            await supabase
              .from('properties')
              .update({ co_status: 'valid', co_data: coMetadata })
              .eq('id', property_id);

            coFound = true;
            console.log(`CO status updated from BIS Jobs: valid (${statusLabel}, Job #${jobNumber}, signoff: ${signoffDate})`);

            // Try to download actual CO PDF from BIS
            const { data: existingCODoc } = await supabase
              .from('property_documents')
              .select('id')
              .eq('property_id', property_id)
              .eq('document_type', 'certificate_of_occupancy')
              .limit(1);

            if (!existingCODoc || existingCODoc.length === 0) {
              let fileUrl = `https://a810-bisweb.nyc.gov/bisweb/COsByLocationServlet?allbin=${bin}`;
              let fileType = 'link';
              let fileSizeBytes: number | null = null;
              const coDescription = `BIS Certificate of Occupancy — Job #${jobNumber} (${jobType}), ${statusLabel} on ${signoffDate}`;

              // Attempt to fetch the CO PDF listing page and download the PDF
              try {
                // Use COsByLocationServlet which lists all COs for a BIN
                const pdfListUrl = `https://a810-bisweb.nyc.gov/bisweb/COsByLocationServlet?requestid=0&allbin=${bin}`;
                console.log(`Fetching CO PDF listing: ${pdfListUrl}`);
                
                const pdfListResp = await fetchWithTimeout(pdfListUrl, 8000);
                
                console.log(`CO listing response: ${pdfListResp.status} ${pdfListResp.statusText}`);
                
                if (pdfListResp.ok) {
                  const html = await pdfListResp.text();
                  console.log(`CO listing HTML length: ${html.length}`);
                  
                  // Find all PDF filenames - pattern like "K000310206577.PDF"
                  const pdfMatches = html.match(/[A-Z]\d+\.PDF/gi);
                  console.log(`PDF matches found: ${pdfMatches ? pdfMatches.join(', ') : 'none'}`);
                  
                  if (pdfMatches && pdfMatches.length > 0) {
                    // Use the first (or best matching) PDF
                    const pdfFilename = pdfMatches[0];
                    // The actual PDF download URL from BIS
                    const pdfUrl = `https://a810-bisweb.nyc.gov/bisweb/${pdfFilename}`;
                    
                    console.log(`Downloading CO PDF: ${pdfUrl}`);
                    
                    const pdfResp = await fetchWithTimeout(pdfUrl, 8000);
                    
                    console.log(`PDF download response: ${pdfResp.status}, content-type: ${pdfResp.headers.get('content-type')}`);
                    
                    if (pdfResp.ok) {
                      const pdfBuffer = await pdfResp.arrayBuffer();
                      const pdfBytes = new Uint8Array(pdfBuffer);
                      
                      console.log(`PDF size: ${pdfBytes.length} bytes, starts with: ${String.fromCharCode(...pdfBytes.slice(0, 4))}`);
                      
                      // Check it starts with %PDF
                      if (pdfBytes.length > 1000 && pdfBytes[0] === 0x25 && pdfBytes[1] === 0x50) {
                        const storagePath = `${property_id}/co_${jobNumber}.pdf`;
                        
                        const { error: uploadError } = await supabase.storage
                          .from('property-documents')
                          .upload(storagePath, pdfBytes, {
                            contentType: 'application/pdf',
                            upsert: true,
                          });
                        
                        if (!uploadError) {
                          const { data: urlData } = supabase.storage
                            .from('property-documents')
                            .getPublicUrl(storagePath);
                          
                          fileUrl = urlData.publicUrl || fileUrl;
                          fileType = 'application/pdf';
                          fileSizeBytes = pdfBytes.length;
                          console.log(`CO PDF uploaded to storage: ${storagePath} (${pdfBytes.length} bytes)`);
                        } else {
                          console.error('Failed to upload CO PDF:', uploadError);
                        }
                      } else {
                        console.log(`Response is not a valid PDF (${pdfBytes.length} bytes)`);
                      }
                    }
                  } else {
                    console.log('No PDF filenames found in CO listing HTML');
                  }
                }
              } catch (pdfError) {
                console.error('Error downloading CO PDF (falling back to link):', pdfError);
              }

              await supabase.from('property_documents').insert({
                property_id,
                document_name: `Certificate of Occupancy (BIS)`,
                document_type: 'certificate_of_occupancy',
                description: coDescription,
                file_url: fileUrl,
                file_type: fileType,
                file_size_bytes: fileSizeBytes,
                metadata: coMetadata,
              });
              console.log(`CO document created (type: ${fileType})`);
            }
          }

        }

        // If still no CO found, set status based on year built
        if (!coFound) {
          const { data: propData } = await supabase
            .from('properties')
            .select('year_built, co_status')
            .eq('id', property_id)
            .single();

          if (propData && (!propData.co_status || propData.co_status === 'unknown' || propData.co_status === 'missing')) {
            const yearBuilt = propData.year_built;
            const newStatus = yearBuilt && yearBuilt < 1938 ? 'pre_1938' : 'missing';
            await supabase
              .from('properties')
              .update({ co_status: newStatus })
              .eq('id', property_id);
            console.log(`No CO found in any source, status set to: ${newStatus}`);
          }
        }
      } catch (coError) {
        console.error('Error fetching CO data:', coError);
      }
    }

    // SWO detection is now handled by DOB Complaints disposition codes (L1, H5, L2, L3)
    // in the complaints processing loop above. BIS Jobs special_action_status was removed
    // because it's a historical flag that produces false positives.

    return new Response(JSON.stringify({
        success: true,
        total_found: uniqueViolations.length,
        new_violations: newViolationsCount,
        critical_count: criticalCount,
        agencies_synced: agenciesToSync,
        sms_sent: newViolationsCount > 0 && ownerPhone ? true : false,
        applications_found: uniqueApps.length,
        new_applications: newAppsCount,
        co_found: coFound,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching NYC violations:", error);
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
});
