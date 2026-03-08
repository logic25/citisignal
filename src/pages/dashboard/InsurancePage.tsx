import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Plus, Loader2,
  Building2, Users, Bot, RefreshCw, ChevronDown, ChevronRight, FileSearch,
  Upload, FileText,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

// ── Policy type maps ──────────────────────────────
const TENANT_POLICY_TYPES: Record<string, string> = {
  general_liability: 'General Liability',
  workers_comp: "Workers' Comp",
  property_contents: 'Property / Contents',
  umbrella: 'Umbrella / Excess',
  auto: 'Business Auto',
  professional_liability: 'Professional Liability (E&O)',
  liquor_liability: 'Liquor Liability',
  cyber_liability: 'Cyber Liability',
  environmental: 'Environmental / Pollution',
  other: 'Other',
};

const BUILDING_POLICY_TYPES: Record<string, string> = {
  property: 'Building Property',
  general_liability: 'General Liability',
  umbrella: 'Umbrella / Excess',
  dno: "Directors & Officers",
  environmental: 'Environmental',
  flood: 'Flood',
  earthquake: 'Earthquake',
  equipment_breakdown: 'Equipment Breakdown',
  loss_of_rents: 'Loss of Rents / BI',
  other: 'Other',
};

const RENEWAL_STATUSES: Record<string, string> = {
  pending: 'Renewal Pending',
  requested: 'Requested',
  received: 'Received',
  overdue: 'Overdue',
};

// ── Form defaults ──────────────────────────────
const EMPTY_TENANT_FORM = {
  property_id: '', tenant_id: '', policy_type: 'general_liability',
  carrier_name: '', policy_number: '', coverage_amount: '',
  required_minimum: '', expiration_date: '', effective_date: '',
  additional_insured: false, additional_insured_required: true,
  additional_insured_entity_name: '', deductible: '',
  per_occurrence_limit: '', aggregate_limit: '', endorsements: '',
};

const EMPTY_BUILDING_FORM = {
  property_id: '', policy_type: 'property',
  carrier_name: '', policy_number: '', coverage_amount: '',
  deductible: '', per_occurrence_limit: '', aggregate_limit: '',
  effective_date: '', expiration_date: '',
  premium_annual: '', broker_name: '', broker_phone: '', broker_email: '',
  endorsements: '', notes: '',
};

// ── Helpers ──────────────────────────────
const getComplianceInfo = (p: any) => {
  const isExpired = p.expiration_date && new Date(p.expiration_date) < new Date();
  const isBelowMin = p.required_minimum && p.coverage_amount && Number(p.coverage_amount) < Number(p.required_minimum);
  const missingAdditional = p.additional_insured_required && !p.additional_insured;
  if (isExpired) return { label: 'Expired', variant: 'destructive' as const, color: 'bg-destructive/10 text-destructive border-destructive/20' };
  if (isBelowMin || missingAdditional) return { label: 'Non-Compliant', variant: 'outline' as const, color: 'bg-warning/10 text-warning border-warning/20' };
  if (p.expiration_date) {
    const days = differenceInDays(parseISO(p.expiration_date), new Date());
    if (days <= 30) return { label: `${days}d left`, variant: 'outline' as const, color: 'bg-warning/10 text-warning border-warning/20' };
  }
  return { label: 'Compliant', variant: 'outline' as const, color: 'bg-success/10 text-success border-success/20' };
};

