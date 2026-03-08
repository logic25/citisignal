import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Loader2,
  Building2, Users, Bot, RefreshCw, FileSearch,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import {
  TENANT_POLICY_TYPES, BUILDING_POLICY_TYPES, RENEWAL_STATUSES,
  getComplianceInfo, getCoverageGaps, groupPoliciesByPropertyTenant,
} from '@/lib/insurance-constants';
import { TenantPoliciesTab } from '@/components/insurance/TenantPoliciesTab';
import { BuildingPoliciesTab } from '@/components/insurance/BuildingPoliciesTab';

const InsurancePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('tenant');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [uploadingPolicyId, setUploadingPolicyId] = useState<string | null>(null);
  const [uploadingPolicyDocId, setUploadingPolicyDocId] = useState<string | null>(null);
  const [pendingUploadPolicyId, setPendingUploadPolicyId] = useState<string | null>(null);
  const [pendingUploadIsBuildingPolicy, setPendingUploadIsBuildingPolicy] = useState(false);
  const [pendingUploadType, setPendingUploadType] = useState<'coi' | 'policy'>('coi');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const policyDocInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──
  const { data: properties } = useQuery({
    queryKey: ['properties-list', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('id, address').order('address');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: tenantPolicies, isLoading: loadingTenant } = useQuery({
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

  const { data: buildingPolicies, isLoading: loadingBuilding } = useQuery({
    queryKey: ['building-insurance-policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('building_insurance_policies')
        .select('*, properties(id, address)')
        .order('expiration_date', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // ── File upload handlers ──
  const triggerUpload = (policyId: string, isBuildingPolicy: boolean, type: 'coi' | 'policy' = 'coi') => {
    setPendingUploadPolicyId(policyId);
    setPendingUploadIsBuildingPolicy(isBuildingPolicy);
    setPendingUploadType(type);
    if (type === 'policy') policyDocInputRef.current?.click();
    else fileInputRef.current?.click();
  };

  const handleCOIUpload = async (file: File, policyId: string, isBuildingPolicy: boolean) => {
    setUploadingPolicyId(policyId);
    try {
      const allPolicies = isBuildingPolicy ? (buildingPolicies || []) : (tenantPolicies || []);
      const policy = allPolicies.find(p => p.id === policyId);
      if (!policy) throw new Error('Policy not found');

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = `${policy.property_id}/coi_${policyId}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('property-documents').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('property-documents').getPublicUrl(fileName);
      const fileUrl = publicUrl || fileName;

      const table = isBuildingPolicy ? 'building_insurance_policies' : 'tenant_insurance_policies';
      await supabase.from(table).update({ certificate_url: fileUrl }).eq('id', policyId);

      const tenantName = !isBuildingPolicy ? policy.tenants?.company_name : null;
      const policyType = isBuildingPolicy
        ? BUILDING_POLICY_TYPES[policy.policy_type] || policy.policy_type
        : TENANT_POLICY_TYPES[policy.policy_type] || policy.policy_type;
      const docName = tenantName ? `COI — ${tenantName} — ${policyType}` : `Building Policy — ${policyType}`;

      await supabase.from('property_documents').insert({
        property_id: policy.property_id,
        document_type: 'Insurance Certificate',
        document_name: docName,
        file_url: fileUrl,
        file_type: file.type || `application/${fileExt}`,
        file_size_bytes: file.size,
        expiration_date: policy.expiration_date || null,
        uploaded_by: user?.id,
        description: `Auto-linked from Insurance module. Policy #${policy.policy_number || 'N/A'}`,
      });

      try {
        await supabase.functions.invoke('extract-document-text', {
          body: { file_url: fileUrl, property_id: policy.property_id },
        });
      } catch { /* non-critical */ }

      queryClient.invalidateQueries({ queryKey: isBuildingPolicy ? ['building-insurance-policies'] : ['all-insurance-policies'] });
      toast.success('COI uploaded & linked to property documents');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    }
    setUploadingPolicyId(null);
  };

  const handlePolicyDocUpload = async (file: File, policyId: string, isBuildingPolicy: boolean) => {
    setUploadingPolicyDocId(policyId);
    try {
      const allPolicies = isBuildingPolicy ? (buildingPolicies || []) : (tenantPolicies || []);
      const policy = allPolicies.find(p => p.id === policyId);
      if (!policy) throw new Error('Policy not found');

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = `${policy.property_id}/policy_doc_${policyId}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('property-documents').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('property-documents').getPublicUrl(fileName);
      const fileUrl = publicUrl || fileName;

      const table = isBuildingPolicy ? 'building_insurance_policies' : 'tenant_insurance_policies';
      await supabase.from(table).update({ policy_document_url: fileUrl } as any).eq('id', policyId);

      const tenantName = !isBuildingPolicy ? policy.tenants?.company_name : null;
      const policyType = isBuildingPolicy
        ? BUILDING_POLICY_TYPES[policy.policy_type] || policy.policy_type
        : TENANT_POLICY_TYPES[policy.policy_type] || policy.policy_type;
      const docName = tenantName ? `Full Policy — ${tenantName} — ${policyType}` : `Full Building Policy — ${policyType}`;

      await supabase.from('property_documents').insert({
        property_id: policy.property_id,
        document_type: 'Insurance Policy',
        document_name: docName,
        file_url: fileUrl,
        file_type: file.type || `application/${fileExt}`,
        file_size_bytes: file.size,
        expiration_date: policy.expiration_date || null,
        uploaded_by: user?.id,
        description: `Full insurance policy document. Policy #${policy.policy_number || 'N/A'}`,
      });

      let extractedText = '';
      try {
        const { data: extractData } = await supabase.functions.invoke('extract-document-text', {
          body: { file_url: fileUrl, property_id: policy.property_id },
        });
        extractedText = extractData?.text || '';
      } catch { /* non-critical */ }

      queryClient.invalidateQueries({ queryKey: isBuildingPolicy ? ['building-insurance-policies'] : ['all-insurance-policies'] });
      toast.success('Policy document uploaded');

      if (extractedText.length > 100) {
        toast.info('Running deep AI compliance review...');
        handleDeepReview(policy, isBuildingPolicy, extractedText);
      }
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    }
    setUploadingPolicyDocId(null);
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingUploadPolicyId) handleCOIUpload(file, pendingUploadPolicyId, pendingUploadIsBuildingPolicy);
    e.target.value = '';
  };

  const onPolicyDocSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingUploadPolicyId) handlePolicyDocUpload(file, pendingUploadPolicyId, pendingUploadIsBuildingPolicy);
    e.target.value = '';
  };

  // ── Deep AI Review ──
  const handleDeepReview = async (policy: any, isBuildingPolicy: boolean, documentText?: string) => {
    setReviewingId(policy.id);
    try {
      const policyData = {
        ...policy,
        tenant_name: policy.tenants?.company_name,
        property_address: policy.properties?.address,
        is_building_policy: isBuildingPolicy,
      };
      const { data, error } = await supabase.functions.invoke('review-insurance', {
        body: { mode: 'deep_review', policy_id: policy.id, policy_data: policyData, ...(documentText ? { policy_document_text: documentText } : {}) },
      });
      if (error) throw error;
      setReviewResult(data.review);
      setReviewDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: isBuildingPolicy ? ['building-insurance-policies'] : ['all-insurance-policies'] });
      toast.success('Deep AI compliance review complete');
    } catch (e: any) {
      toast.error(e.message || 'AI review failed');
    }
    setReviewingId(null);
  };

  // ── Computed stats ──
  const allTenant = tenantPolicies || [];
  const allBuilding = buildingPolicies || [];
  const allPolicies = [...allTenant, ...allBuilding];
  const expiredCount = allPolicies.filter(p => p.expiration_date && new Date(p.expiration_date) < new Date()).length;
  const expiringSoonCount = allPolicies.filter(p => {
    if (!p.expiration_date) return false;
    const days = differenceInDays(parseISO(p.expiration_date), new Date());
    return days > 0 && days <= 30;
  }).length;
  const nonCompliantCount = allTenant.filter(p => {
    const isExpired = p.expiration_date && new Date(p.expiration_date) < new Date();
    if (isExpired) return false;
    return (p.required_minimum && p.coverage_amount && Number(p.coverage_amount) < Number(p.required_minimum)) ||
      (p.additional_insured_required && !p.additional_insured);
  }).length;
  const coverageGaps = getCoverageGaps(allTenant);
  const aiReviewedCount = allPolicies.filter(p => p.ai_review_status === 'reviewed').length;
  const groupedTenant = groupPoliciesByPropertyTenant(allTenant);

  const isLoading = loadingTenant || loadingBuilding;

  // Renewals: tenant + building within 60 days
  const renewalPolicies = [
    ...allTenant.filter(p => p.expiration_date && differenceInDays(parseISO(p.expiration_date), new Date()) <= 60).map(p => ({ ...p, _isBuildingPolicy: false })),
    ...allBuilding.filter(p => p.expiration_date && differenceInDays(parseISO(p.expiration_date), new Date()) <= 60).map(p => ({ ...p, _isBuildingPolicy: true })),
  ].sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={onFileSelected} />
      <input ref={policyDocInputRef} type="file" accept=".pdf" className="hidden" onChange={onPolicyDocSelected} />

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Insurance</h1>
        <p className="text-sm text-muted-foreground">Tenant COI compliance, building policies & AI-powered coverage review</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <button className="bg-card rounded-xl border border-border p-4 flex items-center gap-3 hover:border-primary/40 transition-colors cursor-pointer text-left" onClick={() => setActiveTab('tenant')}>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xl font-display font-bold">{allPolicies.length}</p><p className="text-xs text-muted-foreground">Total Policies</p></div>
        </button>
        <button className="bg-card rounded-xl border border-border p-4 flex items-center gap-3 hover:border-warning/40 transition-colors cursor-pointer text-left" onClick={() => setActiveTab('renewals')}>
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><ShieldAlert className="w-5 h-5 text-warning" /></div>
          <div><p className="text-xl font-display font-bold">{expiringSoonCount}</p><p className="text-xs text-muted-foreground">Expiring ≤30d</p></div>
        </button>
        <button className="bg-card rounded-xl border border-border p-4 flex items-center gap-3 hover:border-destructive/40 transition-colors cursor-pointer text-left" onClick={() => setActiveTab('renewals')}>
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center"><ShieldX className="w-5 h-5 text-destructive" /></div>
          <div><p className="text-xl font-display font-bold">{expiredCount}</p><p className="text-xs text-muted-foreground">Expired</p></div>
        </button>
        <button className="bg-card rounded-xl border border-border p-4 flex items-center gap-3 hover:border-foreground/20 transition-colors cursor-pointer text-left" onClick={() => setActiveTab('gaps')}>
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-foreground" /></div>
          <div><p className="text-xl font-display font-bold">{nonCompliantCount}</p><p className="text-xs text-muted-foreground">Non-Compliant</p></div>
        </button>
        <button className="bg-card rounded-xl border border-border p-4 flex items-center gap-3 hover:border-primary/40 transition-colors cursor-pointer text-left" onClick={() => setActiveTab('tenant')}>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Bot className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xl font-display font-bold">{aiReviewedCount}</p><p className="text-xs text-muted-foreground">AI Reviewed</p></div>
        </button>
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenant" className="gap-1"><Users className="w-3.5 h-3.5" /> Tenant ({allTenant.length})</TabsTrigger>
          <TabsTrigger value="building" className="gap-1"><Building2 className="w-3.5 h-3.5" /> Building ({allBuilding.length})</TabsTrigger>
          <TabsTrigger value="gaps" className="gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Gaps ({coverageGaps.length})</TabsTrigger>
          <TabsTrigger value="renewals" className="gap-1"><RefreshCw className="w-3.5 h-3.5" /> Renewals ({renewalPolicies.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tenant">
          <TenantPoliciesTab
            groupedTenant={groupedTenant}
            tenantPolicies={allTenant}
            properties={properties}
            onDeepReview={handleDeepReview}
            reviewingId={reviewingId}
            uploadingPolicyId={uploadingPolicyId}
            uploadingPolicyDocId={uploadingPolicyDocId}
            triggerUpload={triggerUpload}
          />
        </TabsContent>

        <TabsContent value="building">
          <BuildingPoliciesTab
            buildingPolicies={allBuilding}
            properties={properties}
            onDeepReview={handleDeepReview}
            reviewingId={reviewingId}
            uploadingPolicyId={uploadingPolicyId}
            uploadingPolicyDocId={uploadingPolicyDocId}
            triggerUpload={triggerUpload}
          />
        </TabsContent>

        {/* Coverage Gaps Tab */}
        <TabsContent value="gaps" className="space-y-4">
          {coverageGaps.length > 0 ? (
            <div className="space-y-3">
              {coverageGaps.map((gap, i) => (
                <Card key={i} className="border-warning/30 cursor-pointer hover:border-warning/50 transition-colors" onClick={() => navigate(`/dashboard/properties/${gap.propertyId}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center mt-0.5"><AlertTriangle className="w-4 h-4 text-warning" /></div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{gap.tenantName}</p>
                        <p className="text-xs text-muted-foreground mb-2">{gap.propertyAddress}</p>
                        <ul className="space-y-1">
                          {gap.issues.map((issue, j) => (
                            <li key={j} className="text-sm text-foreground flex items-start gap-1.5"><span className="text-warning mt-0.5">⚠️</span> {issue}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <ShieldCheck className="w-12 h-12 mx-auto text-success mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No coverage gaps</h3>
              <p className="text-muted-foreground text-sm">All tenants meet their insurance requirements.</p>
            </div>
          )}
        </TabsContent>

        {/* Renewals Tab — now includes BOTH tenant and building */}
        <TabsContent value="renewals" className="space-y-4">
          {renewalPolicies.length > 0 ? (
            <div className="space-y-3">
              {renewalPolicies.map(p => {
                const daysLeft = differenceInDays(parseISO(p.expiration_date), new Date());
                const isExpired = daysLeft < 0;
                const renewalStatus = p.renewal_status || (isExpired ? 'overdue' : 'pending');
                const policyTypeLabel = p._isBuildingPolicy
                  ? BUILDING_POLICY_TYPES[p.policy_type] || p.policy_type
                  : TENANT_POLICY_TYPES[p.policy_type] || p.policy_type;
                const entityName = p._isBuildingPolicy
                  ? (p.properties?.address || '—')
                  : (p.tenants?.company_name || '—');

                return (
                  <Card key={p.id} className={`transition-colors ${isExpired ? 'border-destructive/30' : daysLeft <= 14 ? 'border-warning/30' : ''}`}>
                    <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isExpired ? 'bg-destructive/10' : 'bg-warning/10'}`}>
                          <RefreshCw className={`w-5 h-5 ${isExpired ? 'text-destructive' : 'text-warning'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{entityName} — {policyTypeLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {p._isBuildingPolicy ? 'Building Policy' : p.properties?.address} · {p.carrier_name || 'No carrier'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium">{isExpired ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d remaining`}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(p.expiration_date), 'MMM d, yyyy')}</p>
                        </div>
                        <Badge variant="outline" className={
                          renewalStatus === 'overdue' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                          renewalStatus === 'received' ? 'bg-success/10 text-success border-success/20' :
                          renewalStatus === 'requested' ? 'bg-primary/10 text-primary border-primary/20' :
                          'bg-warning/10 text-warning border-warning/20'
                        }>
                          {RENEWAL_STATUSES[renewalStatus] || 'Pending'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <RefreshCw className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No upcoming renewals</h3>
              <p className="text-muted-foreground text-sm">Policies expiring within 60 days will appear here.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* AI Review Result Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSearch className="w-5 h-5 text-primary" /> AI Policy Review</DialogTitle>
          </DialogHeader>
          {reviewResult && (
            <div className="prose prose-sm max-w-none text-foreground"><ReactMarkdown>{reviewResult}</ReactMarkdown></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InsurancePage;
