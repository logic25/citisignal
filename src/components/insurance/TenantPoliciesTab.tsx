import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ChevronDown, ChevronRight, Building2, Users, Bot, Loader2, Upload, FileText, Plus,
  AlertTriangle, Pencil, Trash2,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import {
  TENANT_POLICY_TYPES, EMPTY_TENANT_FORM, getComplianceInfo, GroupedPolicies,
} from '@/lib/insurance-constants';

interface TenantPoliciesTabProps {
  groupedTenant: GroupedPolicies[];
  tenantPolicies: any[];
  properties: any[] | undefined;
  onDeepReview: (policy: any, isBuildingPolicy: boolean, documentText?: string) => void;
  reviewingId: string | null;
  uploadingPolicyId: string | null;
  uploadingPolicyDocId: string | null;
  triggerUpload: (policyId: string, isBuildingPolicy: boolean, type?: 'coi' | 'policy') => void;
}

export const TenantPoliciesTab = ({
  groupedTenant, tenantPolicies, properties,
  onDeepReview, reviewingId, uploadingPolicyId, uploadingPolicyDocId, triggerUpload,
}: TenantPoliciesTabProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());
  const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [tenantForm, setTenantForm] = useState(EMPTY_TENANT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [complianceNotes, setComplianceNotes] = useState<string | null>(null);
  const dialogFileInputRef = useRef<HTMLInputElement>(null);

  const { data: tenants } = useQuery({
    queryKey: ['tenants-for-property', tenantForm.property_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('id, company_name').eq('property_id', tenantForm.property_id).order('company_name');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantForm.property_id,
  });

  const toggleProperty = (id: string) => {
    setExpandedProperties(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleTenant = (key: string) => {
    setExpandedTenants(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setTenantForm({
      property_id: p.property_id,
      tenant_id: p.tenant_id,
      policy_type: p.policy_type,
      carrier_name: p.carrier_name || '',
      policy_number: p.policy_number || '',
      coverage_amount: p.coverage_amount?.toString() || '',
      required_minimum: p.required_minimum?.toString() || '',
      effective_date: p.effective_date || '',
      expiration_date: p.expiration_date || '',
      additional_insured: p.additional_insured || false,
      additional_insured_required: p.additional_insured_required ?? true,
      additional_insured_entity_name: p.additional_insured_entity_name || '',
      deductible: p.deductible?.toString() || '',
      per_occurrence_limit: p.per_occurrence_limit?.toString() || '',
      aggregate_limit: p.aggregate_limit?.toString() || '',
      endorsements: p.endorsements || '',
    });
    setComplianceNotes(null);
    setTenantDialogOpen(true);
  };

  const deletePolicy = async (id: string) => {
    if (!confirm('Delete this policy?')) return;
    const { error } = await supabase.from('tenant_insurance_policies').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Policy removed');
    queryClient.invalidateQueries({ queryKey: ['all-insurance-policies'] });
    queryClient.invalidateQueries({ queryKey: ['tenant-insurance'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        property_id: tenantForm.property_id,
        tenant_id: tenantForm.tenant_id,
        policy_type: tenantForm.policy_type,
        carrier_name: tenantForm.carrier_name || null,
        policy_number: tenantForm.policy_number || null,
        coverage_amount: tenantForm.coverage_amount ? parseFloat(tenantForm.coverage_amount) : null,
        required_minimum: tenantForm.required_minimum ? parseFloat(tenantForm.required_minimum) : null,
        effective_date: tenantForm.effective_date || null,
        expiration_date: tenantForm.expiration_date || null,
        additional_insured: tenantForm.additional_insured,
        additional_insured_required: tenantForm.additional_insured_required,
        additional_insured_entity_name: tenantForm.additional_insured_entity_name || null,
        deductible: tenantForm.deductible ? parseFloat(tenantForm.deductible) : null,
        per_occurrence_limit: tenantForm.per_occurrence_limit ? parseFloat(tenantForm.per_occurrence_limit) : null,
        aggregate_limit: tenantForm.aggregate_limit ? parseFloat(tenantForm.aggregate_limit) : null,
        endorsements: tenantForm.endorsements || null,
        status: 'active',
        user_id: user!.id,
      };
      if (editingId) {
        const { error } = await supabase.from('tenant_insurance_policies').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tenant_insurance_policies').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Policy updated' : 'Tenant policy added');
      setTenantDialogOpen(false);
      setTenantForm(EMPTY_TENANT_FORM);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['all-insurance-policies'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-insurance'] });
    },
    onError: () => toast.error('Failed to save policy'),
  });

  // COI AI auto-fill for add dialog
  const handleDialogCOIUpload = async (file: File) => {
    if (!tenantForm.property_id) { toast.error('Please select a property first'); return; }
    setExtracting(true);
    setComplianceNotes(null);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = `${tenantForm.property_id}/coi_new_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('property-documents').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('property-documents').getPublicUrl(fileName);

      const { data: extractData } = await supabase.functions.invoke('extract-document-text', {
        body: { file_url: publicUrl || fileName, property_id: tenantForm.property_id },
      });
      const extractedText = extractData?.text || '';
      if (!extractedText || extractedText.length < 50) {
        toast.error('Could not extract enough text. Please fill manually.');
        setExtracting(false);
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('company_name').eq('user_id', user!.id).maybeSingle();
      const { data: parseResult, error: parseError } = await supabase.functions.invoke('review-insurance', {
        body: { mode: 'extract', document_text: extractedText, owner_entity_name: profile?.company_name || '' },
      });
      if (parseError) throw parseError;
      const fields = parseResult?.extracted;
      if (!fields) throw new Error('AI could not parse the document');

      setTenantForm(prev => ({
        ...prev,
        policy_type: fields.policy_type || prev.policy_type,
        carrier_name: fields.carrier_name || prev.carrier_name,
        policy_number: fields.policy_number || prev.policy_number,
        coverage_amount: fields.coverage_amount ? String(fields.coverage_amount) : prev.coverage_amount,
        per_occurrence_limit: fields.per_occurrence_limit ? String(fields.per_occurrence_limit) : prev.per_occurrence_limit,
        aggregate_limit: fields.aggregate_limit ? String(fields.aggregate_limit) : prev.aggregate_limit,
        deductible: fields.deductible ? String(fields.deductible) : prev.deductible,
        effective_date: fields.effective_date || prev.effective_date,
        expiration_date: fields.expiration_date || prev.expiration_date,
        additional_insured: fields.additional_insured ?? prev.additional_insured,
        additional_insured_entity_name: fields.additional_insured_entity_name || prev.additional_insured_entity_name,
        endorsements: fields.endorsements || prev.endorsements,
      }));
      if (fields.compliance_notes) setComplianceNotes(fields.compliance_notes);
      toast.success('AI extracted policy details — review before saving');
    } catch (e: any) {
      toast.error(e.message || 'Failed to extract policy details');
    }
    setExtracting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={tenantDialogOpen} onOpenChange={(open) => { setTenantDialogOpen(open); if (!open) { setEditingId(null); setComplianceNotes(null); } }}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!properties?.length} onClick={() => { setTenantForm(EMPTY_TENANT_FORM); setEditingId(null); setComplianceNotes(null); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Tenant Policy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Tenant Insurance Policy</DialogTitle></DialogHeader>

            {/* COI Upload AI Auto-Fill — only for new policies */}
            {!editingId && (
              <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 mb-1">
                <input ref={dialogFileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleDialogCOIUpload(file); e.target.value = ''; }} />
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="flex items-center gap-2"><Bot className="w-5 h-5 text-primary" /><span className="font-semibold text-sm text-foreground">Upload COI for AI Auto-Fill</span></div>
                  <p className="text-xs text-muted-foreground">Upload the tenant's Certificate of Insurance and AI will extract all policy details.</p>
                  <Button size="sm" variant="outline" disabled={!tenantForm.property_id || extracting} onClick={() => dialogFileInputRef.current?.click()} className="mt-1">
                    {extracting ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Analyzing COI...</> : <><Upload className="w-4 h-4 mr-1" /> Choose File</>}
                  </Button>
                  {!tenantForm.property_id && <p className="text-[11px] text-warning">Select a property first</p>}
                </div>
              </div>
            )}

            {complianceNotes && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 mb-1">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                  <div><p className="font-semibold text-xs text-foreground mb-1">AI Compliance Check</p><p className="text-xs text-muted-foreground">{complianceNotes}</p></div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Property *</Label>
                <Select value={tenantForm.property_id} onValueChange={v => setTenantForm(prev => ({ ...prev, property_id: v, tenant_id: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>{(properties || []).map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Tenant *</Label>
                <Select value={tenantForm.tenant_id} onValueChange={v => setTenantForm(prev => ({ ...prev, tenant_id: v }))} disabled={!tenantForm.property_id}>
                  <SelectTrigger><SelectValue placeholder={tenantForm.property_id ? "Select tenant" : "Select property first"} /></SelectTrigger>
                  <SelectContent>{(tenants || []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Policy Type</Label>
                <Select value={tenantForm.policy_type} onValueChange={v => setTenantForm(prev => ({ ...prev, policy_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TENANT_POLICY_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Carrier</Label><Input value={tenantForm.carrier_name} onChange={e => setTenantForm(prev => ({ ...prev, carrier_name: e.target.value }))} /></div>
              <div><Label>Policy #</Label><Input value={tenantForm.policy_number} onChange={e => setTenantForm(prev => ({ ...prev, policy_number: e.target.value }))} /></div>
              <div><Label>Effective</Label><Input type="date" value={tenantForm.effective_date} onChange={e => setTenantForm(prev => ({ ...prev, effective_date: e.target.value }))} /></div>
              <div><Label>Expiration</Label><Input type="date" value={tenantForm.expiration_date} onChange={e => setTenantForm(prev => ({ ...prev, expiration_date: e.target.value }))} /></div>
              <div><Label>Coverage ($)</Label><Input type="number" value={tenantForm.coverage_amount} onChange={e => setTenantForm(prev => ({ ...prev, coverage_amount: e.target.value }))} /></div>
              <div><Label>Required Min ($)</Label><Input type="number" value={tenantForm.required_minimum} onChange={e => setTenantForm(prev => ({ ...prev, required_minimum: e.target.value }))} /></div>
              <div><Label>Deductible ($)</Label><Input type="number" value={tenantForm.deductible} onChange={e => setTenantForm(prev => ({ ...prev, deductible: e.target.value }))} /></div>
              <div><Label>Per Occurrence ($)</Label><Input type="number" value={tenantForm.per_occurrence_limit} onChange={e => setTenantForm(prev => ({ ...prev, per_occurrence_limit: e.target.value }))} /></div>
              <div><Label>Aggregate ($)</Label><Input type="number" value={tenantForm.aggregate_limit} onChange={e => setTenantForm(prev => ({ ...prev, aggregate_limit: e.target.value }))} /></div>
              <div className="col-span-2">
                <Label>Additional Insured Entity Name</Label>
                <Input value={tenantForm.additional_insured_entity_name} onChange={e => setTenantForm(prev => ({ ...prev, additional_insured_entity_name: e.target.value }))} placeholder="e.g. Green Light Expediting LLC" />
              </div>
              <div className="col-span-2 flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={tenantForm.additional_insured_required} onCheckedChange={v => setTenantForm(prev => ({ ...prev, additional_insured_required: !!v }))} />
                  Add'l Insured Required
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={tenantForm.additional_insured} onCheckedChange={v => setTenantForm(prev => ({ ...prev, additional_insured: !!v }))} />
                  Add'l Insured On File
                </label>
              </div>
              <div className="col-span-2">
                <Label>Endorsements</Label>
                <Textarea value={tenantForm.endorsements} onChange={e => setTenantForm(prev => ({ ...prev, endorsements: e.target.value }))} placeholder="Waiver of Subrogation, Primary & Non-Contributory, etc." className="min-h-[50px]" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setTenantDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !tenantForm.property_id || !tenantForm.tenant_id}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />} {editingId ? 'Update' : 'Add'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groupedTenant.length > 0 ? (
        <div className="space-y-3">
          {groupedTenant.map(group => {
            const isPropExpanded = expandedProperties.has(group.propertyId);
            const propPolicyCount = group.tenants.reduce((sum, t) => sum + t.policies.length, 0);
            const propIssueCount = group.tenants.reduce((sum, t) => sum + t.policies.filter((p: any) => getComplianceInfo(p).label !== 'Compliant').length, 0);

            return (
              <div key={group.propertyId} className="rounded-xl border border-border bg-card overflow-hidden">
                <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left" onClick={() => toggleProperty(group.propertyId)}>
                  <div className="flex items-center gap-3">
                    {isPropExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <Building2 className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-foreground">{group.propertyAddress}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{propPolicyCount} {propPolicyCount === 1 ? 'policy' : 'policies'}</span>
                    <span className="text-xs text-muted-foreground">{group.tenants.length} {group.tenants.length === 1 ? 'tenant' : 'tenants'}</span>
                    {propIssueCount > 0 && <span className="text-xs bg-destructive/10 text-destructive rounded-full px-2 py-0.5">{propIssueCount} issue{propIssueCount > 1 ? 's' : ''}</span>}
                  </div>
                </button>

                {isPropExpanded && (
                  <div className="border-t border-border">
                    {group.tenants.map(tenant => {
                      const tenantKey = `${group.propertyId}_${tenant.tenantId}`;
                      const isTenantExpanded = expandedTenants.has(tenantKey);
                      const tenantIssues = tenant.policies.filter((p: any) => getComplianceInfo(p).label !== 'Compliant').length;

                      return (
                        <div key={tenantKey} className="border-b border-border last:border-b-0">
                          <button className="w-full flex items-center justify-between px-6 py-3 hover:bg-muted/20 transition-colors text-left" onClick={() => toggleTenant(tenantKey)}>
                            <div className="flex items-center gap-3">
                              {isTenantExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                              <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="font-medium text-foreground text-sm">{tenant.tenantName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{tenant.policies.length} {tenant.policies.length === 1 ? 'policy' : 'policies'}</span>
                              {tenantIssues > 0 && <span className="text-[10px] bg-warning/10 text-warning rounded-full px-2 py-0.5">{tenantIssues} issue{tenantIssues > 1 ? 's' : ''}</span>}
                            </div>
                          </button>

                          {isTenantExpanded && (
                            <div className="px-6 pb-3">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/30">
                                    <TableHead className="text-[10px] py-1.5">Type</TableHead>
                                    <TableHead className="text-[10px] py-1.5">Carrier</TableHead>
                                    <TableHead className="text-[10px] py-1.5">Coverage</TableHead>
                                    <TableHead className="text-[10px] py-1.5">Expires</TableHead>
                                    <TableHead className="text-[10px] py-1.5">Add'l Insured</TableHead>
                                    <TableHead className="text-[10px] py-1.5">Status</TableHead>
                                    <TableHead className="text-[10px] py-1.5">COI</TableHead>
                                    <TableHead className="text-[10px] py-1.5 w-24">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {tenant.policies.map((p: any) => {
                                    const compliance = getComplianceInfo(p);
                                    const isPolicyExpanded = expandedPolicy === p.id;
                                    const daysLeft = p.expiration_date ? differenceInDays(parseISO(p.expiration_date), new Date()) : null;
                                    const isExpired = daysLeft !== null && daysLeft < 0;
                                    const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                                    const aiMissing = p.additional_insured_required && !p.additional_insured;

                                    return (
                                      <>
                                        <TableRow key={p.id} className="cursor-pointer hover:bg-muted/20" onClick={() => setExpandedPolicy(isPolicyExpanded ? null : p.id)}>
                                          <TableCell className="text-xs py-1.5 font-medium">{TENANT_POLICY_TYPES[p.policy_type] || p.policy_type}</TableCell>
                                          <TableCell className="text-xs py-1.5">{p.carrier_name || '—'}</TableCell>
                                          <TableCell className="text-xs py-1.5">
                                            {p.coverage_amount ? `$${Number(p.coverage_amount).toLocaleString()}` : '—'}
                                            {p.required_minimum && (
                                              <span className={`text-[10px] ml-1 ${Number(p.coverage_amount) < Number(p.required_minimum) ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                / ${Number(p.required_minimum).toLocaleString()}
                                              </span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            <div className="flex items-center gap-1">
                                              <span className="text-muted-foreground">{p.expiration_date ? format(parseISO(p.expiration_date), 'MM/dd/yy') : '—'}</span>
                                              {isExpired && <Badge variant="destructive" className="text-[9px] py-0 px-1">Exp</Badge>}
                                              {isExpiringSoon && <span className="text-[9px] bg-warning/10 text-warning rounded-full px-1.5 py-0">{daysLeft}d</span>}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            {p.additional_insured_required ? (
                                              aiMissing ? (
                                                <span className="text-[9px] bg-destructive/10 text-destructive rounded-full px-1.5 py-0.5">⚠️ Missing</span>
                                              ) : (
                                                <span className="text-[9px] bg-success/10 text-success rounded-full px-1.5 py-0.5">✓ Listed</span>
                                              )
                                            ) : (
                                              <span className="text-[10px] text-muted-foreground">N/A</span>
                                            )}
                                          </TableCell>
                                          <TableCell><Badge variant="outline" className={`${compliance.color} text-[9px]`}>{compliance.label}</Badge></TableCell>
                                          <TableCell>
                                            {p.certificate_url ? (
                                              <span className="text-[9px] bg-success/10 text-success rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" /> On File</span>
                                            ) : (
                                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={(e) => { e.stopPropagation(); triggerUpload(p.id, false); }} disabled={uploadingPolicyId === p.id}>
                                                {uploadingPolicyId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload
                                              </Button>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex gap-0.5">
                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDeepReview(p, false); }} disabled={reviewingId === p.id} title="AI Review">
                                                {reviewingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openEdit(p); }} title="Edit">
                                                <Pencil className="w-3 h-3" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); deletePolicy(p.id); }} title="Delete">
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                        {isPolicyExpanded && (
                                          <TableRow key={`${p.id}-details`}>
                                            <TableCell colSpan={8} className="bg-muted/20 p-4">
                                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div><p className="text-xs text-muted-foreground">Policy #</p><p className="font-medium">{p.policy_number || '—'}</p></div>
                                                <div><p className="text-xs text-muted-foreground">Effective</p><p className="font-medium">{p.effective_date ? format(parseISO(p.effective_date), 'MM/dd/yyyy') : '—'}</p></div>
                                                <div><p className="text-xs text-muted-foreground">Deductible</p><p className="font-medium">{p.deductible ? `$${Number(p.deductible).toLocaleString()}` : '—'}</p></div>
                                                <div><p className="text-xs text-muted-foreground">Per Occurrence</p><p className="font-medium">{p.per_occurrence_limit ? `$${Number(p.per_occurrence_limit).toLocaleString()}` : '—'}</p></div>
                                                <div><p className="text-xs text-muted-foreground">Aggregate</p><p className="font-medium">{p.aggregate_limit ? `$${Number(p.aggregate_limit).toLocaleString()}` : '—'}</p></div>
                                                <div><p className="text-xs text-muted-foreground">Add'l Insured Entity</p><p className="font-medium">{p.additional_insured_entity_name || '—'}</p></div>
                                                <div className="col-span-2"><p className="text-xs text-muted-foreground">Endorsements</p><p className="font-medium">{p.endorsements || '—'}</p></div>
                                              </div>

                                              {/* Document slots */}
                                              <div className="mt-3 grid grid-cols-2 gap-3">
                                                <div className="rounded-lg border border-border p-3">
                                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Certificate of Insurance (COI)</p>
                                                  {p.certificate_url ? (
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-[10px] bg-success/10 text-success rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" /> On File</span>
                                                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={() => triggerUpload(p.id, false, 'coi')}><Upload className="w-3 h-3" /> Replace</Button>
                                                    </div>
                                                  ) : (
                                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => triggerUpload(p.id, false, 'coi')} disabled={uploadingPolicyId === p.id}>
                                                      {uploadingPolicyId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload COI
                                                    </Button>
                                                  )}
                                                </div>
                                                <div className="rounded-lg border border-border p-3">
                                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Full Insurance Policy</p>
                                                  {(p as any).policy_document_url ? (
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-[10px] bg-success/10 text-success rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" /> On File</span>
                                                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={() => triggerUpload(p.id, false, 'policy')}><Upload className="w-3 h-3" /> Replace</Button>
                                                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={() => onDeepReview(p, false)} disabled={reviewingId === p.id}>
                                                        {reviewingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} Re-run Review
                                                      </Button>
                                                    </div>
                                                  ) : (
                                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => triggerUpload(p.id, false, 'policy')} disabled={uploadingPolicyDocId === p.id}>
                                                      {uploadingPolicyDocId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload Policy
                                                    </Button>
                                                  )}
                                                </div>
                                              </div>

                                              {p.ai_review_notes && (
                                                <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                                  <p className="text-xs text-primary font-medium mb-1 flex items-center gap-1"><Bot className="w-3 h-3" /> AI Compliance Review — {p.ai_reviewed_at ? format(new Date(p.ai_reviewed_at), 'MM/dd/yy') : ''}</p>
                                                  <div className="prose prose-sm max-w-none text-xs text-foreground"><ReactMarkdown>{p.ai_review_notes}</ReactMarkdown></div>
                                                </div>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        )}
                                      </>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No tenant policies</h3>
          <p className="text-muted-foreground text-sm">Click "Add Tenant Policy" to track tenant insurance.</p>
        </div>
      )}
    </div>
  );
};
