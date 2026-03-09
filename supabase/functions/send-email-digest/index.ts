import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// ─── Severity Calculation (mirrors client-side violation-severity.ts) ───

const CRITICAL_KEYWORDS = [
  'vacate', 'stop work', 'swo', 'unsafe', 'work without permit',
  'illegal conversion', 'imminent danger', 'collapse', 'emergency',
  'no permit', 'cease', 'life safety', 'fire escape'
];
const HIGH_KEYWORDS = [
  'safety', 'structural', 'facade', 'll11', 'local law 11',
  'll196', 'local law 196', 'scaffold', 'sidewalk shed',
  'parapet', 'exterior wall', 'retaining wall', 'failure to maintain',
  'gas', 'boiler', 'elevator', 'sprinkler', 'standpipe',
  'means of egress', 'fire alarm', 'fire suppression'
];
const MEDIUM_KEYWORDS = [
  'complaint', 'quality of life', 'permit', 'noise',
  'construction fence', 'signage', 'certificate of occupancy',
  'plumbing', 'electrical', 'hvac', 'maintenance',
  'zoning', 'alteration', 'administrative'
];

interface SeverityInfo {
  level: string;
  color: string;
  bgColor: string;
  explanation: string;
  action: string;
}

function calculateSeverity(v: {
  description_raw?: string | null;
  violation_type?: string | null;
  violation_class?: string | null;
  agency?: string;
  is_stop_work_order?: boolean;
  is_vacate_order?: boolean;
  penalty_amount?: number | null;
  severity?: string | null;
}): SeverityInfo {
  if (v.is_stop_work_order || v.is_vacate_order) {
    return {
      level: 'Critical',
      color: '#dc2626',
      bgColor: '#fef2f2',
      explanation: v.is_stop_work_order
        ? 'Stop Work Order — all construction activity must halt immediately. Continuing risks criminal charges.'
        : 'Vacate Order — the building or area is deemed unsafe. Immediate evacuation required.',
      action: v.is_stop_work_order
        ? 'File permit correction within 48 hours. Schedule DOB inspection to lift order. Do NOT resume work.'
        : 'Evacuate affected area. Engage licensed engineer for assessment. File for re-occupancy after DOB inspection.'
    };
  }

  const text = [v.description_raw || '', v.violation_type || '', v.violation_class || '', v.severity || ''].join(' ').toLowerCase();

  if (CRITICAL_KEYWORDS.some(k => text.includes(k))) {
    return {
      level: 'Critical',
      color: '#dc2626', bgColor: '#fef2f2',
      explanation: 'Serious safety concern or unauthorized work requiring immediate attention.',
      action: 'Address within 48 hours. File corrective documents with the issuing agency. Failure to act may result in escalated penalties.'
    };
  }
  if (HIGH_KEYWORDS.some(k => text.includes(k)) || v.agency === 'FDNY') {
    return {
      level: 'High',
      color: '#ea580c', bgColor: '#fff7ed',
      explanation: 'Relates to building safety systems, structural integrity, or fire safety — typically carries significant penalties.',
      action: 'Schedule inspection or corrective action within 1–2 weeks. Engage a licensed PE/RA if structural or facade-related.'
    };
  }
  if (MEDIUM_KEYWORDS.some(k => text.includes(k))) {
    return {
      level: 'Medium',
      color: '#ca8a04', bgColor: '#fefce8',
      explanation: 'Involves permits, complaints, or maintenance. Not immediately dangerous, but may escalate if unresolved.',
      action: 'Prepare response before hearing date. File necessary permits or corrections.'
    };
  }
  if (v.penalty_amount && v.penalty_amount >= 5000) {
    return {
      level: 'Medium',
      color: '#ca8a04', bgColor: '#fefce8',
      explanation: `Carries a significant penalty of $${v.penalty_amount.toLocaleString()}. Prompt resolution may reduce exposure.`,
      action: 'Review penalty and consider filing for hearing to negotiate reduction.'
    };
  }
  return {
    level: 'Low',
    color: '#2563eb', bgColor: '#eff6ff',
    explanation: 'Lower-priority violation. Should still be addressed but poses minimal immediate risk.',
    action: 'Add to compliance queue. Address during next scheduled maintenance or before permit renewals.'
  };
}