const getCoverageGaps = (policies: any[]) => {
  const gaps: { tenantName: string; propertyAddress: string; propertyId: string; issues: string[] }[] = [];
  const byTenant = new Map<string, any[]>();
  for (const p of policies) {
    const key = p.tenant_id || 'unknown';
    if (!byTenant.has(key)) byTenant.set(key, []);
    byTenant.get(key)!.push(p);
  }
  for (const [, tenantPolicies] of byTenant) {
    const issues: string[] = [];
    const tenant = tenantPolicies[0];
    const types = new Set(tenantPolicies.map((p: any) => p.policy_type));
    if (!types.has('general_liability')) issues.push('Missing General Liability policy');
    for (const p of tenantPolicies) {
      if (p.required_minimum && p.coverage_amount && Number(p.coverage_amount) < Number(p.required_minimum)) {
        issues.push(`${TENANT_POLICY_TYPES[p.policy_type] || p.policy_type}: Coverage $${Number(p.coverage_amount).toLocaleString()} below required $${Number(p.required_minimum).toLocaleString()}`);
      }
      if (p.additional_insured_required && !p.additional_insured) {
        issues.push(`${TENANT_POLICY_TYPES[p.policy_type] || p.policy_type}: Additional Insured not listed`);
      }
      if (p.expiration_date && new Date(p.expiration_date) < new Date()) {
        issues.push(`${TENANT_POLICY_TYPES[p.policy_type] || p.policy_type}: Expired ${format(parseISO(p.expiration_date), 'MM/dd/yy')}`);
      }
    }
    if (issues.length > 0) {
      gaps.push({
        tenantName: tenant.tenants?.company_name || 'Unknown Tenant',
        propertyAddress: tenant.properties?.address || 'Unknown',
        propertyId: tenant.property_id,
        issues,
      });
    }
  }
  return gaps;
};

// ── Group policies by property → tenant ──
type GroupedPolicies = {
  propertyId: string;
  propertyAddress: string;
  tenants: {
    tenantId: string;
    tenantName: string;
    policies: any[];
  }[];
};

const groupPoliciesByPropertyTenant = (policies: any[]): GroupedPolicies[] => {
  const byProperty = new Map<string, Map<string, any[]>>();
  const propertyNames = new Map<string, string>();
  const tenantNames = new Map<string, string>();

  for (const p of policies) {
    const propId = p.property_id || 'unknown';
    const tenantId = p.tenant_id || 'unknown';
    propertyNames.set(propId, p.properties?.address || 'Unknown Property');
    tenantNames.set(tenantId, p.tenants?.company_name || 'Unknown Tenant');

    if (!byProperty.has(propId)) byProperty.set(propId, new Map());
    const tenantMap = byProperty.get(propId)!;
    if (!tenantMap.has(tenantId)) tenantMap.set(tenantId, []);
    tenantMap.get(tenantId)!.push(p);
  }

  const result: GroupedPolicies[] = [];
  for (const [propId, tenantMap] of byProperty) {
    const tenants: GroupedPolicies['tenants'] = [];
    for (const [tenantId, pols] of tenantMap) {
      tenants.push({ tenantId, tenantName: tenantNames.get(tenantId) || 'Unknown', policies: pols });
    }
    tenants.sort((a, b) => a.tenantName.localeCompare(b.tenantName));
    result.push({ propertyId: propId, propertyAddress: propertyNames.get(propId) || 'Unknown', tenants });
  }
  result.sort((a, b) => a.propertyAddress.localeCompare(b.propertyAddress));
  return result;
};

