import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Loader2, Users, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays, format, parseISO } from 'date-fns';
import { TenantInsuranceSection } from './TenantInsuranceSection';
import { TenantLeaseDetails } from './TenantLeaseDetails';

interface Tenant {
  id: string;
  property_id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  unit_number: string | null;
  lease_start: string | null;
  lease_end: string | null;
  rent_amount: number | null;
  escalation_notes: string | null;
  renewal_option_date: string | null;
  security_deposit: number | null;
  lease_type: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  // CRE enrichment fields
  tenant_sqft: number | null;
  annual_escalation_pct: number | null;
  option_terms: string | null;
  use_clause: string | null;
  guarantor_name: string | null;
  guarantor_phone: string | null;
  move_in_date: string | null;
  parking_spaces: number | null;
  ti_allowance: number | null;
  percentage_rent: number | null;
  percentage_rent_breakpoint: number | null;
}

const EMPTY_FORM = {
  company_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  unit_number: '',
  lease_start: '',
  lease_end: '',
  rent_amount: '',
  escalation_notes: '',
  renewal_option_date: '',
  security_deposit: '',
  lease_type: 'gross',
  status: 'active',
  notes: '',
  // CRE fields
  tenant_sqft: '',
  annual_escalation_pct: '',
  option_terms: '',
  use_clause: '',
  guarantor_name: '',
  guarantor_phone: '',
  move_in_date: '',
  parking_spaces: '',
  ti_allowance: '',
  percentage_rent: '',
  percentage_rent_breakpoint: '',
};

interface PropertyTenantsTabProps {
  propertyId: string;
}