// ─── Email Helpers ───

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function buildEmailHtml(data: {
  userName: string;
  properties: Array<{
    address: string;
    violations: Array<{
      violation_number: string;
      description_raw: string;
      severity_info: SeverityInfo;
      agency: string;
      issued_date: string;
      hearing_date: string | null;
    }>;
    upcomingHearings: Array<{ violation_number: string; hearing_date: string; agency: string; description_raw: string }>;
    expiringDocs: Array<{ document_name: string; expiration_date: string; document_type: string }>;
    applications: Array<{ application_number: string; application_type: string; status: string; agency: string }>;
    insuranceAlerts: Array<{ tenant_name: string; policy_type: string; expiration_date: string; days_remaining: number; is_expired: boolean }>;
  }>;
  appUrl: string;
  totalViolations: number;
  totalHearings: number;
  totalExpiring: number;
  totalApplications: number;
  totalInsuranceAlerts: number;
  digestDate: string;
}): string {
  const { userName, properties, appUrl, totalViolations, totalHearings, totalExpiring, totalApplications, totalInsuranceAlerts, digestDate } = data;

  const propertySections = properties.map(prop => {
    const hasContent = prop.violations.length > 0 || prop.upcomingHearings.length > 0 || prop.expiringDocs.length > 0 || prop.applications.length > 0 || prop.insuranceAlerts.length > 0;
    if (!hasContent) return "";

    const violationCards = prop.violations.map(v => {
      const s = v.severity_info;
      return `
      <div style="background:${s.bgColor};border-left:4px solid ${s.color};border-radius:8px;padding:16px 18px;margin-bottom:12px;">
        <div style="margin-bottom:8px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td><span style="font-weight:700;color:#1e293b;font-size:14px;">${v.agency} — ${v.violation_number}</span></td>
            <td style="text-align:right;"><span style="background:${s.color};color:white;padding:3px 12px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase;">${s.level}</span></td>
          </tr></table>
        </div>
        <p style="color:#475569;font-size:13px;margin:0 0 10px 0;line-height:1.5;">${(v.description_raw || "No description").substring(0, 200)}</p>
        
        <!-- What This Means -->
        <div style="background:rgba(255,255,255,0.6);border-radius:6px;padding:10px 14px;margin-bottom:8px;">
          <p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px 0;">What This Means</p>
          <p style="color:#334155;font-size:12px;margin:0;line-height:1.5;">${s.explanation}</p>
        </div>
        
        <!-- Recommended Action -->
        <div style="background:rgba(255,255,255,0.6);border-radius:6px;padding:10px 14px;margin-bottom:8px;">
          <p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px 0;">Recommended Action</p>
          <p style="color:#334155;font-size:12px;margin:0;line-height:1.5;">${s.action}</p>
        </div>
        
        <div style="color:#94a3b8;font-size:12px;margin-top:6px;">Issued: ${formatDate(v.issued_date)}${v.hearing_date ? ` · Hearing: <strong style="color:#ea580c;">${formatDate(v.hearing_date)}</strong>` : ""}</div>
      </div>
    `;
    }).join("");

    const hearingCards = prop.upcomingHearings.map(h => `
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <div style="font-weight:600;color:#92400e;font-size:14px;margin-bottom:4px;">⚖️ Hearing: ${formatDate(h.hearing_date)}</div>
        <p style="color:#78350f;font-size:13px;margin:0;">${h.agency} ${h.violation_number} — ${(h.description_raw || "").substring(0, 100)}</p>
      </div>
    `).join("");

    const expiringCards = prop.expiringDocs.map(d => `
      <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <div style="font-weight:600;color:#991b1b;font-size:14px;margin-bottom:4px;">📄 Expiring: ${d.document_name}</div>
        <p style="color:#7f1d1d;font-size:13px;margin:0;">${d.document_type} · Expires ${formatDate(d.expiration_date)}</p>
      </div>
    `).join("");

    const appCards = prop.applications.map(a => `
      <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <div style="font-weight:600;color:#166534;font-size:14px;margin-bottom:4px;">📋 ${a.agency} — ${a.application_number}</div>
        <p style="color:#15803d;font-size:13px;margin:0;">${a.application_type} · Status: ${a.status || "Pending"}</p>
      </div>
    `).join("");

    const insuranceCards = prop.insuranceAlerts.map(i => `
      <div style="background:${i.is_expired ? '#fef2f2' : '#fff7ed'};border-left:4px solid ${i.is_expired ? '#ef4444' : '#f59e0b'};border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <div style="font-weight:600;color:${i.is_expired ? '#991b1b' : '#92400e'};font-size:14px;margin-bottom:4px;">🛡️ ${i.tenant_name} — ${i.policy_type.replace(/_/g, ' ')}</div>
        <p style="color:${i.is_expired ? '#7f1d1d' : '#78350f'};font-size:13px;margin:0;">${i.is_expired ? 'EXPIRED' : `Expires in ${i.days_remaining} day${i.days_remaining !== 1 ? 's' : ''}`} · ${formatDate(i.expiration_date)}</p>
      </div>
    `).join("");

    return `
      <div style="background:#ffffff;border-radius:12px;padding:28px;margin-bottom:20px;border:1px solid #e2e8f0;">
        <h2 style="color:#0f172a;font-size:18px;font-weight:700;margin:0 0 16px 0;padding-bottom:12px;border-bottom:2px solid #f1f5f9;">
          🏢 ${prop.address}
        </h2>
        ${violationCards ? `<h3 style="color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px 0;">Active Violations</h3>${violationCards}` : ""}
        ${hearingCards ? `<h3 style="color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 10px 0;">Upcoming Hearings</h3>${hearingCards}` : ""}
        ${expiringCards ? `<h3 style="color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 10px 0;">Expiring Documents</h3>${expiringCards}` : ""}
        ${appCards ? `<h3 style="color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 10px 0;">Application Updates</h3>${appCards}` : ""}
        ${insuranceCards ? `<h3 style="color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 10px 0;">Insurance Alerts</h3>${insuranceCards}` : ""}
      </div>
    `;
  }).filter(Boolean).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CitiSignal Weekly Digest</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
  <div style="max-width:720px;margin:0 auto;padding:32px 16px;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px 16px 0 0;padding:32px 32px;text-align:center;">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
        <td style="background:#334155;border-radius:10px;padding:8px;vertical-align:middle;width:40px;height:40px;text-align:center;">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNC45IDE5LjFDMSAxNS4yIDEgOC44IDQuOSA0LjkiPjwvcGF0aD48cGF0aCBkPSJNNy44IDE2LjJjLTIuMy0yLjMtMi4zLTYuMSAwLTguNSI+PC9wYXRoPjxwYXRoIGQ9Ik0xNi4yIDcuOGMyLjMgMi4zIDIuMyA2LjEgMCA4LjUiPjwvcGF0aD48cGF0aCBkPSJNMTkuMSA0LjljMy45IDMuOSAzLjkgMTAuMiAwIDE0LjEiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIyIj48L2NpcmNsZT48L3N2Zz4K" alt="CitiSignal" style="width:24px;height:24px;display:block;margin:0 auto;" />
        </td>
        <td style="padding-left:12px;vertical-align:middle;"><span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">CitiSignal</span></td>
      </tr></table>
      <div style="color:#94a3b8;font-size:14px;margin-top:6px;">Weekly Compliance Digest</div>
      <div style="color:#64748b;font-size:12px;margin-top:4px;">${digestDate}</div>
    </div>

    <!-- Stats Bar -->
    <div style="background:#ffffff;padding:20px 32px;border-bottom:1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:28px;font-weight:800;color:#dc2626;">${totalViolations}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Violations</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:28px;font-weight:800;color:#f59e0b;">${totalHearings}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Hearings</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:28px;font-weight:800;color:#ef4444;">${totalExpiring}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Expiring</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:28px;font-weight:800;color:#22c55e;">${totalApplications}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Applications</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Greeting -->
    <div style="background:#ffffff;padding:24px 32px 16px;border-bottom:1px solid #f1f5f9;">
      <p style="color:#1e293b;font-size:16px;margin:0;">Hi ${userName || "there"},</p>
      <p style="color:#64748b;font-size:14px;margin:8px 0 0;">Here's your weekly compliance summary across all properties.</p>
    </div>

    <!-- Property Sections -->
    <div style="background:#f1f5f9;padding:28px 24px;">
      ${propertySections || '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:14px;">✅ All clear — no active issues this week!</div>'}
    </div>

    <!-- Dashboard CTA -->
    <div style="background:#ffffff;padding:28px 32px;text-align:center;border-top:1px solid #e2e8f0;">
      <a href="${appUrl}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#0f172a,#334155);color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
        View Full Dashboard →
      </a>
    </div>

    <!-- GLE Help CTA -->
    <div style="background:linear-gradient(135deg,#fef3c7,#fff7ed);padding:28px 32px;text-align:center;border-top:1px solid #fde68a;">
      <p style="color:#92400e;font-size:16px;font-weight:700;margin:0 0 8px 0;">Need help with compliance?</p>
      <p style="color:#78350f;font-size:13px;margin:0 0 16px 0;line-height:1.5;">
        Green Light Expediting LLC specializes in NYC DOB violations, permits, and code compliance.
      </p>
      <a href="mailto:info@greenlightexpediting.com?subject=Violation%20Help%20Request" style="display:inline-block;background:#ea580c;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
        ✉️ Contact Green Light Expediting
      </a>
      <p style="color:#b45309;font-size:11px;margin:12px 0 0;">
        Green Light Expediting LLC · <a href="https://www.greenlightexpediting.com" style="color:#b45309;text-decoration:underline;">www.greenlightexpediting.com</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:24px 32px;text-align:center;border-radius:0 0 16px 16px;background:#ffffff;border-top:1px solid #f1f5f9;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        You're receiving this because you subscribed to CitiSignal digest emails.
      </p>
      <p style="color:#94a3b8;font-size:12px;margin:8px 0 0;">
        <a href="${appUrl}/dashboard/settings" style="color:#64748b;text-decoration:underline;">Manage email preferences</a>
        &nbsp;·&nbsp;
        <a href="${appUrl}/dashboard/settings" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
      </p>
      <p style="color:#cbd5e1;font-size:11px;margin:12px 0 0;">© ${new Date().getFullYear()} CitiSignal. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }
    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Security Fix 4: Validate caller authentication and restrict to own digest
    const authHeader = req.headers.get("Authorization");
    let callerUserId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: callerUser } } = await authClient.auth.getUser();
      callerUserId = callerUser?.id || null;
    }

    let body: { user_id?: string; test_mode?: boolean; preview_only?: boolean } = {};
    try {
      body = await req.json();
    } catch { /* empty */ }

    const userId = body.user_id;
    if (!userId) throw new Error("user_id is required");

    // If the caller is authenticated, they can only trigger their own digest
    if (callerUserId && callerUserId !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden — can only send your own digest" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user email from auth
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user) throw new Error("User not found");

    const userEmail = user.email;
    if (!userEmail) throw new Error("User has no email");

    // Get profile for display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .single();

    // Get user preferences
    const { data: prefs } = await supabase
      .from("email_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    const notifyViolations = prefs?.notify_new_violations ?? true;
    const notifyExpirations = prefs?.notify_expirations ?? true;
    const notifyApplications = prefs?.notify_new_applications ?? true;

    // Get all properties for this user
    const { data: properties } = await supabase
      .from("properties")
      .select("id, address")
      .eq("user_id", userId);

    if (!properties || properties.length === 0) {
      throw new Error("No properties found");
    }

    const propertyIds = properties.map(p => p.id);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch all data in parallel
    const [violationsRes, docsRes, applicationsRes, insuranceRes] = await Promise.all([
      notifyViolations
        ? supabase.from("violations").select("*").in("property_id", propertyIds).eq("status", "open").order("severity")
        : Promise.resolve({ data: [] }),
      notifyExpirations
        ? supabase.from("property_documents").select("*").in("property_id", propertyIds).not("expiration_date", "is", null).lte("expiration_date", sevenDaysFromNow.toISOString().split("T")[0])
        : Promise.resolve({ data: [] }),
      notifyApplications
        ? supabase.from("applications").select("*").in("property_id", propertyIds).order("updated_at", { ascending: false }).limit(50)
        : Promise.resolve({ data: [] }),
      supabase.from("tenant_insurance_policies")
        .select("*, tenants(company_name)")
        .in("property_id", propertyIds)
        .lte("expiration_date", new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
        .in("status", ["active", "expired"]),
    ]);

    const allViolations = violationsRes.data || [];
    const allDocs = docsRes.data || [];
    const allApps = applicationsRes.data || [];
    const allInsurance = insuranceRes.data || [];

    // Group by property with calculated severity
    const propertyData = properties.map(prop => {
      const violations = allViolations.filter((v: any) => v.property_id === prop.id);
      const upcomingHearings = violations.filter((v: any) => v.hearing_date && new Date(v.hearing_date) <= sevenDaysFromNow && new Date(v.hearing_date) >= now);
      const expiringDocs = allDocs.filter((d: any) => d.property_id === prop.id);
      const applications = allApps.filter((a: any) => a.property_id === prop.id).slice(0, 5);
      const insuranceAlerts = allInsurance
        .filter((i: any) => i.property_id === prop.id)
        .map((i: any) => {
          const daysRemaining = Math.ceil((new Date(i.expiration_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return {
            tenant_name: (i as any).tenants?.company_name || "Tenant",
            policy_type: i.policy_type,
            expiration_date: i.expiration_date,
            days_remaining: daysRemaining,
            is_expired: daysRemaining < 0,
          };
        });

      return {
        address: prop.address,
        violations: violations.slice(0, 10).map((v: any) => ({
          violation_number: v.violation_number,
          description_raw: v.description_raw,
          severity_info: calculateSeverity(v),
          agency: v.agency,
          issued_date: v.issued_date,
          hearing_date: v.hearing_date,
        })),
        upcomingHearings,
        expiringDocs,
        applications,
        insuranceAlerts,
      };
    });

    const totalViolations = allViolations.length;
    const totalHearings = propertyData.reduce((sum, p) => sum + p.upcomingHearings.length, 0);
    const totalExpiring = allDocs.length;
    const totalApplications = allApps.length;
    const totalInsuranceAlerts = allInsurance.length;

    const appUrl = Deno.env.get("APP_URL") || "https://app.citisignal.com";
    const digestDate = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    const html = buildEmailHtml({
      userName: profile?.display_name || "",
      properties: propertyData,
      appUrl,
      totalViolations,
      totalHearings,
      totalExpiring,
      totalApplications,
      totalInsuranceAlerts,
      digestDate,
    });

    // Preview mode — return HTML without sending
    if (body.preview_only) {
      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_ADDRESS") || "CitiSignal <notifications@citisignal.com>",
        to: [userEmail],
        subject: `🛡️ Weekly Compliance Digest — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        html,
      }),
    });

    const resendResult = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendResult);
      throw new Error(`Failed to send email: ${JSON.stringify(resendResult)}`);
    }

    // Log
    await supabase.from("email_log").insert({
      user_id: userId,
      email_type: body.test_mode ? "test_digest" : "digest",
      subject: `Weekly Compliance Digest — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      recipient_email: userEmail,
      metadata: {
        total_violations: totalViolations,
        total_hearings: totalHearings,
        total_expiring: totalExpiring,
        total_applications: totalApplications,
        properties_count: properties.length,
        resend_id: resendResult.id,
      },
    });

    return new Response(
      JSON.stringify({ success: true, resend_id: resendResult.id, preview_available: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Email digest error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
