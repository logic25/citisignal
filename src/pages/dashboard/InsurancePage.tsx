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
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Plus, Loader2 } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

const POLICY_TYPES: Record<string, string> = {
  general_liability: 'General Liability', workers_comp: 'Workers Comp',
  property_contents: 'Property / Contents', umbrella: 'Umbrella / Excess',
  auto: 'Auto', other: 'Other',
};

const EMPTY_FORM = {
  property_id: '', tenant_id: '', policy_type: 'general_liability',
  carrier_name: '', policy_number: '', coverage_amount: '',
  required_minimum: '', expiration_date: '', additional_insured: false,
  additional_insured_required: false,
};

const InsurancePage = () => {
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

  const { data: tenants } = useQuery({
    queryKey: ['tenants-for-property', form.property_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('id, company_name').eq('property_id', form.property_id).order('company_name');
      if (error) throw error;
      return data;
    },
    enabled: !!form.property_id,
  });

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        property_id: form.property_id,
        tenant_id: form.tenant_id,
        policy_type: form.policy_type,
        carrier_name: form.carrier_name || null,
        policy_number: form.policy_number || null,
        coverage_amount: form.coverage_amount ? parseFloat(form.coverage_amount) : null,
        required_minimum: form.required_minimum ? parseFloat(form.required_minimum) : null,
        expiration_date: form.expiration_date || null,
        additional_insured: form.additional_insured,
        additional_insured_required: form.additional_insured_required,
        status: 'active',
      };
      const { error } = await supabase.from('tenant_insurance_policies').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Insurance policy added');
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['all-insurance-policies'] });
    },
    onError: () => toast.error('Failed to add policy'),
  });

  const setField = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const getComplianceInfo = (p: any) => {
    const isExpired = p.expiration_date && new Date(p.expiration_date) < new Date();
    const isBelowMin = p.required_minimum && p.coverage_amount && Number(p.coverage_amount) < Number(p.required_minimum);
    const missingAdditional = p.additional_insured_required && !p.additional_insured;
    if (isExpired) return { label: 'Expired', color: 'bg-destructive/10 text-destructive border-destructive/20' };
    if (isBelowMin || missingAdditional) return { label: 'Non-Compliant', color: 'bg-warning/10 text-warning border-warning/20' };
    if (p.expiration_date) {
      const days = differenceInDays(parseISO(p.expiration_date), new Date());
      if (days <= 30) return { label: `${days}d left`, color: 'bg-warning/10 text-warning border-warning/20' };
    }
    return { label: 'Compliant', color: 'bg-success/10 text-success border-success/20' };
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
    return (p.required_minimum && p.coverage_amount && Number(p.coverage_amount) < Number(p.required_minimum)) ||
      (p.additional_insured_required && !p.additional_insured);
  }).length;

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
          <h1 className="font-display text-2xl font-bold text-foreground">Insurance</h1>
          <p className="text-sm text-muted-foreground">Tenant insurance policies & COI tracking</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!properties?.length} onClick={() => setForm(EMPTY_FORM)}>
              <Plus className="w-4 h-4 mr-1" /> Add Policy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Insurance Policy</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Property *</Label>
                <Select value={form.property_id} onValueChange={v => { setField('property_id', v); setField('tenant_id', ''); }}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>{(properties || []).map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Tenant *</Label>
                <Select value={form.tenant_id} onValueChange={v => setField('tenant_id', v)} disabled={!form.property_id}>
                  <SelectTrigger><SelectValue placeholder={form.property_id ? "Select tenant" : "Select property first"} /></SelectTrigger>
                  <SelectContent>{(tenants || []).map(t => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Policy Type</Label>
                <Select value={form.policy_type} onValueChange={v => setField('policy_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(POLICY_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Carrier</Label><Input value={form.carrier_name} onChange={e => setField('carrier_name', e.target.value)} /></div>
              <div><Label>Policy #</Label><Input value={form.policy_number} onChange={e => setField('policy_number', e.target.value)} /></div>
              <div><Label>Expiration</Label><Input type="date" value={form.expiration_date} onChange={e => setField('expiration_date', e.target.value)} /></div>
              <div><Label>Coverage ($)</Label><Input type="number" value={form.coverage_amount} onChange={e => setField('coverage_amount', e.target.value)} /></div>
              <div><Label>Required Min ($)</Label><Input type="number" value={form.required_minimum} onChange={e => setField('required_minimum', e.target.value)} /></div>
              <div className="col-span-2 flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.additional_insured_required} onCheckedChange={v => setField('additional_insured_required', !!v)} />
                  Add'l Insured Required
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.additional_insured} onCheckedChange={v => setField('additional_insured', !!v)} />
                  Add'l Insured on File
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.property_id || !form.tenant_id}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Add
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xl font-display font-bold">{all.length}</p><p className="text-xs text-muted-foreground">Total Policies</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><ShieldAlert className="w-5 h-5 text-warning" /></div>
          <div><p className="text-xl font-display font-bold">{expiringSoonCount}</p><p className="text-xs text-muted-foreground">Expiring ≤30d</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center"><ShieldX className="w-5 h-5 text-destructive" /></div>
          <div><p className="text-xl font-display font-bold">{expiredCount}</p><p className="text-xs text-muted-foreground">Expired</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-foreground" /></div>
          <div><p className="text-xl font-display font-bold">{nonCompliantCount}</p><p className="text-xs text-muted-foreground">Non-Compliant</p></div>
        </div>
      </div>

      {/* Table */}
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
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/dashboard/properties/${p.property_id}`)}>
                    <TableCell className="text-sm max-w-[180px] truncate">{p.properties?.address || '—'}</TableCell>
                    <TableCell className="text-sm font-medium">{p.tenants?.company_name || '—'}</TableCell>
                    <TableCell className="text-sm">{POLICY_TYPES[p.policy_type] || p.policy_type}</TableCell>
                    <TableCell className="text-sm">{p.carrier_name || '—'}</TableCell>
                    <TableCell className="text-sm">{p.coverage_amount ? `$${Number(p.coverage_amount).toLocaleString()}` : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.expiration_date ? format(parseISO(p.expiration_date), 'MM/dd/yy') : '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={compliance.color}>{compliance.label}</Badge></TableCell>
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
          <p className="text-muted-foreground text-sm">Click "Add Policy" to get started.</p>
        </div>
      )}
    </div>
  );
};

export default InsurancePage;
