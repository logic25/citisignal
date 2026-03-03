import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Plus, Pencil, Trash2, Scale, AlertTriangle, Calendar, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PropertyTaxesTabProps {
  propertyId: string;
}

interface TaxRecord {
  id: string;
  tax_year: number;
  assessed_value: number | null;
  tax_amount: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  payment_status: string;
  due_date: string | null;
  paid_date: string | null;
  tax_rate: number | null;
  protest_status: string;
  protest_filed_date: string | null;
  protest_hearing_date: string | null;
  protest_outcome_notes: string | null;
  attorney_name: string | null;
  attorney_firm: string | null;
  attorney_fee: number | null;
  attorney_phone: string | null;
  attorney_email: string | null;
  tenant_responsible: boolean;
  tenant_name: string | null;
  notes: string | null;
  exemption_type: string | null;
  exemption_start_date: string | null;
  exemption_end_date: string | null;
  exemption_notes: string | null;
  q1_amount: number | null; q1_paid: number | null; q1_due_date: string | null; q1_status: string | null;
  q2_amount: number | null; q2_paid: number | null; q2_due_date: string | null; q2_status: string | null;
  q3_amount: number | null; q3_paid: number | null; q3_due_date: string | null; q3_status: string | null;
  q4_amount: number | null; q4_paid: number | null; q4_due_date: string | null; q4_status: string | null;
}

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
  none: '', filed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  pending_hearing: 'bg-warning/10 text-warning', decided_favorable: 'bg-success/10 text-success',
  decided_unfavorable: 'bg-destructive/10 text-destructive', withdrawn: 'bg-muted text-muted-foreground',
};

const EXEMPTION_LABELS: Record<string, string> = {
  '421a': '421-a', icap: 'ICAP', j51: 'J-51', star: 'STAR', dhcr: 'DHCR', veterans: 'Veterans', senior: 'Senior Citizen', other: 'Other',
};

const Q_LABELS = ['Q1 (Jul)', 'Q2 (Oct)', 'Q3 (Jan)', 'Q4 (Apr)'] as const;
const Q_KEYS = ['q1', 'q2', 'q3', 'q4'] as const;

const emptyForm = {
  tax_year: new Date().getFullYear(),
  assessed_value: '', tax_amount: '', amount_paid: '', tax_rate: '',
  payment_status: 'unpaid', due_date: '', paid_date: '',
  protest_status: 'none', protest_filed_date: '', protest_hearing_date: '', protest_outcome_notes: '',
  attorney_name: '', attorney_firm: '', attorney_fee: '', attorney_phone: '', attorney_email: '',
  tenant_responsible: false, tenant_name: '', notes: '',
  exemption_type: '', exemption_start_date: '', exemption_end_date: '', exemption_notes: '',
  q1_amount: '', q1_paid: '', q1_due_date: '', q1_status: 'unpaid',
  q2_amount: '', q2_paid: '', q2_due_date: '', q2_status: 'unpaid',
  q3_amount: '', q3_paid: '', q3_due_date: '', q3_status: 'unpaid',
  q4_amount: '', q4_paid: '', q4_due_date: '', q4_status: 'unpaid',
};

