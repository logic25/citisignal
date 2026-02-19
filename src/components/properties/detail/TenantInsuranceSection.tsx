import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface TenantInsuranceSectionProps {
  tenantId: string;
  propertyId: string;
  tenantName: string;
}

const POLICY_TYPES: Record<string, string> = {
  general_liability: 'General Liability',
  workers_comp: 'Workers Comp',
  property_contents: 'Property / Contents',
  umbrella: 'Umbrella / Excess',
  auto: 'Auto',
  other: 'Other',
};

const emptyForm = {
  policy_type: 'general_liability',
  carrier_name: '',
  policy_number: '',
  coverage_amount: '',
  required_minimum: '',
  effective_date: '',
  expiration_date: '',
  additional_insured: false,
  additional_insured_required: true,
  notes: '',
};

export const TenantInsuranceSection = ({ tenantId, propertyId, tenantName }: TenantInsuranceSectionProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: policies, isLoading } = useQuery({
    queryKey: ['tenant-insurance', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_insurance_policies')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('expiration_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      policy_type: p.policy_type,
      carrier_name: p.carrier_name || '',
      policy_number: p.policy_number || '',
      coverage_amount: p.coverage_amount?.toString() || '',
      required_minimum: p.required_minimum?.toString() || '',
      effective_date: p.effective_date || '',
      expiration_date: p.expiration_date || '',
      additional_insured: p.additional_insured || false,
      additional_insured_required: p.additional_insured_required ?? true,
      notes: p.notes || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    // Auto-compute status
    let status = 'active';
    if (form.expiration_date && new Date(form.expiration_date) < new Date()) {
      status = 'expired';
    }

    const payload = {
      tenant_id: tenantId,
      property_id: propertyId,
      policy_type: form.policy_type,
      carrier_name: form.carrier_name || null,
      policy_number: form.policy_number || null,
      coverage_amount: form.coverage_amount ? parseFloat(form.coverage_amount) : null,
      required_minimum: form.required_minimum ? parseFloat(form.required_minimum) : null,
      effective_date: form.effective_date || null,
      expiration_date: form.expiration_date || null,
      additional_insured: form.additional_insured,
      additional_insured_required: form.additional_insured_required,
      status,
      notes: form.notes || null,
    };

    const { error } = editingId
      ? await supabase.from('tenant_insurance_policies').update(payload).eq('id', editingId)
      : await supabase.from('tenant_insurance_policies').insert(payload);

    setSaving(false);
    if (error) {
      toast.error('Failed to save policy');
      return;
    }
    toast.success(editingId ? 'Policy updated' : 'Policy added');
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['tenant-insurance', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['all-insurance-policies'] });
  };

  const deletePolicy = async (id: string) => {
    const { error } = await supabase.from('tenant_insurance_policies').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Policy removed');
    queryClient.invalidateQueries({ queryKey: ['tenant-insurance', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['all-insurance-policies'] });
  };

  const getComplianceStatus = (p: any) => {
    const isExpired = p.expiration_date && new Date(p.expiration_date) < new Date();
    const isBelowMin = p.required_minimum && p.coverage_amount && p.coverage_amount < p.required_minimum;
    const missingAdditional = p.additional_insured_required && !p.additional_insured;

    if (isExpired) return { label: 'Expired', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: ShieldX };
    if (isBelowMin || missingAdditional) return { label: 'Non-Compliant', color: 'bg-warning/10 text-warning border-warning/20', icon: ShieldAlert };

    // Expiring soon check
    if (p.expiration_date) {
      const days = differenceInDays(parseISO(p.expiration_date), new Date());
      if (days <= 30) return { label: `${days}d left`, color: 'bg-warning/10 text-warning border-warning/20', icon: ShieldAlert };
    }

    return { label: 'Compliant', color: 'bg-success/10 text-success border-success/20', icon: ShieldCheck };
  };

  if (isLoading) return null;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" /> Insurance ({policies?.length || 0})
        </h4>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={openAdd}>
          <Plus className="w-3 h-3 mr-1" /> Add Policy
        </Button>
      </div>

      {(policies || []).length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs py-2">Type</TableHead>
                <TableHead className="text-xs py-2">Carrier</TableHead>
                <TableHead className="text-xs py-2">Coverage</TableHead>
                <TableHead className="text-xs py-2">Expires</TableHead>
                <TableHead className="text-xs py-2">Status</TableHead>
                <TableHead className="w-16 py-2"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(policies || []).map(p => {
                const compliance = getComplianceStatus(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs py-2">{POLICY_TYPES[p.policy_type] || p.policy_type}</TableCell>
                    <TableCell className="text-xs py-2">{p.carrier_name || '—'}</TableCell>
                    <TableCell className="text-xs py-2">
                      {p.coverage_amount ? `$${Number(p.coverage_amount).toLocaleString()}` : '—'}
                      {p.required_minimum && (
                        <span className="text-muted-foreground ml-1">/ ${Number(p.required_minimum).toLocaleString()}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      {p.expiration_date ? format(parseISO(p.expiration_date), 'MM/dd/yy') : '—'}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className={`text-[10px] ${compliance.color}`}>
                        {compliance.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(p)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deletePolicy(p.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'Add'} Insurance Policy — {tenantName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Policy Type</Label>
                <Select value={form.policy_type} onValueChange={v => setForm({ ...form, policy_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(POLICY_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Carrier</Label>
                <Input value={form.carrier_name} onChange={e => setForm({ ...form, carrier_name: e.target.value })} placeholder="Insurance company" />
              </div>
            </div>
            <div>
              <Label>Policy Number</Label>
              <Input value={form.policy_number} onChange={e => setForm({ ...form, policy_number: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Coverage Amount ($)</Label>
                <Input type="number" value={form.coverage_amount} onChange={e => setForm({ ...form, coverage_amount: e.target.value })} />
              </div>
              <div>
                <Label>Required Minimum ($)</Label>
                <Input type="number" value={form.required_minimum} onChange={e => setForm({ ...form, required_minimum: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Effective Date</Label>
                <Input type="date" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })} />
              </div>
              <div>
                <Label>Expiration Date</Label>
                <Input type="date" value={form.expiration_date} onChange={e => setForm({ ...form, expiration_date: e.target.value })} />
              </div>
            </div>
            <div className="border-t border-border pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Additional Insured Required</Label>
                <Switch checked={form.additional_insured_required} onCheckedChange={v => setForm({ ...form, additional_insured_required: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Additional Insured Listed</Label>
                <Switch checked={form.additional_insured} onCheckedChange={v => setForm({ ...form, additional_insured: v })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="min-h-[60px]" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{editingId ? 'Update' : 'Add'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