export const PropertyTenantsTab = ({ propertyId }: PropertyTenantsTabProps) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());

  const fetchTenants = async () => {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('property_id', propertyId)
      .order('status', { ascending: true })
      .order('company_name', { ascending: true });
    if (!error) setTenants((data as unknown as Tenant[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchTenants(); }, [propertyId]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (t: Tenant) => {
    setForm({
      company_name: t.company_name,
      contact_name: t.contact_name || '',
      contact_email: t.contact_email || '',
      contact_phone: t.contact_phone || '',
      unit_number: t.unit_number || '',
      lease_start: t.lease_start || '',
      lease_end: t.lease_end || '',
      rent_amount: t.rent_amount?.toString() || '',
      escalation_notes: t.escalation_notes || '',
      renewal_option_date: t.renewal_option_date || '',
      security_deposit: t.security_deposit?.toString() || '',
      lease_type: t.lease_type || 'gross',
      status: t.status,
      notes: t.notes || '',
      tenant_sqft: t.tenant_sqft?.toString() || '',
      annual_escalation_pct: t.annual_escalation_pct?.toString() || '',
      option_terms: t.option_terms || '',
      use_clause: t.use_clause || '',
      guarantor_name: t.guarantor_name || '',
      guarantor_phone: t.guarantor_phone || '',
      move_in_date: t.move_in_date || '',
      parking_spaces: t.parking_spaces?.toString() || '',
      ti_allowance: t.ti_allowance?.toString() || '',
      percentage_rent: t.percentage_rent?.toString() || '',
      percentage_rent_breakpoint: t.percentage_rent_breakpoint?.toString() || '',
    });
    setEditingId(t.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.company_name.trim()) {
      toast.error('Company name is required');
      return;
    }
    setSaving(true);
    const payload = {
      property_id: propertyId,
      company_name: form.company_name.trim(),
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      unit_number: form.unit_number || null,
      lease_start: form.lease_start || null,
      lease_end: form.lease_end || null,
      rent_amount: form.rent_amount ? parseFloat(form.rent_amount) : null,
      escalation_notes: form.escalation_notes || null,
      renewal_option_date: form.renewal_option_date || null,
      security_deposit: form.security_deposit ? parseFloat(form.security_deposit) : null,
      lease_type: form.lease_type,
      status: form.status,
      notes: form.notes || null,
      tenant_sqft: form.tenant_sqft ? parseFloat(form.tenant_sqft) : null,
      annual_escalation_pct: form.annual_escalation_pct ? parseFloat(form.annual_escalation_pct) : null,
      option_terms: form.option_terms || null,
      use_clause: form.use_clause || null,
      guarantor_name: form.guarantor_name || null,
      guarantor_phone: form.guarantor_phone || null,
      move_in_date: form.move_in_date || null,
      parking_spaces: form.parking_spaces ? parseInt(form.parking_spaces) : null,
      ti_allowance: form.ti_allowance ? parseFloat(form.ti_allowance) : null,
      percentage_rent: form.percentage_rent ? parseFloat(form.percentage_rent) : null,
      percentage_rent_breakpoint: form.percentage_rent_breakpoint ? parseFloat(form.percentage_rent_breakpoint) : null,
    };

    const { error } = editingId
      ? await supabase.from('tenants').update(payload).eq('id', editingId)
      : await supabase.from('tenants').insert(payload);

    setSaving(false);
    if (error) {
      toast.error('Failed to save tenant');
    } else {
      toast.success(editingId ? 'Tenant updated' : 'Tenant added');
      setDialogOpen(false);
      fetchTenants();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('tenants').delete().eq('id', id);
    if (error) toast.error('Failed to delete');
    else { toast.success('Tenant removed'); fetchTenants(); }
  };

  const getLeaseStatusBadge = (t: Tenant) => {
    if (!t.lease_end) return null;
    const days = differenceInDays(parseISO(t.lease_end), new Date());
    if (days < 0) return <Badge variant="destructive" className="text-[10px]">Expired</Badge>;
    if (days <= 30) return <Badge className="bg-destructive/80 text-destructive-foreground text-[10px]">{days}d left</Badge>;
    if (days <= 90) return <Badge className="bg-warning/80 text-warning-foreground text-[10px]">{days}d left</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{days}d left</Badge>;
  };

  const activeTenants = tenants.filter(t => t.status === 'active');
  const totalRent = activeTenants.reduce((s, t) => s + (t.rent_amount || 0), 0);
  const totalSqft = activeTenants.reduce((s, t) => s + (t.tenant_sqft || 0), 0);
  const avgPsfRent = totalSqft > 0 ? (totalRent * 12) / totalSqft : null;
  const expiringCount = activeTenants.filter(t => t.lease_end && differenceInDays(parseISO(t.lease_end), new Date()) <= 90).length;

  const setField = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const toggleExpanded = (id: string) => {
    setExpandedTenants(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getRentPerSqft = (t: Tenant) => {
    if (!t.rent_amount || !t.tenant_sqft || t.tenant_sqft === 0) return null;
    return ((t.rent_amount * 12) / t.tenant_sqft).toFixed(2);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-4 text-center">
          <div className="text-2xl font-bold text-foreground">{activeTenants.length}</div>
          <div className="text-xs text-muted-foreground">Active Tenants</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <div className="text-2xl font-bold text-foreground">${totalRent.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Monthly Rent</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <div className={`text-2xl font-bold ${expiringCount > 0 ? 'text-warning' : 'text-foreground'}`}>{expiringCount}</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            {expiringCount > 0 && <AlertTriangle className="w-3 h-3 text-warning" />}
            Leases Expiring ≤90d
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <div className="text-2xl font-bold text-foreground">
            {avgPsfRent != null ? `$${parseFloat(avgPsfRent as unknown as string).toFixed(2)}` : '—'}
          </div>
          <div className="text-xs text-muted-foreground">Avg $/SF (Annual)</div>
        </CardContent></Card>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5" /> Tenant Directory</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Add Tenant</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? 'Edit Tenant' : 'Add Tenant'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              {/* Core Info */}
              <div className="col-span-2"><Label>Company Name *</Label><Input value={form.company_name} onChange={e => setField('company_name', e.target.value)} /></div>
              <div><Label>Unit / Suite</Label><Input value={form.unit_number} onChange={e => setField('unit_number', e.target.value)} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setField('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setField('contact_name', e.target.value)} /></div>
              <div><Label>Contact Email</Label><Input type="email" value={form.contact_email} onChange={e => setField('contact_email', e.target.value)} /></div>
              <div><Label>Contact Phone</Label><Input value={form.contact_phone} onChange={e => setField('contact_phone', e.target.value)} /></div>
              <div><Label>Lease Type</Label>
                <Select value={form.lease_type} onValueChange={v => setField('lease_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gross">Gross</SelectItem>
                    <SelectItem value="nnn">NNN</SelectItem>
                    <SelectItem value="modified_gross">Modified Gross</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Space */}
              <div className="col-span-2 mt-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Space</p></div>
              <div><Label>Sq Ft</Label><Input type="number" value={form.tenant_sqft} onChange={e => setField('tenant_sqft', e.target.value)} /></div>
              <div><Label>Parking Spaces</Label><Input type="number" value={form.parking_spaces} onChange={e => setField('parking_spaces', e.target.value)} /></div>

              {/* Dates */}
              <div className="col-span-2 mt-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dates</p></div>
              <div><Label>Lease Start</Label><Input type="date" value={form.lease_start} onChange={e => setField('lease_start', e.target.value)} /></div>
              <div><Label>Lease End</Label><Input type="date" value={form.lease_end} onChange={e => setField('lease_end', e.target.value)} /></div>
              <div><Label>Move-in Date</Label><Input type="date" value={form.move_in_date} onChange={e => setField('move_in_date', e.target.value)} /></div>
              <div><Label>Renewal Option Date</Label><Input type="date" value={form.renewal_option_date} onChange={e => setField('renewal_option_date', e.target.value)} /></div>

              {/* Financial */}
              <div className="col-span-2 mt-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financial</p></div>
              <div><Label>Monthly Rent ($)</Label><Input type="number" value={form.rent_amount} onChange={e => setField('rent_amount', e.target.value)} /></div>
              <div><Label>Security Deposit ($)</Label><Input type="number" value={form.security_deposit} onChange={e => setField('security_deposit', e.target.value)} /></div>
              <div><Label>Annual Escalation %</Label><Input type="number" step="0.1" value={form.annual_escalation_pct} onChange={e => setField('annual_escalation_pct', e.target.value)} /></div>
              <div><Label>TI Allowance ($)</Label><Input type="number" value={form.ti_allowance} onChange={e => setField('ti_allowance', e.target.value)} /></div>
              <div><Label>Percentage Rent %</Label><Input type="number" step="0.1" value={form.percentage_rent} onChange={e => setField('percentage_rent', e.target.value)} /></div>
              <div><Label>Breakpoint ($)</Label><Input type="number" value={form.percentage_rent_breakpoint} onChange={e => setField('percentage_rent_breakpoint', e.target.value)} /></div>

              {/* Lease Terms */}
              <div className="col-span-2 mt-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lease Terms</p></div>
              <div className="col-span-2"><Label>Use Clause</Label><Input value={form.use_clause} onChange={e => setField('use_clause', e.target.value)} placeholder="e.g. Retail, Office, Warehouse" /></div>
              <div className="col-span-2"><Label>Option Terms</Label><Input value={form.option_terms} onChange={e => setField('option_terms', e.target.value)} placeholder="e.g. 2x 5-year options at FMV" /></div>
              <div><Label>Guarantor Name</Label><Input value={form.guarantor_name} onChange={e => setField('guarantor_name', e.target.value)} /></div>
              <div><Label>Guarantor Phone</Label><Input value={form.guarantor_phone} onChange={e => setField('guarantor_phone', e.target.value)} /></div>

              {/* Notes */}
              <div className="col-span-2 mt-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</p></div>
              <div className="col-span-2"><Label>Escalation Notes</Label><Textarea value={form.escalation_notes} onChange={e => setField('escalation_notes', e.target.value)} className="min-h-[60px]" /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setField('notes', e.target.value)} className="min-h-[60px]" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {editingId ? 'Update' : 'Add'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tenant Table */}
      {tenants.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No tenants yet</p>
          <p className="text-sm">Add your first tenant to start tracking leases.</p>
        </CardContent></Card>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Lease Type</TableHead>
                <TableHead>Sq Ft</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>$/SF</TableHead>
                <TableHead>Lease End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map(t => (
                <>
                <TableRow key={t.id} className="cursor-pointer" onClick={() => toggleExpanded(t.id)}>
                  <TableCell className="w-8 py-2">
                    {expandedTenants.has(t.id) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{t.company_name}</div>
                      {t.contact_name && <div className="text-xs text-muted-foreground">{t.contact_name}</div>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{t.unit_number || '—'}</TableCell>
                  <TableCell className="text-sm capitalize">{(t.lease_type || 'gross').replace('_', ' ')}</TableCell>
                  <TableCell className="text-sm">{t.tenant_sqft ? t.tenant_sqft.toLocaleString() : '—'}</TableCell>
                  <TableCell className="text-sm">{t.rent_amount ? `$${t.rent_amount.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-sm">{getRentPerSqft(t) ? `$${getRentPerSqft(t)}` : '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{t.lease_end ? format(parseISO(t.lease_end), 'MMM d, yyyy') : '—'}</span>
                      {getLeaseStatusBadge(t)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.status === 'active' ? 'default' : t.status === 'pending' ? 'secondary' : 'outline'} className="text-[10px]">
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedTenants.has(t.id) && (
                  <TableRow>
                    <TableCell colSpan={10} className="bg-muted/20 px-6 py-3">
                      <TenantInsuranceSection tenantId={t.id} propertyId={propertyId} tenantName={t.company_name} />
                      <TenantLeaseDetails tenant={t} />
                    </TableCell>
                  </TableRow>
                )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
