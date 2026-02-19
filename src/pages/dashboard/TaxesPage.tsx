import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, AlertTriangle, Scale, Building2, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: 'bg-success/10 text-success border-success/20',
  partial: 'bg-warning/10 text-warning border-warning/20',
  unpaid: 'bg-destructive/10 text-destructive border-destructive/20',
  exempt: 'bg-muted text-muted-foreground border-muted',
};

const PROTEST_STATUS_LABELS: Record<string, string> = {
  none: 'None', filed: 'Filed', pending_hearing: 'Pending Hearing',
  decided_favorable: 'Favorable', decided_unfavorable: 'Unfavorable', withdrawn: 'Withdrawn',
};

const PROTEST_STATUS_COLORS: Record<string, string> = {
  filed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  pending_hearing: 'bg-warning/10 text-warning',
  decided_favorable: 'bg-success/10 text-success',
  decided_unfavorable: 'bg-destructive/10 text-destructive',
  withdrawn: 'bg-muted text-muted-foreground',
};

const EMPTY_FORM = {
  property_id: '', tax_year: new Date().getFullYear().toString(), assessed_value: '',
  tax_amount: '', amount_paid: '', due_date: '', payment_status: 'unpaid',
  protest_status: 'none', tenant_responsible: false, tenant_name: '',
};

const TaxesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: properties } = useQuery({
    queryKey: ['properties-list', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('id, address').order('address');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: taxes, isLoading } = useQuery({
    queryKey: ['all-property-taxes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_taxes')
        .select('*, properties(id, address)')
        .order('tax_year', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        property_id: form.property_id,
        tax_year: parseInt(form.tax_year),
        assessed_value: form.assessed_value ? parseFloat(form.assessed_value) : null,
        tax_amount: form.tax_amount ? parseFloat(form.tax_amount) : null,
        amount_paid: form.amount_paid ? parseFloat(form.amount_paid) : null,
        due_date: form.due_date || null,
        payment_status: form.payment_status,
        protest_status: form.protest_status,
        tenant_responsible: form.tenant_responsible,
        tenant_name: form.tenant_name || null,
      };
      const { error } = await supabase.from('property_taxes').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tax record added');
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['all-property-taxes'] });
    },
    onError: () => toast.error('Failed to add tax record'),
  });

  const setField = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const totalBalance = (taxes || []).reduce((sum, t) => sum + (t.balance_due || 0), 0);
  const overdueCount = (taxes || []).filter(t => t.payment_status === 'unpaid' && t.due_date && new Date(t.due_date) < new Date()).length;
  const activeProtests = (taxes || []).filter(t => ['filed', 'pending_hearing'].includes(t.protest_status || '')).length;
  const propertyCount = new Set((taxes || []).map(t => t.property_id)).size;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Taxes</h1>
          <p className="text-sm text-muted-foreground">Property tax records across all properties</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!properties?.length} onClick={() => setForm(EMPTY_FORM)}>
              <Plus className="w-4 h-4 mr-1" /> Add Tax Record
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Tax Record</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Property *</Label>
                <Select value={form.property_id} onValueChange={v => setField('property_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>{(properties || []).map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tax Year *</Label><Input type="number" value={form.tax_year} onChange={e => setField('tax_year', e.target.value)} /></div>
              <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setField('due_date', e.target.value)} /></div>
              <div><Label>Assessed Value ($)</Label><Input type="number" value={form.assessed_value} onChange={e => setField('assessed_value', e.target.value)} /></div>
              <div><Label>Tax Amount ($)</Label><Input type="number" value={form.tax_amount} onChange={e => setField('tax_amount', e.target.value)} /></div>
              <div><Label>Amount Paid ($)</Label><Input type="number" value={form.amount_paid} onChange={e => setField('amount_paid', e.target.value)} /></div>
              <div><Label>Payment Status</Label>
                <Select value={form.payment_status} onValueChange={v => setField('payment_status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="exempt">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Protest Status</Label>
                <Select value={form.protest_status} onValueChange={v => setField('protest_status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="filed">Filed</SelectItem>
                    <SelectItem value="pending_hearing">Pending Hearing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Tenant Name</Label><Input value={form.tenant_name} onChange={e => setField('tenant_name', e.target.value)} placeholder="If tenant responsible" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.property_id || !form.tax_year}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Add
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xl font-display font-bold">${totalBalance.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Balance Due</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
          <div><p className="text-xl font-display font-bold">{overdueCount}</p><p className="text-xs text-muted-foreground">Overdue</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Scale className="w-5 h-5 text-blue-700 dark:text-blue-300" /></div>
          <div><p className="text-xl font-display font-bold">{activeProtests}</p><p className="text-xs text-muted-foreground">Active Protests</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><Building2 className="w-5 h-5 text-foreground" /></div>
          <div><p className="text-xl font-display font-bold">{propertyCount}</p><p className="text-xs text-muted-foreground">Properties</p></div>
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
                <TableRow key={tax.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/dashboard/properties/${tax.property_id}`)}>
                  <TableCell className="font-medium text-sm max-w-[200px] truncate">{tax.properties?.address || '—'}</TableCell>
                  <TableCell className="font-medium">{tax.tax_year}</TableCell>
                  <TableCell className="text-sm">{tax.tax_amount ? `$${tax.tax_amount.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-sm">{tax.amount_paid ? `$${tax.amount_paid.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {tax.balance_due != null && tax.balance_due > 0
                      ? <span className="text-destructive">${tax.balance_due.toLocaleString()}</span>
                      : <span className="text-success">$0</span>}
                  </TableCell>
                  <TableCell><Badge variant="outline" className={PAYMENT_STATUS_COLORS[tax.payment_status] || ''}>{tax.payment_status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{tax.due_date ? format(new Date(tax.due_date), 'MM/dd/yy') : '—'}</TableCell>
                  <TableCell>
                    {tax.protest_status && tax.protest_status !== 'none' && (
                      <Badge variant="outline" className={PROTEST_STATUS_COLORS[tax.protest_status] || ''}>
                        {PROTEST_STATUS_LABELS[tax.protest_status] || tax.protest_status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[120px]">{tax.tenant_responsible ? (tax.tenant_name || 'Yes') : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No tax records</h3>
          <p className="text-muted-foreground text-sm">Click "Add Tax Record" to get started.</p>
        </div>
      )}
    </div>
  );
};

export default TaxesPage;