// ── Main Component ──────────────────────────────
const InsurancePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [tenantForm, setTenantForm] = useState(EMPTY_TENANT_FORM);
  const [buildingForm, setBuildingForm] = useState(EMPTY_BUILDING_FORM);
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());
  const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [uploadingPolicyId, setUploadingPolicyId] = useState<string | null>(null);
  const [uploadingPolicyDocId, setUploadingPolicyDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const policyDocInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadPolicyId, setPendingUploadPolicyId] = useState<string | null>(null);
  const [pendingUploadIsBuildingPolicy, setPendingUploadIsBuildingPolicy] = useState(false);
  const [pendingUploadType, setPendingUploadType] = useState<'coi' | 'policy'>('coi');
  const [extracting, setExtracting] = useState(false);
  const [complianceNotes, setComplianceNotes] = useState<string | null>(null);
  const dialogFileInputRef = useRef<HTMLInputElement>(null);
  const dialogPolicyFileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('tenant');
  const [uploadingDialogPolicy, setUploadingDialogPolicy] = useState(false);

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

  const { data: tenants } = useQuery({
    queryKey: ['tenants-for-property', tenantForm.property_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('id, company_name').eq('property_id', tenantForm.property_id).order('company_name');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantForm.property_id,
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

  // ── COI Upload ──
  const handleCOIUpload = async (file: File, policyId: string, isBuildingPolicy: boolean) => {
    setUploadingPolicyId(policyId);
    try {
      // Find the policy to get property_id
      const policy = isBuildingPolicy
        ? (buildingPolicies || []).find(p => p.id === policyId)
        : (tenantPolicies || []).find(p => p.id === policyId);
      if (!policy) throw new Error('Policy not found');

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = `${policy.property_id}/coi_${policyId}_${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('property-documents')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('property-documents').getPublicUrl(fileName);
      const fileUrl = publicUrl || fileName;

      // Update the policy's certificate_url
      const table = isBuildingPolicy ? 'building_insurance_policies' : 'tenant_insurance_policies';
      await supabase.from(table).update({ certificate_url: fileUrl }).eq('id', policyId);

      // Also create a property_documents record so it shows in property detail
      const tenantName = !isBuildingPolicy ? policy.tenants?.company_name : null;
      const policyType = isBuildingPolicy
        ? BUILDING_POLICY_TYPES[policy.policy_type] || policy.policy_type
        : TENANT_POLICY_TYPES[policy.policy_type] || policy.policy_type;
      const docName = tenantName
        ? `COI — ${tenantName} — ${policyType}`
        : `Building Policy — ${policyType}`;

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

      // Trigger text extraction for AI review
      try {
        await supabase.functions.invoke('extract-document-text', {
          body: { file_url: fileUrl, property_id: policy.property_id },
        });
      } catch {
        // Non-critical — extraction may not be available
      }

      queryClient.invalidateQueries({ queryKey: isBuildingPolicy ? ['building-insurance-policies'] : ['all-insurance-policies'] });
      toast.success('COI uploaded & linked to property documents');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    }
    setUploadingPolicyId(null);
  };

  const triggerUpload = (policyId: string, isBuildingPolicy: boolean, type: 'coi' | 'policy' = 'coi') => {
    setPendingUploadPolicyId(policyId);
    setPendingUploadIsBuildingPolicy(isBuildingPolicy);
    setPendingUploadType(type);
    if (type === 'policy') {
      policyDocInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingUploadPolicyId) {
      handleCOIUpload(file, pendingUploadPolicyId, pendingUploadIsBuildingPolicy);
    }
    e.target.value = '';
  };

  const onPolicyDocSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingUploadPolicyId) {
      handlePolicyDocUpload(file, pendingUploadPolicyId, pendingUploadIsBuildingPolicy);
    }
    e.target.value = '';
  };

  // ── Full Policy Document Upload + Auto Deep Review ──
  const handlePolicyDocUpload = async (file: File, policyId: string, isBuildingPolicy: boolean) => {
    setUploadingPolicyDocId(policyId);
    try {
      const policy = isBuildingPolicy
        ? (buildingPolicies || []).find(p => p.id === policyId)
        : (tenantPolicies || []).find(p => p.id === policyId);
      if (!policy) throw new Error('Policy not found');

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = `${policy.property_id}/policy_doc_${policyId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('property-documents')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('property-documents').getPublicUrl(fileName);
      const fileUrl = publicUrl || fileName;

      // Update the policy's policy_document_url
      const table = isBuildingPolicy ? 'building_insurance_policies' : 'tenant_insurance_policies';
      await supabase.from(table).update({ policy_document_url: fileUrl } as any).eq('id', policyId);

      // Create a property_documents record
      const tenantName = !isBuildingPolicy ? policy.tenants?.company_name : null;
      const policyType = isBuildingPolicy
        ? BUILDING_POLICY_TYPES[policy.policy_type] || policy.policy_type
        : TENANT_POLICY_TYPES[policy.policy_type] || policy.policy_type;
      const docName = tenantName
        ? `Full Policy — ${tenantName} — ${policyType}`
        : `Full Building Policy — ${policyType}`;

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

      // Extract text
      let extractedText = '';
      try {
        const { data: extractData } = await supabase.functions.invoke('extract-document-text', {
          body: { file_url: fileUrl, property_id: policy.property_id },
        });
        extractedText = extractData?.text || '';
      } catch {
        // Non-critical
      }

      queryClient.invalidateQueries({ queryKey: isBuildingPolicy ? ['building-insurance-policies'] : ['all-insurance-policies'] });
      toast.success('Policy document uploaded');

      // Auto-trigger deep AI compliance review if we got text
      if (extractedText.length > 100) {
        toast.info('Running deep AI compliance review...');
        handleDeepReview(policy, isBuildingPolicy, extractedText);
      }
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    }
    setUploadingPolicyDocId(null);
  };

  // ── Deep AI Policy Review ──
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
        body: {
          mode: 'deep_review',
          policy_id: policy.id,
          policy_data: policyData,
          ...(documentText ? { policy_document_text: documentText } : {}),
        },
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

  // ── COI Upload + AI Extract for Add Dialog ──
  const handleDialogCOIUpload = async (file: File) => {
    if (!tenantForm.property_id) {
      toast.error('Please select a property first');
      return;
    }
    setExtracting(true);
    setComplianceNotes(null);
    try {
      // 1. Upload file to storage
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = `${tenantForm.property_id}/coi_new_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('property-documents').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('property-documents').getPublicUrl(fileName);

      // 2. Extract text from the document
      const { data: extractData } = await supabase.functions.invoke('extract-document-text', {
        body: { file_url: publicUrl || fileName, property_id: tenantForm.property_id },
      });
      const extractedText = extractData?.text || '';
      if (!extractedText || extractedText.length < 50) {
        toast.error('Could not extract enough text from the document. Please fill the form manually.');
        setExtracting(false);
        return;
      }

      // 3. Get the owner's entity name for Additional Insured check
      const { data: profile } = await supabase.from('profiles').select('company_name').eq('user_id', user!.id).maybeSingle();

      // 4. Call AI to parse into structured fields
      const { data: parseResult, error: parseError } = await supabase.functions.invoke('review-insurance', {
        body: {
          mode: 'extract',
          document_text: extractedText,
          owner_entity_name: profile?.company_name || '',
        },
      });
      if (parseError) throw parseError;

      const fields = parseResult?.extracted;
      if (!fields) throw new Error('AI could not parse the document');

      // 5. Auto-fill the form
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

      if (fields.compliance_notes) {
        setComplianceNotes(fields.compliance_notes);
      }

      toast.success('AI extracted policy details — review and adjust before saving');
    } catch (e: any) {
      console.error('COI extraction error:', e);
      toast.error(e.message || 'Failed to extract policy details');
    }
    setExtracting(false);
  };

  // ── Mutations ──
  const saveTenantMutation = useMutation({
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
      };
      const { error } = await supabase.from('tenant_insurance_policies').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tenant policy added');
      setTenantDialogOpen(false);
      setTenantForm(EMPTY_TENANT_FORM);
      queryClient.invalidateQueries({ queryKey: ['all-insurance-policies'] });
    },
    onError: () => toast.error('Failed to add policy'),
  });

  const saveBuildingMutation = useMutation({
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
      const { error } = await supabase.from('building_insurance_policies').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Building policy added');
      setBuildingDialogOpen(false);
      setBuildingForm(EMPTY_BUILDING_FORM);
      queryClient.invalidateQueries({ queryKey: ['building-insurance-policies'] });
    },
    onError: () => toast.error('Failed to add policy'),
  });

  // ── AI Review ──
  const handleAIReview = async (policy: any, isBuildingPolicy: boolean) => {
    setReviewingId(policy.id);
    try {
      const policyData = {
        ...policy,
        tenant_name: policy.tenants?.company_name,
        property_address: policy.properties?.address,
        is_building_policy: isBuildingPolicy,
      };
      const { data, error } = await supabase.functions.invoke('review-insurance', {
        body: { policy_id: policy.id, policy_data: policyData },
      });
      if (error) throw error;
      setReviewResult(data.review);
      setReviewDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: isBuildingPolicy ? ['building-insurance-policies'] : ['all-insurance-policies'] });
      toast.success('AI review complete');
    } catch (e: any) {
      toast.error(e.message || 'AI review failed');
    }
    setReviewingId(null);
  };

  // ── Toggle helpers ──
  const toggleProperty = (id: string) => {
    setExpandedProperties(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTenant = (key: string) => {
    setExpandedTenants(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-5 gap-4">
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Insurance</h1>
          <p className="text-sm text-muted-foreground">
            Tenant COI compliance, building policies & AI-powered coverage review
          </p>
        </div>
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
          <TabsTrigger value="tenant" className="gap-1"><Users className="w-3.5 h-3.5" /> Tenant Policies ({allTenant.length})</TabsTrigger>
          <TabsTrigger value="building" className="gap-1"><Building2 className="w-3.5 h-3.5" /> Building Policies ({allBuilding.length})</TabsTrigger>
          <TabsTrigger value="gaps" className="gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Coverage Gaps ({coverageGaps.length})</TabsTrigger>
          <TabsTrigger value="renewals" className="gap-1"><RefreshCw className="w-3.5 h-3.5" /> Renewals</TabsTrigger>
        </TabsList>

        {/* ── Tenant Policies Tab (nested by property → tenant) ── */}
        <TabsContent value="tenant" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={tenantDialogOpen} onOpenChange={setTenantDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!properties?.length} onClick={() => { setTenantForm(EMPTY_TENANT_FORM); setComplianceNotes(null); }}>
                  <Plus className="w-4 h-4 mr-1" /> Add Tenant Policy
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add Tenant Insurance Policy</DialogTitle></DialogHeader>

                {/* COI Upload + AI Auto-Fill */}
                <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 mb-1">
                  <input
                    ref={dialogFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDialogCOIUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-sm text-foreground">Upload COI for AI Auto-Fill</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload the tenant's Certificate of Insurance and AI will extract all policy details, check Additional Insured status, and flag compliance issues.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!tenantForm.property_id || extracting}
                      onClick={() => dialogFileInputRef.current?.click()}
                      className="mt-1"
                    >
                      {extracting ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Analyzing COI...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-1" /> Choose File</>
                      )}
                    </Button>
                    {!tenantForm.property_id && (
                      <p className="text-[11px] text-warning">Select a property first</p>
                    )}
                  </div>
                </div>

                {/* AI Compliance Notes */}
                {complianceNotes && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 mb-1">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-xs text-foreground mb-1">AI Compliance Check</p>
                        <p className="text-xs text-muted-foreground">{complianceNotes}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Property *</Label>
                    <Select value={tenantForm.property_id} onValueChange={v => { setTenantForm(prev => ({ ...prev, property_id: v, tenant_id: '' })); }}>
                      <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                      <SelectContent>{(properties || []).map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Tenant *</Label>
                    <Select value={tenantForm.tenant_id} onValueChange={v => setTenantForm(prev => ({ ...prev, tenant_id: v }))} disabled={!tenantForm.property_id}>
                      <SelectTrigger><SelectValue placeholder={tenantForm.property_id ? "Select tenant" : "Select property first"} /></SelectTrigger>
                      <SelectContent>{(tenants || []).map(t => <SelectItem key={t.id} value={t.id}>{t.company_name}</SelectItem>)}</SelectContent>
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
                  <Button onClick={() => saveTenantMutation.mutate()} disabled={saveTenantMutation.isPending || !tenantForm.property_id || !tenantForm.tenant_id}>
                    {saveTenantMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Add
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
                const propIssueCount = group.tenants.reduce((sum, t) => sum + t.policies.filter((p: any) => {
                  const c = getComplianceInfo(p);
                  return c.label !== 'Compliant';
                }).length, 0);

                return (
                  <div key={group.propertyId} className="rounded-xl border border-border bg-card overflow-hidden">
                    {/* Property Header */}
                    <button
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
                      onClick={() => toggleProperty(group.propertyId)}
                    >
                      <div className="flex items-center gap-3">
                        {isPropExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-foreground">{group.propertyAddress}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{propPolicyCount} {propPolicyCount === 1 ? 'policy' : 'policies'}</Badge>
                        <Badge variant="outline" className="text-xs">{group.tenants.length} {group.tenants.length === 1 ? 'tenant' : 'tenants'}</Badge>
                        {propIssueCount > 0 && (
                          <Badge variant="destructive" className="text-xs">{propIssueCount} issue{propIssueCount > 1 ? 's' : ''}</Badge>
                        )}
                      </div>
                    </button>

                    {/* Tenants within property */}
                    {isPropExpanded && (
                      <div className="border-t border-border">
                        {group.tenants.map(tenant => {
                          const tenantKey = `${group.propertyId}_${tenant.tenantId}`;
                          const isTenantExpanded = expandedTenants.has(tenantKey);
                          const tenantIssues = tenant.policies.filter((p: any) => getComplianceInfo(p).label !== 'Compliant').length;

                          return (
                            <div key={tenantKey} className="border-b border-border last:border-b-0">
                              {/* Tenant Header */}
                              <button
                                className="w-full flex items-center justify-between px-6 py-3 hover:bg-muted/20 transition-colors text-left"
                                onClick={() => toggleTenant(tenantKey)}
                              >
                                <div className="flex items-center gap-3">
                                  {isTenantExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="font-medium text-foreground text-sm">{tenant.tenantName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{tenant.policies.length} {tenant.policies.length === 1 ? 'policy' : 'policies'}</span>
                                  {tenantIssues > 0 && (
                                    <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px]">{tenantIssues} issue{tenantIssues > 1 ? 's' : ''}</Badge>
                                  )}
                                </div>
                              </button>

                              {/* Policies for this tenant */}
                              {isTenantExpanded && (
                                <div className="px-6 pb-3">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-muted/30">
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead className="font-semibold text-xs">Type</TableHead>
                                        <TableHead className="font-semibold text-xs">Carrier</TableHead>
                                        <TableHead className="font-semibold text-xs">Coverage</TableHead>
                                        <TableHead className="font-semibold text-xs">Expires</TableHead>
                                        <TableHead className="font-semibold text-xs">Add'l Insured</TableHead>
                                        <TableHead className="font-semibold text-xs">Status</TableHead>
                                        <TableHead className="font-semibold text-xs">COI</TableHead>
                                        <TableHead className="w-16"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {tenant.policies.map((p: any) => {
                                        const compliance = getComplianceInfo(p);
                                        const daysLeft = p.expiration_date ? differenceInDays(parseISO(p.expiration_date), new Date()) : null;
                                        const isExpired = daysLeft !== null && daysLeft < 0;
                                        const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                                        const isPolicyExpanded = expandedPolicy === p.id;
                                        const aiMissing = p.additional_insured_required && !p.additional_insured;
                                        return (
                                          <>
                                            <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setExpandedPolicy(isPolicyExpanded ? null : p.id)}>
                                              <TableCell className="px-2">
                                                {isPolicyExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                              </TableCell>
                                              <TableCell className="text-xs">{TENANT_POLICY_TYPES[p.policy_type] || p.policy_type}</TableCell>
                                              <TableCell className="text-xs">{p.carrier_name || '—'}</TableCell>
                                              <TableCell className="text-xs">
                                                {p.coverage_amount ? `$${Number(p.coverage_amount).toLocaleString()}` : '—'}
                                                {p.required_minimum && (
                                                  <span className={`ml-1 text-[10px] ${Number(p.coverage_amount) < Number(p.required_minimum) ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                    / ${Number(p.required_minimum).toLocaleString()}
                                                  </span>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-xs">
                                                <div className="flex items-center gap-1">
                                                  <span className="text-muted-foreground">{p.expiration_date ? format(parseISO(p.expiration_date), 'MM/dd/yy') : '—'}</span>
                                                  {isExpired && <Badge variant="destructive" className="text-[9px] py-0 px-1">Exp</Badge>}
                                                  {isExpiringSoon && <Badge className="bg-warning/10 text-warning border-warning/20 text-[9px] py-0 px-1">{daysLeft}d</Badge>}
                                                </div>
                                              </TableCell>
                                              <TableCell>
                                                {p.additional_insured_required ? (
                                                  aiMissing ? (
                                                    <Badge variant="destructive" className="text-[9px]">⚠️ Missing</Badge>
                                                  ) : (
                                                    <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[9px]">✓ Listed</Badge>
                                                  )
                                                ) : (
                                                  <span className="text-[10px] text-muted-foreground">N/A</span>
                                                )}
                                              </TableCell>
                                              <TableCell><Badge variant="outline" className={`${compliance.color} text-[9px]`}>{compliance.label}</Badge></TableCell>
                                              <TableCell>
                                                {p.certificate_url ? (
                                                  <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[9px] gap-1">
                                                    <FileText className="w-2.5 h-2.5" /> On File
                                                  </Badge>
                                                ) : (
                                                  <Button
                                                    variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1"
                                                    onClick={(e) => { e.stopPropagation(); triggerUpload(p.id, false); }}
                                                    disabled={uploadingPolicyId === p.id}
                                                  >
                                                    {uploadingPolicyId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                                    Upload
                                                  </Button>
                                                )}
                                              </TableCell>
                                              <TableCell>
                                                <Button
                                                  variant="ghost" size="icon" className="h-6 w-6"
                                                  onClick={(e) => { e.stopPropagation(); handleDeepReview(p, false); }}
                                                  disabled={reviewingId === p.id}
                                                  title={p.policy_document_url ? "Deep AI Review (with policy doc)" : p.certificate_url ? "AI Review (with COI)" : "AI Review (metadata only)"}
                                                >
                                                  {reviewingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                                                </Button>
                                              </TableCell>
                                            </TableRow>
                                            {isPolicyExpanded && (
                                              <TableRow key={`${p.id}-details`}>
                                                <TableCell colSpan={9} className="bg-muted/20 p-4">
                                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                    <div><p className="text-xs text-muted-foreground">Policy #</p><p className="font-medium">{p.policy_number || '—'}</p></div>
                                                    <div><p className="text-xs text-muted-foreground">Effective</p><p className="font-medium">{p.effective_date ? format(parseISO(p.effective_date), 'MM/dd/yyyy') : '—'}</p></div>
                                                    <div><p className="text-xs text-muted-foreground">Deductible</p><p className="font-medium">{p.deductible ? `$${Number(p.deductible).toLocaleString()}` : '—'}</p></div>
                                                    <div><p className="text-xs text-muted-foreground">Per Occurrence</p><p className="font-medium">{p.per_occurrence_limit ? `$${Number(p.per_occurrence_limit).toLocaleString()}` : '—'}</p></div>
                                                    <div><p className="text-xs text-muted-foreground">Aggregate</p><p className="font-medium">{p.aggregate_limit ? `$${Number(p.aggregate_limit).toLocaleString()}` : '—'}</p></div>
                                                    <div><p className="text-xs text-muted-foreground">Add'l Insured Entity</p><p className="font-medium">{p.additional_insured_entity_name || '—'}</p></div>
                                                    <div className="col-span-2"><p className="text-xs text-muted-foreground">Endorsements</p><p className="font-medium">{p.endorsements || '—'}</p></div>
                                                  </div>

                                                  {/* Documents Section — COI + Full Policy */}
                                                  <div className="mt-3 grid grid-cols-2 gap-3">
                                                    <div className="rounded-lg border border-border p-3">
                                                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Certificate of Insurance (COI)</p>
                                                      {p.certificate_url ? (
                                                        <div className="flex items-center gap-2">
                                                          <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] gap-1"><FileText className="w-2.5 h-2.5" /> On File</Badge>
                                                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={(e) => { e.stopPropagation(); triggerUpload(p.id, false, 'coi'); }}>
                                                            <Upload className="w-3 h-3" /> Replace
                                                          </Button>
                                                        </div>
                                                      ) : (
                                                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); triggerUpload(p.id, false, 'coi'); }} disabled={uploadingPolicyId === p.id}>
                                                          {uploadingPolicyId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload COI
                                                        </Button>
                                                      )}
                                                    </div>
                                                    <div className="rounded-lg border border-border p-3">
                                                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Full Insurance Policy</p>
                                                      {(p as any).policy_document_url ? (
                                                        <div className="flex items-center gap-2">
                                                          <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] gap-1"><FileText className="w-2.5 h-2.5" /> On File</Badge>
                                                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={(e) => { e.stopPropagation(); triggerUpload(p.id, false, 'policy'); }}>
                                                            <Upload className="w-3 h-3" /> Replace
                                                          </Button>
                                                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={(e) => { e.stopPropagation(); handleDeepReview(p, false); }} disabled={reviewingId === p.id}>
                                                            {reviewingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} Re-run Review
                                                          </Button>
                                                        </div>
                                                      ) : (
                                                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); triggerUpload(p.id, false, 'policy'); }} disabled={uploadingPolicyDocId === p.id}>
                                                          {uploadingPolicyDocId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload Policy
                                                        </Button>
                                                      )}
                                                    </div>
                                                  </div>

                                                  {p.ai_review_notes && (
                                                    <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                                      <p className="text-xs text-primary font-medium mb-1 flex items-center gap-1"><Bot className="w-3 h-3" /> AI Compliance Review — {p.ai_reviewed_at ? format(new Date(p.ai_reviewed_at), 'MM/dd/yy') : ''}</p>
                                                      <div className="prose prose-sm max-w-none text-xs text-foreground">
                                                        <ReactMarkdown>{p.ai_review_notes}</ReactMarkdown>
                                                      </div>
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
              <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No tenant policies</h3>
              <p className="text-muted-foreground text-sm">Click "Add Tenant Policy" to track tenant insurance.</p>
            </div>
          )}
        </TabsContent>

        {/* ── Building Policies Tab ── */}
        <TabsContent value="building" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={buildingDialogOpen} onOpenChange={setBuildingDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!properties?.length} onClick={() => setBuildingForm(EMPTY_BUILDING_FORM)}>
                  <Plus className="w-4 h-4 mr-1" /> Add Building Policy
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add Building Insurance Policy</DialogTitle></DialogHeader>
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
                  <Button onClick={() => saveBuildingMutation.mutate()} disabled={saveBuildingMutation.isPending || !buildingForm.property_id}>
                    {saveBuildingMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Add
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {allBuilding.length > 0 ? (
            <div className="space-y-3">
              {allBuilding.map(p => {
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
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] gap-1">
                              <FileText className="w-2.5 h-2.5" /> COI
                            </Badge>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => triggerUpload(p.id, true, 'coi')} disabled={uploadingPolicyId === p.id}>
                              {uploadingPolicyId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload COI
                            </Button>
                          )}
                          {(p as any).policy_document_url ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] gap-1">
                              <FileText className="w-2.5 h-2.5" /> Policy
                            </Badge>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => triggerUpload(p.id, true, 'policy')} disabled={uploadingPolicyDocId === p.id}>
                              {uploadingPolicyDocId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload Policy
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeepReview(p, true)} disabled={reviewingId === p.id}>
                            {reviewingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
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
                          <div className="prose prose-sm max-w-none text-xs text-foreground">
                            <ReactMarkdown>{p.ai_review_notes}</ReactMarkdown>
                          </div>
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
        </TabsContent>

        {/* ── Coverage Gaps Tab ── */}
        <TabsContent value="gaps" className="space-y-4">
          {coverageGaps.length > 0 ? (
            <div className="space-y-3">
              {coverageGaps.map((gap, i) => (
                <Card key={i} className="border-warning/30 cursor-pointer hover:border-warning/50 transition-colors" onClick={() => navigate(`/dashboard/properties/${gap.propertyId}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center mt-0.5">
                        <AlertTriangle className="w-4 h-4 text-warning" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{gap.tenantName}</p>
                        <p className="text-xs text-muted-foreground mb-2">{gap.propertyAddress}</p>
                        <ul className="space-y-1">
                          {gap.issues.map((issue, j) => (
                            <li key={j} className="text-sm text-foreground flex items-start gap-1.5">
                              <span className="text-warning mt-0.5">⚠️</span> {issue}
                            </li>
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

        {/* ── Renewals Tab ── */}
        <TabsContent value="renewals" className="space-y-4">
          {(() => {
            const renewalPolicies = allTenant.filter(p => {
              if (!p.expiration_date) return false;
              const days = differenceInDays(parseISO(p.expiration_date), new Date());
              return days <= 60;
            }).sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());

            return renewalPolicies.length > 0 ? (
              <div className="space-y-3">
                {renewalPolicies.map(p => {
                  const daysLeft = differenceInDays(parseISO(p.expiration_date), new Date());
                  const isExpired = daysLeft < 0;
                  const renewalStatus = p.renewal_status || (isExpired ? 'overdue' : daysLeft <= 14 ? 'pending' : 'pending');
                  return (
                    <Card key={p.id} className={`transition-colors ${isExpired ? 'border-destructive/30' : daysLeft <= 14 ? 'border-warning/30' : ''}`}>
                      <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isExpired ? 'bg-destructive/10' : 'bg-warning/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${isExpired ? 'text-destructive' : 'text-warning'}`} />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{p.tenants?.company_name || '—'} — {TENANT_POLICY_TYPES[p.policy_type] || p.policy_type}</p>
                            <p className="text-xs text-muted-foreground">{p.properties?.address} · {p.carrier_name || 'No carrier'}</p>
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
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* AI Review Result Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSearch className="w-5 h-5 text-primary" /> AI Policy Review</DialogTitle>
          </DialogHeader>
          {reviewResult && (
            <div className="prose prose-sm max-w-none text-foreground">
              <ReactMarkdown>{reviewResult}</ReactMarkdown>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InsurancePage;
