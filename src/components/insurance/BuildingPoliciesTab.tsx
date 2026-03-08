import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Building2, Bot, Loader2, Upload, FileText, Plus, Pencil, Trash2,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { BUILDING_POLICY_TYPES, EMPTY_BUILDING_FORM } from '@/lib/insurance-constants';

interface BuildingPoliciesTabProps {
  buildingPolicies: any[];
  properties: any[] | undefined;
  onDeepReview: (policy: any, isBuildingPolicy: boolean, documentText?: string) => void;
  reviewingId: string | null;
  uploadingPolicyId: string | null;
  uploadingPolicyDocId: string | null;
  triggerUpload: (policyId: string, isBuildingPolicy: boolean, type?: 'coi' | 'policy') => void;
}

export const BuildingPoliciesTab = ({
  buildingPolicies, properties,
  onDeepReview, reviewingId, uploadingPolicyId, uploadingPolicyDocId, triggerUpload,
}: BuildingPoliciesTabProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [buildingForm, setBuildingForm] = useState(EMPTY_BUILDING_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setBuildingForm({
      property_id: p.property_id,
      policy_type: p.policy_type,
      carrier_name: p.carrier_name || '',
      policy_number: p.policy_number || '',
      coverage_amount: p.coverage_amount?.toString() || '',
      deductible: p.deductible?.toString() || '',
      per_occurrence_limit: p.per_occurrence_limit?.toString() || '',
      aggregate_limit: p.aggregate_limit?.toString() || '',
      effective_date: p.effective_date || '',
      expiration_date: p.expiration_date || '',
      premium_annual: p.premium_annual?.toString() || '',
      broker_name: p.broker_name || '',
      broker_phone: p.broker_phone || '',
      broker_email: p.broker_email || '',
      endorsements: p.endorsements || '',
      notes: p.notes || '',
    });
    setBuildingDialogOpen(true);
  };

  const deletePolicy = async (id: string) => {
    if (!confirm('Delete this building policy?')) return;
    const { error } = await supabase.from('building_insurance_policies').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Building policy removed');
    queryClient.invalidateQueries({ queryKey: ['building-insurance-policies'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        property_id: buildingForm.property_id,
        user_id: user!.id,
        policy_type: buildingForm.policy_type,
        carrier_name: buildingForm.carrier_name || null,
        policy_number: buildingForm.policy_number || null,
        coverage_amount: buildingForm.coverage_amount ? parseFloat(buildingForm.coverage_amount) : null,
        deductible: buildingForm.deductible ? parseFloat(buildingForm.deductible) : null,
        per_occurrence_limit: buildingForm.per_occurrence_limit ? parseFloat(buildingForm.per_occurrence_limit) : null,
        aggregate_limit: buildingForm.aggregate_limit ? parseFloat(buildingForm.aggregate_limit) : null,
        effective_date: buildingForm.effective_date || null,
        expiration_date: buildingForm.expiration_date || null,
        premium_annual: buildingForm.premium_annual ? parseFloat(buildingForm.premium_annual) : null,
        broker_name: buildingForm.broker_name || null,
        broker_phone: buildingForm.broker_phone || null,
        broker_email: buildingForm.broker_email || null,
        endorsements: buildingForm.endorsements || null,
        notes: buildingForm.notes || null,
        status: 'active',
      };
      if (editingId) {
        const { error } = await supabase.from('building_insurance_policies').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('building_insurance_policies').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Building policy updated' : 'Building policy added');
      setBuildingDialogOpen(false);
      setBuildingForm(EMPTY_BUILDING_FORM);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['building-insurance-policies'] });
    },
    onError: () => toast.error('Failed to save building policy'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={buildingDialogOpen} onOpenChange={(open) => { setBuildingDialogOpen(open); if (!open) setEditingId(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!properties?.length} onClick={() => { setBuildingForm(EMPTY_BUILDING_FORM); setEditingId(null); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Building Policy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Building Insurance Policy</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Property *</Label>
                <Select value={buildingForm.property_id} onValueChange={v => setBuildingForm(prev => ({ ...prev, property_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>{(properties || []).map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Policy Type</Label>
                <Select value={buildingForm.policy_type} onValueChange={v => setBuildingForm(prev => ({ ...prev, policy_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(BUILDING_POLICY_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Carrier</Label><Input value={buildingForm.carrier_name} onChange={e => setBuildingForm(prev => ({ ...prev, carrier_name: e.target.value }))} /></div>
              <div><Label>Policy #</Label><Input value={buildingForm.policy_number} onChange={e => setBuildingForm(prev => ({ ...prev, policy_number: e.target.value }))} /></div>
              <div><Label>Annual Premium ($)</Label><Input type="number" value={buildingForm.premium_annual} onChange={e => setBuildingForm(prev => ({ ...prev, premium_annual: e.target.value }))} /></div>
              <div><Label>Coverage ($)</Label><Input type="number" value={buildingForm.coverage_amount} onChange={e => setBuildingForm(prev => ({ ...prev, coverage_amount: e.target.value }))} /></div>
              <div><Label>Deductible ($)</Label><Input type="number" value={buildingForm.deductible} onChange={e => setBuildingForm(prev => ({ ...prev, deductible: e.target.value }))} /></div>
              <div><Label>Effective</Label><Input type="date" value={buildingForm.effective_date} onChange={e => setBuildingForm(prev => ({ ...prev, effective_date: e.target.value }))} /></div>
              <div><Label>Expiration</Label><Input type="date" value={buildingForm.expiration_date} onChange={e => setBuildingForm(prev => ({ ...prev, expiration_date: e.target.value }))} /></div>
              <div><Label>Broker Name</Label><Input value={buildingForm.broker_name} onChange={e => setBuildingForm(prev => ({ ...prev, broker_name: e.target.value }))} /></div>
              <div><Label>Broker Phone</Label><Input value={buildingForm.broker_phone} onChange={e => setBuildingForm(prev => ({ ...prev, broker_phone: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Broker Email</Label><Input value={buildingForm.broker_email} onChange={e => setBuildingForm(prev => ({ ...prev, broker_email: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Endorsements</Label><Textarea value={buildingForm.endorsements} onChange={e => setBuildingForm(prev => ({ ...prev, endorsements: e.target.value }))} className="min-h-[50px]" /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={buildingForm.notes} onChange={e => setBuildingForm(prev => ({ ...prev, notes: e.target.value }))} className="min-h-[50px]" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setBuildingDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !buildingForm.property_id}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />} {editingId ? 'Update' : 'Add'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {buildingPolicies.length > 0 ? (
        <div className="space-y-3">
          {buildingPolicies.map(p => {
            const daysLeft = p.expiration_date ? differenceInDays(parseISO(p.expiration_date), new Date()) : null;
            const isExpired = daysLeft !== null && daysLeft < 0;
            const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
            return (
              <Card key={p.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{p.properties?.address || '—'}</p>
                      <p className="text-xs text-muted-foreground">{BUILDING_POLICY_TYPES[p.policy_type] || p.policy_type} · {p.carrier_name || 'No carrier'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpired && <Badge variant="destructive">Expired</Badge>}
                      {isExpiringSoon && <Badge className="bg-warning/10 text-warning border-warning/20">{daysLeft}d left</Badge>}
                      {!isExpired && !isExpiringSoon && <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>}
                      {p.certificate_url ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] gap-1"><FileText className="w-2.5 h-2.5" /> COI</Badge>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => triggerUpload(p.id, true, 'coi')} disabled={uploadingPolicyId === p.id}>
                          {uploadingPolicyId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload COI
                        </Button>
                      )}
                      {(p as any).policy_document_url ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] gap-1"><FileText className="w-2.5 h-2.5" /> Policy</Badge>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => triggerUpload(p.id, true, 'policy')} disabled={uploadingPolicyDocId === p.id}>
                          {uploadingPolicyDocId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload Policy
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeepReview(p, true)} disabled={reviewingId === p.id} title="AI Review">
                        {reviewingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePolicy(p.id)} title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Policy #</p><p className="font-medium">{p.policy_number || '—'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Coverage</p><p className="font-medium">{p.coverage_amount ? `$${Number(p.coverage_amount).toLocaleString()}` : '—'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Deductible</p><p className="font-medium">{p.deductible ? `$${Number(p.deductible).toLocaleString()}` : '—'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Premium</p><p className="font-medium">{p.premium_annual ? `$${Number(p.premium_annual).toLocaleString()}/yr` : '—'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Expires</p><p className="font-medium">{p.expiration_date ? format(parseISO(p.expiration_date), 'MMM d, yyyy') : '—'}</p></div>
                  </div>
                  {(p.broker_name || p.broker_email) && (
                    <div className="bg-muted/40 rounded-lg p-3 text-sm">
                      <p className="text-xs text-muted-foreground mb-1 font-medium">Broker</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {p.broker_name && <span className="font-medium">{p.broker_name}</span>}
                        {p.broker_phone && <span className="text-muted-foreground">{p.broker_phone}</span>}
                        {p.broker_email && <span className="text-muted-foreground">{p.broker_email}</span>}
                      </div>
                    </div>
                  )}
                  {p.ai_review_notes && (
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                      <p className="text-xs text-primary font-medium mb-1 flex items-center gap-1"><Bot className="w-3 h-3" /> AI Review — {p.ai_reviewed_at ? format(new Date(p.ai_reviewed_at), 'MM/dd/yy') : ''}</p>
                      <div className="prose prose-sm max-w-none text-xs text-foreground"><ReactMarkdown>{p.ai_review_notes}</ReactMarkdown></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No building policies</h3>
          <p className="text-muted-foreground text-sm">Track your property, liability, umbrella, and D&O policies.</p>
        </div>
      )}
    </div>
  );
};
