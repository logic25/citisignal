// ── Shared insurance constants ──────────────────────────────

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

export const getComplianceInfo = (p: any) => {
  const { differenceInDays, parseISO } = require('date-fns');
  const isExpired = p.expiration_date && new Date(p.expiration_date) < new Date();
  const isBelowMin = p.required_minimum && p.coverage_amount && Number(p.coverage_amount) < Number(p.required_minimum);
  const missingAdditional = p.additional_insured_required && !p.additional_insured;
  if (isExpired) return { label: 'Expired', variant: 'destructive' as const, color: 'bg-destructive/10 text-destructive border-destructive/20' };
  if (isBelowMin || missingAdditional) return { label: 'Non-Compliant', variant: 'outline' as const, color: 'bg-warning/10 text-warning border-warning/20' };
  if (p.expiration_date) {
    const days = differenceInDays(parseISO(p.expiration_date), new Date());
    if (days <= 30) return { label: `${days}d left`, variant: 'outline' as const, color: 'bg-warning/10 text-warning border-warning/20' };
  }
  return { label: 'Compliant', variant: 'outline' as const, color: 'bg-success/10 text-success border-success/20' };
};
