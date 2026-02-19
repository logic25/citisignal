import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, AlertTriangle, Scale, Building2 } from 'lucide-react';
import { format } from 'date-fns';

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: 'bg-success/10 text-success border-success/20',
  partial: 'bg-warning/10 text-warning border-warning/20',
  unpaid: 'bg-destructive/10 text-destructive border-destructive/20',
  exempt: 'bg-muted text-muted-foreground border-muted',
};

const PROTEST_STATUS_LABELS: Record<string, string> = {
  none: 'None',
  filed: 'Filed',
  pending_hearing: 'Pending Hearing',
  decided_favorable: 'Favorable',
  decided_unfavorable: 'Unfavorable',
  withdrawn: 'Withdrawn',
};

const PROTEST_STATUS_COLORS: Record<string, string> = {
  filed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  pending_hearing: 'bg-warning/10 text-warning',
  decided_favorable: 'bg-success/10 text-success',
  decided_unfavorable: 'bg-destructive/10 text-destructive',
  withdrawn: 'bg-muted text-muted-foreground',
};

interface TaxWithProperty {
  id: string;
  tax_year: number;
  assessed_value: number | null;
  tax_amount: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  payment_status: string;
  due_date: string | null;
  protest_status: string | null;
  tenant_responsible: boolean | null;
  tenant_name: string | null;
  property_id: string;
  properties: { id: string; address: string } | null;
}

const TaxesPage = () => {
  const navigate = useNavigate();

  const { data: taxes, isLoading } = useQuery({
    queryKey: ['all-property-taxes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_taxes')
        .select('*, properties(id, address)')
        .order('tax_year', { ascending: false });
      if (error) throw error;
      return data as TaxWithProperty[];
    },
  });

  const totalBalance = (taxes || []).reduce((sum, t) => sum + (t.balance_due || 0), 0);
  const overdueCount = (taxes || []).filter(t => t.payment_status === 'unpaid' && t.due_date && new Date(t.due_date) < new Date()).length;
  const activeProtests = (taxes || []).filter(t => ['filed', 'pending_hearing'].includes(t.protest_status || '')).length;
  const propertyCount = new Set((taxes || []).map(t => t.property_id)).size;

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
        <h1 className="font-display text-2xl font-bold text-foreground">Taxes</h1>
        <p className="text-sm text-muted-foreground">Property tax records across all properties</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xl font-display font-bold">${totalBalance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Balance Due</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-xl font-display font-bold">{overdueCount}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Scale className="w-5 h-5 text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <p className="text-xl font-display font-bold">{activeProtests}</p>
            <p className="text-xs text-muted-foreground">Active Protests</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <p className="text-xl font-display font-bold">{propertyCount}</p>
            <p className="text-xs text-muted-foreground">Properties</p>
          </div>
        </div>
      </div>

      {/* Table */}
      {(taxes || []).length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Property</TableHead>
                <TableHead className="font-semibold">Year</TableHead>
                <TableHead className="font-semibold">Tax Amount</TableHead>
                <TableHead className="font-semibold">Paid</TableHead>
                <TableHead className="font-semibold">Balance</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Due Date</TableHead>
                <TableHead className="font-semibold">Protest</TableHead>
                <TableHead className="font-semibold">Tenant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(taxes || []).map(tax => (
                <TableRow 
                  key={tax.id} 
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => navigate(`/dashboard/properties/${tax.property_id}`)}
                >
                  <TableCell className="font-medium text-sm max-w-[200px] truncate">
                    {tax.properties?.address || '—'}
                  </TableCell>
                  <TableCell className="font-medium">{tax.tax_year}</TableCell>
                  <TableCell className="text-sm">{tax.tax_amount ? `$${tax.tax_amount.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-sm">{tax.amount_paid ? `$${tax.amount_paid.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {tax.balance_due != null && tax.balance_due > 0 ? (
                      <span className="text-destructive">${tax.balance_due.toLocaleString()}</span>
                    ) : (
                      <span className="text-success">$0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={PAYMENT_STATUS_COLORS[tax.payment_status] || ''}>
                      {tax.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tax.due_date ? format(new Date(tax.due_date), 'MM/dd/yy') : '—'}
                  </TableCell>
                  <TableCell>
                    {tax.protest_status && tax.protest_status !== 'none' && (
                      <Badge variant="outline" className={PROTEST_STATUS_COLORS[tax.protest_status] || ''}>
                        {PROTEST_STATUS_LABELS[tax.protest_status] || tax.protest_status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[120px]">
                    {tax.tenant_responsible ? (tax.tenant_name || 'Yes') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No tax records</h3>
          <p className="text-muted-foreground text-sm">Add tax records from individual property pages.</p>
        </div>
      )}
    </div>
  );
};

export default TaxesPage;