export const PropertyTaxesTab = ({ propertyId }: PropertyTaxesTabProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: taxes, isLoading } = useQuery({
    queryKey: ['property-taxes', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_taxes')
        .select('*')
        .eq('property_id', propertyId)
        .order('tax_year', { ascending: false });
      if (error) throw error;
      return data as TaxRecord[];
    },
  });

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };

  const openEdit = (tax: TaxRecord) => {
    setEditingId(tax.id);
    setForm({
      tax_year: tax.tax_year,
      assessed_value: tax.assessed_value?.toString() || '',
      tax_amount: tax.tax_amount?.toString() || '',
      amount_paid: tax.amount_paid?.toString() || '',
      tax_rate: tax.tax_rate?.toString() || '',
      payment_status: tax.payment_status,
      due_date: tax.due_date || '', paid_date: tax.paid_date || '',
      protest_status: tax.protest_status,
      protest_filed_date: tax.protest_filed_date || '',
      protest_hearing_date: tax.protest_hearing_date || '',
      protest_outcome_notes: tax.protest_outcome_notes || '',
      attorney_name: tax.attorney_name || '', attorney_firm: tax.attorney_firm || '',
      attorney_fee: tax.attorney_fee?.toString() || '',
      attorney_phone: tax.attorney_phone || '', attorney_email: tax.attorney_email || '',
      tenant_responsible: tax.tenant_responsible, tenant_name: tax.tenant_name || '',
      notes: tax.notes || '',
      exemption_type: tax.exemption_type || '',
      exemption_start_date: tax.exemption_start_date || '',
      exemption_end_date: tax.exemption_end_date || '',
      exemption_notes: tax.exemption_notes || '',
      q1_amount: tax.q1_amount?.toString() || '', q1_paid: tax.q1_paid?.toString() || '',
      q1_due_date: tax.q1_due_date || '', q1_status: tax.q1_status || 'unpaid',
      q2_amount: tax.q2_amount?.toString() || '', q2_paid: tax.q2_paid?.toString() || '',
      q2_due_date: tax.q2_due_date || '', q2_status: tax.q2_status || 'unpaid',
      q3_amount: tax.q3_amount?.toString() || '', q3_paid: tax.q3_paid?.toString() || '',
      q3_due_date: tax.q3_due_date || '', q3_status: tax.q3_status || 'unpaid',
      q4_amount: tax.q4_amount?.toString() || '', q4_paid: tax.q4_paid?.toString() || '',
      q4_due_date: tax.q4_due_date || '', q4_status: tax.q4_status || 'unpaid',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload: any = {
      property_id: propertyId,
      tax_year: form.tax_year,
      assessed_value: form.assessed_value ? parseFloat(form.assessed_value) : null,
      tax_amount: form.tax_amount ? parseFloat(form.tax_amount) : null,
      amount_paid: form.amount_paid ? parseFloat(form.amount_paid) : 0,
      tax_rate: form.tax_rate ? parseFloat(form.tax_rate) : null,
      payment_status: form.payment_status,
      due_date: form.due_date || null, paid_date: form.paid_date || null,
      protest_status: form.protest_status,
      protest_filed_date: form.protest_filed_date || null,
      protest_hearing_date: form.protest_hearing_date || null,
      protest_outcome_notes: form.protest_outcome_notes || null,
      attorney_name: form.attorney_name || null, attorney_firm: form.attorney_firm || null,
      attorney_fee: form.attorney_fee ? parseFloat(form.attorney_fee) : null,
      attorney_phone: form.attorney_phone || null, attorney_email: form.attorney_email || null,
      tenant_responsible: form.tenant_responsible, tenant_name: form.tenant_name || null,
      notes: form.notes || null,
      exemption_type: form.exemption_type || null,
      exemption_start_date: form.exemption_start_date || null,
      exemption_end_date: form.exemption_end_date || null,
      exemption_notes: form.exemption_notes || null,
    };
    for (const q of Q_KEYS) {
      payload[`${q}_amount`] = form[`${q}_amount` as keyof typeof form] ? parseFloat(form[`${q}_amount` as keyof typeof form] as string) : null;
      payload[`${q}_paid`] = form[`${q}_paid` as keyof typeof form] ? parseFloat(form[`${q}_paid` as keyof typeof form] as string) : 0;
      payload[`${q}_due_date`] = form[`${q}_due_date` as keyof typeof form] || null;
      payload[`${q}_status`] = form[`${q}_status` as keyof typeof form] || 'unpaid';
    }

    let error;
    if (editingId) {
      ({ error } = await supabase.from('property_taxes').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('property_taxes').insert(payload));
    }

    setSaving(false);
    if (error) {
      if (error.code === '23505') {
        toast.error(`Tax year ${form.tax_year} already exists for this property`);
      } else {
        toast.error('Failed to save tax record');
      }
      return;
    }

    toast.success(editingId ? 'Tax record updated' : 'Tax record added');
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['property-taxes', propertyId] });
  };

  const deleteTax = async (id: string) => {
    const { error } = await supabase.from('property_taxes').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Tax record deleted');
    queryClient.invalidateQueries({ queryKey: ['property-taxes', propertyId] });
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalBalance = (taxes || []).reduce((sum, t) => sum + (t.balance_due || 0), 0);
  const overdueCount = (taxes || []).filter(t => t.payment_status === 'unpaid' && t.due_date && new Date(t.due_date) < new Date()).length;
  const activeProtests = (taxes || []).filter(t => ['filed', 'pending_hearing'].includes(t.protest_status)).length;
  const exemptionCount = (taxes || []).filter(t => t.exemption_type).length;

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="w-4 h-4 text-primary" /></div>
          <div><p className="text-lg font-display font-bold">${totalBalance.toLocaleString()}</p><p className="text-[11px] text-muted-foreground">Balance Due</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-destructive" /></div>
          <div><p className="text-lg font-display font-bold">{overdueCount}</p><p className="text-[11px] text-muted-foreground">Overdue</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Scale className="w-4 h-4 text-blue-700 dark:text-blue-300" /></div>
          <div><p className="text-lg font-display font-bold">{activeProtests}</p><p className="text-[11px] text-muted-foreground">Protests</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center"><Shield className="w-4 h-4 text-accent-foreground" /></div>
          <div><p className="text-lg font-display font-bold">{exemptionCount}</p><p className="text-[11px] text-muted-foreground">Exemptions</p></div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground"><strong>{taxes?.length || 0}</strong> tax records</p>
        <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Tax Year</Button>
      </div>

      {/* Table */}
      {(taxes || []).length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-8"></TableHead>
                <TableHead className="font-semibold">Year</TableHead>
                <TableHead className="font-semibold">Assessed Value</TableHead>
                <TableHead className="font-semibold">Tax Amount</TableHead>
                <TableHead className="font-semibold">Balance</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Exemption</TableHead>
                <TableHead className="font-semibold">Protest</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(taxes || []).map(tax => {
                const isExpanded = expandedRows.has(tax.id);
                return (
                  <>
                    <TableRow key={tax.id} className="cursor-pointer hover:bg-muted/30" onClick={() => toggleRow(tax.id)}>
                      <TableCell className="w-8 px-2">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="font-medium">{tax.tax_year}</TableCell>
                      <TableCell className="text-sm">{tax.assessed_value ? `$${tax.assessed_value.toLocaleString()}` : '—'}</TableCell>
                      <TableCell className="text-sm">{tax.tax_amount ? `$${tax.tax_amount.toLocaleString()}` : '—'}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {tax.balance_due != null && tax.balance_due > 0
                          ? <span className="text-destructive">${tax.balance_due.toLocaleString()}</span>
                          : <span className="text-success">$0</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={PAYMENT_STATUS_COLORS[tax.payment_status] || ''}>{tax.payment_status}</Badge>
                      </TableCell>
                      <TableCell>
                        {tax.exemption_type && (
                          <Badge variant="outline" className="bg-accent/50 text-accent-foreground">
                            {EXEMPTION_LABELS[tax.exemption_type] || tax.exemption_type}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {tax.protest_status !== 'none' && (
                          <Badge variant="outline" className={PROTEST_STATUS_COLORS[tax.protest_status] || ''}>
                            {PROTEST_STATUS_LABELS[tax.protest_status]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tax)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTax(tax.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${tax.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={9} className="p-4">
                          <div className="space-y-4">
                            {/* Quarterly Breakdown */}
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Quarterly Installments</h4>
                              <div className="grid grid-cols-4 gap-3">
                                {Q_KEYS.map((q, i) => {
                                  const status = tax[`${q}_status` as keyof TaxRecord] as string || 'unpaid';
                                  const amount = tax[`${q}_amount` as keyof TaxRecord] as number | null;
                                  const paid = (tax[`${q}_paid` as keyof TaxRecord] as number) || 0;
                                  const dueDate = tax[`${q}_due_date` as keyof TaxRecord] as string | null;
                                  const isOverdue = status !== 'paid' && status !== 'exempt' && dueDate && new Date(dueDate) < new Date();
                                  return (
                                    <div key={q} className="bg-card rounded-lg border border-border p-2.5">
                                      <p className="text-xs font-medium text-muted-foreground mb-1">{Q_LABELS[i]}</p>
                                      <div className="flex items-center gap-1 mb-0.5">
                                        <Badge variant="outline" className={`text-[10px] py-0 ${PAYMENT_STATUS_COLORS[status] || ''}`}>{status}</Badge>
                                        {isOverdue && <Badge variant="destructive" className="text-[10px] py-0">Late</Badge>}
                                      </div>
                                      {amount != null && <p className="text-xs text-muted-foreground">${paid.toLocaleString()} / ${amount.toLocaleString()}</p>}
                                      {dueDate && <p className="text-[10px] text-muted-foreground">{format(new Date(dueDate), 'MM/dd/yy')}</p>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                              {/* Exemption */}
                              {tax.exemption_type && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Exemption</p>
                                  <p className="text-sm font-medium">{EXEMPTION_LABELS[tax.exemption_type] || tax.exemption_type}</p>
                                  {tax.exemption_start_date && <p className="text-xs text-muted-foreground">From: {format(new Date(tax.exemption_start_date), 'MM/dd/yyyy')}</p>}
                                  {tax.exemption_end_date && <p className="text-xs text-muted-foreground">To: {format(new Date(tax.exemption_end_date), 'MM/dd/yyyy')}</p>}
                                  {tax.exemption_notes && <p className="text-xs text-muted-foreground mt-1">{tax.exemption_notes}</p>}
                                </div>
                              )}
                              {/* Attorney */}
                              {tax.attorney_name && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Attorney</p>
                                  <p className="text-sm font-medium">{tax.attorney_name}</p>
                                  {tax.attorney_firm && <p className="text-xs text-muted-foreground">{tax.attorney_firm}</p>}
                                  {tax.attorney_phone && <p className="text-xs text-muted-foreground">{tax.attorney_phone}</p>}
                                  {tax.attorney_email && <p className="text-xs text-muted-foreground">{tax.attorney_email}</p>}
                                  {tax.attorney_fee && <p className="text-xs text-muted-foreground">Fee: ${tax.attorney_fee.toLocaleString()}</p>}
                                </div>
                              )}
                              {/* Due/Paid Dates */}
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Dates</p>
                                {tax.due_date && <p className="text-xs">Due: {format(new Date(tax.due_date), 'MM/dd/yyyy')}</p>}
                                {tax.paid_date && <p className="text-xs">Paid: {format(new Date(tax.paid_date), 'MM/dd/yyyy')}</p>}
                                {tax.tax_rate && <p className="text-xs">Rate: {tax.tax_rate} per $100</p>}
                              </div>
                              {/* Tenant */}
                              {tax.tenant_responsible && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Tenant Responsible</p>
                                  <p className="text-sm font-medium">{tax.tenant_name || 'Yes'}</p>
                                </div>
                              )}
                            </div>
                            {tax.notes && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                                <p className="text-sm">{tax.notes}</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No tax records</h3>
          <p className="text-muted-foreground text-sm mb-4">Add annual tax records to track payments, exemptions, and protests.</p>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Tax Year</Button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Tax Record' : 'Add Tax Year'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="core" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="core">Core</TabsTrigger>
              <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
              <TabsTrigger value="exemption">Exemption</TabsTrigger>
              <TabsTrigger value="protest">Protest</TabsTrigger>
            </TabsList>

            <TabsContent value="core" className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Tax Year</Label><Input type="number" value={form.tax_year} onChange={e => setForm({ ...form, tax_year: parseInt(e.target.value) || 0 })} /></div>
                <div><Label>Assessed Value</Label><Input type="number" placeholder="0" value={form.assessed_value} onChange={e => setForm({ ...form, assessed_value: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Tax Amount</Label><Input type="number" placeholder="0" value={form.tax_amount} onChange={e => setForm({ ...form, tax_amount: e.target.value })} /></div>
                <div><Label>Amount Paid</Label><Input type="number" placeholder="0" value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: e.target.value })} /></div>
              </div>
              <div><Label>Tax Rate (per $100)</Label><Input type="number" step="0.001" placeholder="e.g. 10.694" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">Balance is auto-calculated: Tax Amount − Amount Paid</p>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Payment Status</Label>
                  <Select value={form.payment_status} onValueChange={v => setForm({ ...form, payment_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="exempt">Exempt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <div><Label>Paid Date</Label><Input type="date" value={form.paid_date} onChange={e => setForm({ ...form, paid_date: e.target.value })} /></div>
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="flex items-center gap-1.5">Tenant Responsible</Label>
                  <Switch checked={form.tenant_responsible} onCheckedChange={v => setForm({ ...form, tenant_responsible: v })} />
                </div>
                {form.tenant_responsible && (
                  <div><Label>Tenant Name</Label><Input placeholder="Tenant name" value={form.tenant_name} onChange={e => setForm({ ...form, tenant_name: e.target.value })} /></div>
                )}
              </div>
              <div><Label>Notes</Label><Textarea placeholder="Additional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </TabsContent>

            <TabsContent value="quarterly" className="space-y-4 mt-3">
              <p className="text-xs text-muted-foreground">NYC property taxes are due quarterly. Track each installment separately.</p>
              {Q_KEYS.map((q, i) => (
                <div key={q} className="border border-border rounded-lg p-3 space-y-2">
                  <h4 className="text-sm font-medium">{Q_LABELS[i]}</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-xs">Amount</Label><Input type="number" value={form[`${q}_amount` as keyof typeof form] as string} onChange={e => setForm({ ...form, [`${q}_amount`]: e.target.value })} /></div>
                    <div><Label className="text-xs">Paid</Label><Input type="number" value={form[`${q}_paid` as keyof typeof form] as string} onChange={e => setForm({ ...form, [`${q}_paid`]: e.target.value })} /></div>
                    <div><Label className="text-xs">Due Date</Label><Input type="date" value={form[`${q}_due_date` as keyof typeof form] as string} onChange={e => setForm({ ...form, [`${q}_due_date`]: e.target.value })} /></div>
                  </div>
                  <div><Label className="text-xs">Status</Label>
                    <Select value={form[`${q}_status` as keyof typeof form] as string} onValueChange={v => setForm({ ...form, [`${q}_status`]: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="exempt">Exempt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="exemption" className="space-y-3 mt-3">
              <div><Label>Exemption Type</Label>
                <Select value={form.exemption_type} onValueChange={v => setForm({ ...form, exemption_type: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="421a">421-a</SelectItem>
                    <SelectItem value="icap">ICAP</SelectItem>
                    <SelectItem value="j51">J-51</SelectItem>
                    <SelectItem value="star">STAR</SelectItem>
                    <SelectItem value="dhcr">DHCR</SelectItem>
                    <SelectItem value="veterans">Veterans</SelectItem>
                    <SelectItem value="senior">Senior Citizen</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date</Label><Input type="date" value={form.exemption_start_date} onChange={e => setForm({ ...form, exemption_start_date: e.target.value })} /></div>
                <div><Label>End Date</Label><Input type="date" value={form.exemption_end_date} onChange={e => setForm({ ...form, exemption_end_date: e.target.value })} /></div>
              </div>
              <div><Label>Exemption Notes</Label><Input value={form.exemption_notes} onChange={e => setForm({ ...form, exemption_notes: e.target.value })} placeholder="Details about this exemption" /></div>
            </TabsContent>

            <TabsContent value="protest" className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Protest Status</Label>
                  <Select value={form.protest_status} onValueChange={v => setForm({ ...form, protest_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="filed">Filed</SelectItem>
                      <SelectItem value="pending_hearing">Pending Hearing</SelectItem>
                      <SelectItem value="decided_favorable">Decided – Favorable</SelectItem>
                      <SelectItem value="decided_unfavorable">Decided – Unfavorable</SelectItem>
                      <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Filed Date</Label><Input type="date" value={form.protest_filed_date} onChange={e => setForm({ ...form, protest_filed_date: e.target.value })} /></div>
              </div>
              <div><Label>Hearing Date</Label><Input type="date" value={form.protest_hearing_date} onChange={e => setForm({ ...form, protest_hearing_date: e.target.value })} /></div>
              <div><Label>Outcome Notes</Label><Textarea placeholder="Protest outcome details..." value={form.protest_outcome_notes} onChange={e => setForm({ ...form, protest_outcome_notes: e.target.value })} /></div>
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5"><Scale className="w-4 h-4" /> Attorney Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Attorney Name</Label><Input placeholder="Name" value={form.attorney_name} onChange={e => setForm({ ...form, attorney_name: e.target.value })} /></div>
                  <div><Label>Law Firm</Label><Input placeholder="Firm" value={form.attorney_firm} onChange={e => setForm({ ...form, attorney_firm: e.target.value })} /></div>
                  <div><Label>Fee ($)</Label><Input type="number" placeholder="0" value={form.attorney_fee} onChange={e => setForm({ ...form, attorney_fee: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input placeholder="Phone" value={form.attorney_phone} onChange={e => setForm({ ...form, attorney_phone: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Email</Label><Input type="email" placeholder="Email" value={form.attorney_email} onChange={e => setForm({ ...form, attorney_email: e.target.value })} /></div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <Button className="w-full mt-4" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update Record' : 'Add Record'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
