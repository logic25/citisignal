// ── Shared insurance constants & helpers ──────────────────────────────
import { differenceInDays, parseISO } from 'date-fns';

export const TENANT_POLICY_TYPES: Record<string, string> = {
  general_liability: 'General Liability',
  workers_comp: "Workers' Comp",
  property_contents: 'Property / Contents',
  umbrella: 'Umbrella / Excess',
  auto: 'Business Auto',
  professional_liability: 'Professional Liability (E&O)',
  liquor_liability: 'Liquor Liability',
  cyber_liability: 'Cyber Liability',
  environmental: 'Environmental / Pollution',
  other: 'Other',
};

export const BUILDING_POLICY_TYPES: Record<string, string> = {
  property: 'Building Property',
  general_liability: 'General Liability',
  umbrella: 'Umbrella / Excess',
  dno: "Directors & Officers",
  environmental: 'Environmental',
  flood: 'Flood',
  earthquake: 'Earthquake',
  equipment_breakdown: 'Equipment Breakdown',
  loss_of_rents: 'Loss of Rents / BI',
  other: 'Other',
};

export const RENEWAL_STATUSES: Record<string, string> = {
  pending: 'Renewal Pending',
  requested: 'Requested',
  received: 'Received',
  overdue: 'Overdue',
};

export const EMPTY_TENANT_FORM = {
  property_id: '', tenant_id: '', policy_type: 'general_liability',
  carrier_name: '', policy_number: '', coverage_amount: '',
  required_minimum: '', expiration_date: '', effective_date: '',
  additional_insured: false, additional_insured_required: true,
  additional_insured_entity_name: '', deductible: '',
  per_occurrence_limit: '', aggregate_limit: '', endorsements: '',
};

export const EMPTY_BUILDING_FORM = {
  property_id: '', policy_type: 'property',
  carrier_name: '', policy_number: '', coverage_amount: '',
  deductible: '', per_occurrence_limit: '', aggregate_limit: '',
  effective_date: '', expiration_date: '',
  premium_annual: '', broker_name: '', broker_phone: '', broker_email: '',
  endorsements: '', notes: '',
};

export type ComplianceInfo = {
  label: string;
  variant: 'destructive' | 'outline';
  color: string;
};

export const getComplianceInfo = (p: any): ComplianceInfo => {
  const isExpired = p.expiration_date && new Date(p.expiration_date) < new Date();
  const isBelowMin = p.required_minimum && p.coverage_amount && Number(p.coverage_amount) < Number(p.required_minimum);
  const missingAdditional = p.additional_insured_required && !p.additional_insured;
  if (isExpired) return { label: 'Expired', variant: 'destructive', color: 'bg-destructive/10 text-destructive border-destructive/20' };
  if (isBelowMin || missingAdditional) return { label: 'Non-Compliant', variant: 'outline', color: 'bg-warning/10 text-warning border-warning/20' };
  if (p.expiration_date) {
    const days = differenceInDays(parseISO(p.expiration_date), new Date());
    if (days <= 30) return { label: `${days}d left`, variant: 'outline', color: 'bg-warning/10 text-warning border-warning/20' };
  }
  return { label: 'Compliant', variant: 'outline', color: 'bg-success/10 text-success border-success/20' };
};

export const getCoverageGaps = (policies: any[]) => {
  const gaps: { tenantName: string; propertyAddress: string; propertyId: string; issues: string[] }[] = [];
  const byTenant = new Map<string, any[]>();
  for (const p of policies) {
    const key = p.tenant_id || 'unknown';
    if (!byTenant.has(key)) byTenant.set(key, []);
    byTenant.get(key)!.push(p);
  }
  for (const [, tenantPolicies] of byTenant) {
    const issues: string[] = [];
    const tenant = tenantPolicies[0];
    const types = new Set(tenantPolicies.map((p: any) => p.policy_type));
    if (!types.has('general_liability')) issues.push('Missing General Liability policy');
    for (const p of tenantPolicies) {
      if (p.required_minimum && p.coverage_amount && Number(p.coverage_amount) < Number(p.required_minimum)) {
        issues.push(`${TENANT_POLICY_TYPES[p.policy_type] || p.policy_type}: Coverage $${Number(p.coverage_amount).toLocaleString()} below required $${Number(p.required_minimum).toLocaleString()}`);
      }
      if (p.additional_insured_required && !p.additional_insured) {
        issues.push(`${TENANT_POLICY_TYPES[p.policy_type] || p.policy_type}: Additional Insured not listed`);
      }
      if (p.expiration_date && new Date(p.expiration_date) < new Date()) {
        issues.push(`${TENANT_POLICY_TYPES[p.policy_type] || p.policy_type}: Expired ${parseISO(p.expiration_date).toLocaleDateString()}`);
      }
    }
    if (issues.length > 0) {
      gaps.push({
        tenantName: tenant.tenants?.company_name || 'Unknown Tenant',
        propertyAddress: tenant.properties?.address || 'Unknown',
        propertyId: tenant.property_id,
        issues,
      });
    }
  }
  return gaps;
};

export type GroupedPolicies = {
  propertyId: string;
  propertyAddress: string;
  tenants: {
    tenantId: string;
    tenantName: string;
    policies: any[];
  }[];
};

export const groupPoliciesByPropertyTenant = (policies: any[]): GroupedPolicies[] => {
  const byProperty = new Map<string, Map<string, any[]>>();
  const propertyNames = new Map<string, string>();
  const tenantNames = new Map<string, string>();

  for (const p of policies) {
    const propId = p.property_id || 'unknown';
    const tenantId = p.tenant_id || 'unknown';
    propertyNames.set(propId, p.properties?.address || 'Unknown Property');
    tenantNames.set(tenantId, p.tenants?.company_name || 'Unknown Tenant');
    if (!byProperty.has(propId)) byProperty.set(propId, new Map());
    const tenantMap = byProperty.get(propId)!;
    if (!tenantMap.has(tenantId)) tenantMap.set(tenantId, []);
    tenantMap.get(tenantId)!.push(p);
  }

  const result: GroupedPolicies[] = [];
  for (const [propId, tenantMap] of byProperty) {
    const tenants: GroupedPolicies['tenants'] = [];
    for (const [tenantId, pols] of tenantMap) {
      tenants.push({ tenantId, tenantName: tenantNames.get(tenantId) || 'Unknown', policies: pols });
    }
    tenants.sort((a, b) => a.tenantName.localeCompare(b.tenantName));
    result.push({ propertyId: propId, propertyAddress: propertyNames.get(propId) || 'Unknown', tenants });
  }
  result.sort((a, b) => a.propertyAddress.localeCompare(b.propertyAddress));
  return result;
};
