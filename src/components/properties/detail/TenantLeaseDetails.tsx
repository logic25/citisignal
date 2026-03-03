import { format, parseISO } from 'date-fns';

interface TenantLeaseDetailsProps {
  tenant: {
    annual_escalation_pct: number | null;
    use_clause: string | null;
    option_terms: string | null;
    guarantor_name: string | null;
    guarantor_phone: string | null;
    move_in_date: string | null;
    parking_spaces: number | null;
    ti_allowance: number | null;
    percentage_rent: number | null;
    percentage_rent_breakpoint: number | null;
  };
}

export const TenantLeaseDetails = ({ tenant }: TenantLeaseDetailsProps) => {
  const hasAnyData = tenant.annual_escalation_pct || tenant.use_clause || tenant.option_terms ||
    tenant.guarantor_name || tenant.move_in_date || tenant.parking_spaces ||
    tenant.ti_allowance || tenant.percentage_rent;

  if (!hasAnyData) return null;

  const items: { label: string; value: string }[] = [];

  if (tenant.annual_escalation_pct != null)
    items.push({ label: 'Annual Escalation', value: `${tenant.annual_escalation_pct}%` });
  if (tenant.use_clause)
    items.push({ label: 'Use Clause', value: tenant.use_clause });
  if (tenant.option_terms)
    items.push({ label: 'Option Terms', value: tenant.option_terms });
  if (tenant.guarantor_name) {
    const val = tenant.guarantor_phone ? `${tenant.guarantor_name} · ${tenant.guarantor_phone}` : tenant.guarantor_name;
    items.push({ label: 'Guarantor', value: val });
  }
  if (tenant.move_in_date)
    items.push({ label: 'Move-in Date', value: format(parseISO(tenant.move_in_date), 'MMM d, yyyy') });
  if (tenant.parking_spaces != null)
    items.push({ label: 'Parking Spaces', value: tenant.parking_spaces.toString() });
  if (tenant.ti_allowance != null)
    items.push({ label: 'TI Allowance', value: `$${tenant.ti_allowance.toLocaleString()}` });
  if (tenant.percentage_rent != null) {
    let val = `${tenant.percentage_rent}%`;
    if (tenant.percentage_rent_breakpoint != null)
      val += ` above $${tenant.percentage_rent_breakpoint.toLocaleString()}`;
    items.push({ label: 'Percentage Rent', value: val });
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Lease Details</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
        {items.map(item => (
          <div key={item.label}>
            <span className="text-xs text-muted-foreground">{item.label}: </span>
            <span className="text-xs text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
