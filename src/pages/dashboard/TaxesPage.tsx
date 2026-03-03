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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, AlertTriangle, Scale, Building2, Plus, Loader2, Shield, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
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

const EXEMPTION_LABELS: Record<string, string> = {
  '421a': '421-a', icap: 'ICAP', j51: 'J-51', star: 'STAR', dhcr: 'DHCR', veterans: 'Veterans', senior: 'Senior Citizen', other: 'Other',
};

const Q_LABELS = ['Q1 (Jul)', 'Q2 (Oct)', 'Q3 (Jan)', 'Q4 (Apr)'] as const;
const Q_KEYS = ['q1', 'q2', 'q3', 'q4'] as const;

const EMPTY_FORM = {
  property_id: '', tax_year: new Date().getFullYear().toString(), assessed_value: '',
  tax_amount: '', amount_paid: '', due_date: '', payment_status: 'unpaid',
  protest_status: 'none', tenant_responsible: false, tenant_name: '',
  exemption_type: '', exemption_start_date: '', exemption_end_date: '', exemption_notes: '',
  q1_amount: '', q1_paid: '', q1_due_date: '', q1_status: 'unpaid',
  q2_amount: '', q2_paid: '', q2_due_date: '', q2_status: 'unpaid',
  q3_amount: '', q3_paid: '', q3_due_date: '', q3_status: 'unpaid',
  q4_amount: '', q4_paid: '', q4_due_date: '', q4_status: 'unpaid',
  attorney_name: '', attorney_firm: '', attorney_fee: '', attorney_phone: '', attorney_email: '',
};

const TaxesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
      const payload: any = {
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
        exemption_type: form.exemption_type || null,
        exemption_start_date: form.exemption_start_date || null,
        exemption_end_date: form.exemption_end_date || null,
        exemption_notes: form.exemption_notes || null,
        attorney_name: form.attorney_name || null,
        attorney_firm: form.attorney_firm || null,
        attorney_fee: form.attorney_fee ? parseFloat(form.attorney_fee) : null,
        attorney_phone: form.attorney_phone || null,
        attorney_email: form.attorney_email || null,
      };
      for (const q of Q_KEYS) {
        payload[`${q}_amount`] = form[`${q}_amount` as keyof typeof form] ? parseFloat(form[`${q}_amount` as keyof typeof form] as string) : null;
        payload[`${q}_paid`] = form[`${q}_paid` as keyof typeof form] ? parseFloat(form[`${q}_paid` as keyof typeof form] as string) : 0;
        payload[`${q}_due_date`] = form[`${q}_due_date` as keyof typeof form] || null;
        payload[`${q}_status`] = form[`${q}_status` as keyof typeof form] || 'unpaid';
      }
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

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalBalance = (taxes || []).reduce((sum, t) => sum + (t.balance_due || 0), 0);
  const overdueCount = (taxes || []).filter(t => t.payment_status === 'unpaid' && t.due_date && new Date(t.due_date) < new Date()).length;
  const activeProtests = (taxes || []).filter(t => ['filed', 'pending_hearing'].includes(t.protest_status || '')).length;
  const propertyCount = new Set((taxes || []).map(t => t.property_id)).size;
  const exemptionCount = (taxes || []).filter(t => t.exemption_type).length;

  // Quarterly overdue count
  const qOverdueCount = (taxes || []).reduce((count, t) => {
    return count + Q_KEYS.filter(q => {
      const status = t[`${q}_status`];
      const dueDate = t[`${q}_due_date`];
      return status !== 'paid' && status !== 'exempt' && dueDate && new Date(dueDate) < new Date();
    }).length;
  }, 0);

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

  const renderQuarterlyStatus = (tax: any, q: string) => {
    const status = tax[`${q}_status`] || 'unpaid';
    const amount = tax[`${q}_amount`];
    const paid = tax[`${q}_paid`] || 0;
    const dueDate = tax[`${q}_due_date`];
    const isOverdue = status !== 'paid' && status !== 'exempt' && dueDate && new Date(dueDate) < new Date();

    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <Badge variant="outline" className={`text-[10px] py-0 ${PAYMENT_STATUS_COLORS[status] || ''}`}>{status}</Badge>
          {isOverdue && <Badge variant="destructive" className="text-[10px] py-0">Late</Badge>}
        </div>
        {amount != null && (
          <span className="text-xs text-muted-foreground">
            ${paid.toLocaleString()} / ${amount.toLocaleString()}
          </span>
        )}
        {dueDate && <span className="text-[10px] text-muted-foreground">{format(new Date(dueDate), 'MM/dd/yy')}</span>}
      </div>
    );
  };

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
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Tax Record</DialogTitle></DialogHeader>
            <Tabs defaultValue="core" className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="core">Core</TabsTrigger>
                <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
                <TabsTrigger value="exemption">Exemption</TabsTrigger>
                <TabsTrigger value="protest">Protest</TabsTrigger>
              </TabsList>

              <TabsContent value="core" className="space-y-3 mt-3">
                <div>
                  <Label>Property *</Label>
                  <Select value={form.property_id} onValueChange={v => setField('property_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                    <SelectContent>{(properties || []).map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                  <div><Label>Tenant Name</Label><Input value={form.tenant_name} onChange={e => setField('tenant_name', e.target.value)} placeholder="If tenant responsible" /></div>
                </div>
              </TabsContent>

              <TabsContent value="quarterly" className="space-y-4 mt-3">
                <p className="text-xs text-muted-foreground">NYC property taxes are due quarterly. Track each installment separately.</p>
                {Q_KEYS.map((q, i) => (
                  <div key={q} className="border border-border rounded-lg p-3 space-y-2">
                    <h4 className="text-sm font-medium">{Q_LABELS[i]}</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">Amount</Label><Input type="number" value={form[`${q}_amount` as keyof typeof form] as string} onChange={e => setField(`${q}_amount`, e.target.value)} /></div>
                      <div><Label className="text-xs">Paid</Label><Input type="number" value={form[`${q}_paid` as keyof typeof form] as string} onChange={e => setField(`${q}_paid`, e.target.value)} /></div>
                      <div><Label className="text-xs">Due Date</Label><Input type="date" value={form[`${q}_due_date` as keyof typeof form] as string} onChange={e => setField(`${q}_due_date`, e.target.value)} /></div>
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={form[`${q}_status` as keyof typeof form] as string} onValueChange={v => setField(`${q}_status`, v)}>
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
                <div>
                  <Label>Exemption Type</Label>
                  <Select value={form.exemption_type} onValueChange={v => setField('exemption_type', v)}>
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
                  <div><Label>Start Date</Label><Input type="date" value={form.exemption_start_date} onChange={e => setField('exemption_start_date', e.target.value)} /></div>
                  <div><Label>End Date</Label><Input type="date" value={form.exemption_end_date} onChange={e => setField('exemption_end_date', e.target.value)} /></div>
                </div>
                <div><Label>Exemption Notes</Label><Input value={form.exemption_notes} onChange={e => setField('exemption_notes', e.target.value)} placeholder="Details about this exemption" /></div>
              </TabsContent>

              <TabsContent value="protest" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
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
                </div>
                <div className="border-t border-border pt-3">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5"><Scale className="w-4 h-4" /> Attorney Details</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Attorney Name</Label><Input value={form.attorney_name} onChange={e => setField('attorney_name', e.target.value)} /></div>
                    <div><Label>Law Firm</Label><Input value={form.attorney_firm} onChange={e => setField('attorney_firm', e.target.value)} /></div>
                    <div><Label>Fee ($)</Label><Input type="number" value={form.attorney_fee} onChange={e => setField('attorney_fee', e.target.value)} /></div>
                    <div><Label>Phone</Label><Input value={form.attorney_phone} onChange={e => setField('attorney_phone', e.target.value)} /></div>
                    <div className="col-span-2"><Label>Email</Label><Input type="email" value={form.attorney_email} onChange={e => setField('attorney_email', e.target.value)} /></div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xl font-display font-bold">${totalBalance.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Balance</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
          <div><p className="text-xl font-display font-bold">{overdueCount}</p><p className="text-xs text-muted-foreground">Overdue</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Calendar className="w-5 h-5 text-warning" /></div>
          <div><p className="text-xl font-display font-bold">{qOverdueCount}</p><p className="text-xs text-muted-foreground">Q Installments Late</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Scale className="w-5 h-5 text-blue-700 dark:text-blue-300" /></div>
          <div><p className="text-xl font-display font-bold">{activeProtests}</p><p className="text-xs text-muted-foreground">Active Protests</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center"><Shield className="w-5 h-5 text-accent-foreground" /></div>
          <div><p className="text-xl font-display font-bold">{exemptionCount}</p><p className="text-xs text-muted-foreground">Exemptions</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><Building2 className="w-5 h-5 text-foreground" /></div>
          <div><p className="text-xl font-display font-bold">{propertyCount}</p><p className="text-xs text-muted-foreground">Properties</p></div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Records</TabsTrigger>
          <TabsTrigger value="quarterly">Quarterly View</TabsTrigger>
          <TabsTrigger value="exemptions">Exemptions</TabsTrigger>
          <TabsTrigger value="protests">Protests</TabsTrigger>
        </TabsList>

        {/* All Records Tab */}
        <TabsContent value="all">
          {(taxes || []).length > 0 ? (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="font-semibold">Property</TableHead>
                    <TableHead className="font-semibold">Year</TableHead>
                    <TableHead className="font-semibold">Tax Amount</TableHead>
                    <TableHead className="font-semibold">Balance</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Due Date</TableHead>
                    <TableHead className="font-semibold">Exemption</TableHead>
                    <TableHead className="font-semibold">Protest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(taxes || []).map(tax => {
                    const isExpanded = expandedRows.has(tax.id);
                    const isOverdue = tax.due_date && tax.payment_status !== 'paid' && tax.payment_status !== 'exempt' && new Date(tax.due_date) < new Date();
                    const isDueSoon = tax.due_date && tax.payment_status !== 'paid' && tax.payment_status !== 'exempt' && (() => {
                      const days = Math.ceil((new Date(tax.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return days > 0 && days <= 30;
                    })();
                    return (
                      <>
                        <TableRow key={tax.id} className="cursor-pointer hover:bg-muted/30" onClick={() => toggleRow(tax.id)}>
                          <TableCell className="w-8 px-2">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="font-medium text-sm max-w-[200px] truncate">{tax.properties?.address || '—'}</TableCell>
                          <TableCell className="font-medium">{tax.tax_year}</TableCell>
                          <TableCell className="text-sm">{tax.tax_amount ? `$${tax.tax_amount.toLocaleString()}` : '—'}</TableCell>
                          <TableCell className="text-sm font-medium">
                            {tax.balance_due != null && tax.balance_due > 0
                              ? <span className="text-destructive">${tax.balance_due.toLocaleString()}</span>
                              : <span className="text-success">$0</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className={PAYMENT_STATUS_COLORS[tax.payment_status] || ''}>{tax.payment_status}</Badge>
                              {isOverdue && <Badge variant="destructive" className="text-[10px] py-0">Overdue</Badge>}
                              {isDueSoon && <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px] py-0">Due Soon</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{tax.due_date ? format(new Date(tax.due_date), 'MM/dd/yy') : '—'}</TableCell>
                          <TableCell>
                            {tax.exemption_type && (
                              <Badge variant="outline" className="bg-accent/50 text-accent-foreground">
                                {EXEMPTION_LABELS[tax.exemption_type] || tax.exemption_type}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {tax.protest_status && tax.protest_status !== 'none' && (
                              <Badge variant="outline" className={PROTEST_STATUS_COLORS[tax.protest_status] || ''}>
                                {PROTEST_STATUS_LABELS[tax.protest_status] || tax.protest_status}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${tax.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={9} className="p-4">
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Quarterly Breakdown */}
                                <div className="col-span-2 lg:col-span-4">
                                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Quarterly Installments</h4>
                                  <div className="grid grid-cols-4 gap-3">
                                    {Q_KEYS.map((q, i) => (
                                      <div key={q} className="bg-card rounded-lg border border-border p-2.5">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">{Q_LABELS[i]}</p>
                                        {renderQuarterlyStatus(tax, q)}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {/* Exemption */}
                                {tax.exemption_type && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Exemption</p>
                                    <p className="text-sm font-medium">{EXEMPTION_LABELS[tax.exemption_type] || tax.exemption_type}</p>
                                    {tax.exemption_end_date && (
                                      <p className="text-xs text-muted-foreground">Expires: {format(new Date(tax.exemption_end_date), 'MM/dd/yyyy')}</p>
                                    )}
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
                                    {tax.attorney_fee && <p className="text-xs text-muted-foreground">Fee: ${tax.attorney_fee.toLocaleString()}</p>}
                                  </div>
                                )}
                                {/* Tenant */}
                                {tax.tenant_responsible && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Tenant Responsible</p>
                                    <p className="text-sm font-medium">{tax.tenant_name || 'Yes'}</p>
                                  </div>
                                )}
                                {/* Navigate link */}
                                <div className="flex items-end">
                                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/properties/${tax.property_id}`); }}>
                                    View Property
                                  </Button>
                                </div>
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
              <p className="text-muted-foreground text-sm">Click "Add Tax Record" to get started.</p>
            </div>
          )}
        </TabsContent>

        {/* Quarterly View */}
        <TabsContent value="quarterly">
          {(taxes || []).length > 0 ? (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Property</TableHead>
                    <TableHead className="font-semibold">Year</TableHead>
                    {Q_LABELS.map(label => <TableHead key={label} className="font-semibold">{label}</TableHead>)}
                    <TableHead className="font-semibold">Total Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(taxes || []).map(tax => (
                    <TableRow key={tax.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/dashboard/properties/${tax.property_id}`)}>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">{tax.properties?.address || '—'}</TableCell>
                      <TableCell className="font-medium">{tax.tax_year}</TableCell>
                      {Q_KEYS.map(q => <TableCell key={q}>{renderQuarterlyStatus(tax, q)}</TableCell>)}
                      <TableCell className="text-sm font-medium">
                        {tax.balance_due != null && tax.balance_due > 0
                          ? <span className="text-destructive">${tax.balance_due.toLocaleString()}</span>
                          : <span className="text-success">$0</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm">No quarterly data available.</p>
            </div>
          )}
        </TabsContent>

        {/* Exemptions */}
        <TabsContent value="exemptions">
          {(() => {
            const exemptTaxes = (taxes || []).filter(t => t.exemption_type);
            return exemptTaxes.length > 0 ? (
              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Property</TableHead>
                      <TableHead className="font-semibold">Year</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Start</TableHead>
                      <TableHead className="font-semibold">End</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exemptTaxes.map(tax => {
                      const isExpiring = tax.exemption_end_date && (() => {
                        const days = Math.ceil((new Date(tax.exemption_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return days > 0 && days <= 365;
                      })();
                      const isExpired = tax.exemption_end_date && new Date(tax.exemption_end_date) < new Date();
                      return (
                        <TableRow key={tax.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/dashboard/properties/${tax.property_id}`)}>
                          <TableCell className="font-medium text-sm max-w-[200px] truncate">{tax.properties?.address || '—'}</TableCell>
                          <TableCell className="font-medium">{tax.tax_year}</TableCell>
                          <TableCell><Badge variant="outline" className="bg-accent/50 text-accent-foreground">{EXEMPTION_LABELS[tax.exemption_type] || tax.exemption_type}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{tax.exemption_start_date ? format(new Date(tax.exemption_start_date), 'MM/dd/yyyy') : '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{tax.exemption_end_date ? format(new Date(tax.exemption_end_date), 'MM/dd/yyyy') : '—'}</TableCell>
                          <TableCell>
                            {isExpired ? <Badge variant="destructive">Expired</Badge> : isExpiring ? <Badge className="bg-warning/10 text-warning border-warning/20">Expiring Soon</Badge> : <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{tax.exemption_notes || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">No exemptions tracked</h3>
                <p className="text-muted-foreground text-sm">Add exemption details when creating tax records.</p>
              </div>
            );
          })()}
        </TabsContent>

        {/* Protests */}
        <TabsContent value="protests">
          {(() => {
            const protestTaxes = (taxes || []).filter(t => t.protest_status && t.protest_status !== 'none');
            return protestTaxes.length > 0 ? (
              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Property</TableHead>
                      <TableHead className="font-semibold">Year</TableHead>
                      <TableHead className="font-semibold">Protest Status</TableHead>
                      <TableHead className="font-semibold">Attorney</TableHead>
                      <TableHead className="font-semibold">Firm</TableHead>
                      <TableHead className="font-semibold">Fee</TableHead>
                      <TableHead className="font-semibold">Tax Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {protestTaxes.map(tax => (
                      <TableRow key={tax.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/dashboard/properties/${tax.property_id}`)}>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate">{tax.properties?.address || '—'}</TableCell>
                        <TableCell className="font-medium">{tax.tax_year}</TableCell>
                        <TableCell><Badge variant="outline" className={PROTEST_STATUS_COLORS[tax.protest_status] || ''}>{PROTEST_STATUS_LABELS[tax.protest_status] || tax.protest_status}</Badge></TableCell>
                        <TableCell className="text-sm">{tax.attorney_name || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tax.attorney_firm || '—'}</TableCell>
                        <TableCell className="text-sm">{tax.attorney_fee ? `$${tax.attorney_fee.toLocaleString()}` : '—'}</TableCell>
                        <TableCell className="text-sm">{tax.tax_amount ? `$${tax.tax_amount.toLocaleString()}` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <Scale className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">No active protests</h3>
                <p className="text-muted-foreground text-sm">Track tax protests when filing with your attorney.</p>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TaxesPage;
