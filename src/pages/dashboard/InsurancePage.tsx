import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Building2 } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

const POLICY_TYPES: Record<string, string> = {
  general_liability: 'General Liability',
  workers_comp: 'Workers Comp',
  property_contents: 'Property / Contents',
  umbrella: 'Umbrella / Excess',
  auto: 'Auto',
  other: 'Other',
};

const InsurancePage = () => {
  const navigate = useNavigate();

  const { data: policies, isLoading } = useQuery({
    queryKey: ['all-insurance-policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_insurance_policies')
        .select('*, tenants(company_name), properties(id, address)')
        .order('expiration_date', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const getComplianceInfo = (p: any) => {
    const isExpired = p.expiration_date && new Date(p.expiration_date) < new Date();
    const isBelowMin = p.required_minimum && p.coverage_amount && Number(p.coverage_amount) < Number(p.required_minimum);
    const missingAdditional = p.additional_insured_required && !p.additional_insured;

    if (isExpired) return { label: 'Expired', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: ShieldX };
    if (isBelowMin || missingAdditional) return { label: 'Non-Compliant', color: 'bg-warning/10 text-warning border-warning/20', icon: ShieldAlert };
    if (p.expiration_date) {
      const days = differenceInDays(parseISO(p.expiration_date), new Date());
      if (days <= 30) return { label: `${days}d left`, color: 'bg-warning/10 text-warning border-warning/20', icon: ShieldAlert };
    }
    return { label: 'Compliant', color: 'bg-success/10 text-success border-success/20', icon: ShieldCheck };
  };

  const all = policies || [];
  const expiredCount = all.filter(p => p.expiration_date && new Date(p.expiration_date) < new Date()).length;
  const expiringSoonCount = all.filter(p => {
    if (!p.expiration_date) return false;
    const days = differenceInDays(parseISO(p.expiration_date), new Date());
    return days > 0 && days <= 30;
  }).length;
  const nonCompliantCount = all.filter(p => {
    const isExpired = p.expiration_date && new Date(p.expiration_date) < new Date();
    if (isExpired) return false;
    const isBelowMin = p.required_minimum && p.coverage_amount && Number(p.coverage_amount) < Number(p.required_minimum);
    const missingAdditional = p.additional_insured_required && !p.additional_insured;
    return isBelowMin || missingAdditional;
  }).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Insurance</h1>
        <p className="text-sm text-muted-foreground">Tenant insurance policies & COI tracking across all properties</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xl font-display font-bold">{all.length}</p>
            <p className="text-xs text-muted-foreground">Total Policies</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-xl font-display font-bold">{expiringSoonCount}</p>
            <p className="text-xs text-muted-foreground">Expiring ≤30d</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-xl font-display font-bold">{expiredCount}</p>
            <p className="text-xs text-muted-foreground">Expired</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <p className="text-xl font-display font-bold">{nonCompliantCount}</p>
            <p className="text-xs text-muted-foreground">Non-Compliant</p>
          </div>
        </div>
      </div>

      {all.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Property</TableHead>
                <TableHead className="font-semibold">Tenant</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Carrier</TableHead>
                <TableHead className="font-semibold">Coverage</TableHead>
                <TableHead className="font-semibold">Expires</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.map(p => {
                const compliance = getComplianceInfo(p);
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate(`/dashboard/properties/${p.property_id}`)}
                  >
                    <TableCell className="text-sm max-w-[180px] truncate">{p.properties?.address || '—'}</TableCell>
                    <TableCell className="text-sm font-medium">{p.tenants?.company_name || '—'}</TableCell>
                    <TableCell className="text-sm">{POLICY_TYPES[p.policy_type] || p.policy_type}</TableCell>
                    <TableCell className="text-sm">{p.carrier_name || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {p.coverage_amount ? `$${Number(p.coverage_amount).toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.expiration_date ? format(parseISO(p.expiration_date), 'MM/dd/yy') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={compliance.color}>
                        {compliance.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No insurance policies</h3>
          <p className="text-muted-foreground text-sm">Add insurance policies from individual tenant records.</p>
        </div>
      )}
    </div>
  );
};

export default InsurancePage;
