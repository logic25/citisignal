import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, UserCheck, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateViolationNoticePDF } from '@/lib/violation-notice-pdf';

interface Tenant {
  id: string;
  company_name: string;
  unit_number: string | null;
  contact_name: string | null;
  contact_email: string | null;
}

interface ViolationTenantAssignmentProps {
  violationId: string;
  propertyId: string;
  currentTenantId: string | null;
  descriptionRaw: string | null;
  violationNumber: string;
  agency: string;
  issuedDate: string;
  propertyAddress: string;
  onAssigned: () => void;
}

export const ViolationTenantAssignment = ({
  violationId,
  propertyId,
  currentTenantId,
  descriptionRaw,
  violationNumber,
  agency,
  issuedDate,
  propertyAddress,
  onAssigned,
}: ViolationTenantAssignmentProps) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(currentTenantId || 'none');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    const fetchTenants = async () => {
      const { data } = await supabase
        .from('tenants')
        .select('id, company_name, unit_number, contact_name, contact_email')
        .eq('property_id', propertyId)
        .eq('status', 'active')
        .order('company_name');
      if (data) setTenants(data as Tenant[]);
      setLoading(false);
    };
    fetchTenants();
  }, [propertyId]);

  // Auto-suggest: find tenant whose unit_number appears in the violation description
  const suggestedTenantId = useMemo(() => {
    if (currentTenantId || !descriptionRaw || tenants.length === 0) return null;
    const descLower = descriptionRaw.toLowerCase();
    for (const t of tenants) {
      if (t.unit_number) {
        const unit = t.unit_number.toLowerCase().trim();
        // Match patterns like "unit 2A", "suite 2A", "apt 2A", or just the unit number
        if (
          descLower.includes(`unit ${unit}`) ||
          descLower.includes(`suite ${unit}`) ||
          descLower.includes(`apt ${unit}`) ||
          descLower.includes(`floor ${unit}`) ||
          descLower.includes(`#${unit}`) ||
          descLower.includes(` ${unit} `) ||
          descLower.includes(` ${unit},`)
        ) {
          return t.id;
        }
      }
    }
    return null;
  }, [descriptionRaw, tenants, currentTenantId]);

  const handleAssign = async () => {
    setSaving(true);
    const tenantId = selectedTenantId === 'none' ? null : selectedTenantId;
    const { error } = await supabase
      .from('violations')
      .update({
        tenant_id: tenantId,
        tenant_assigned_at: tenantId ? new Date().toISOString() : null,
      })
      .eq('id', violationId);

    setSaving(false);
    if (error) {
      toast.error('Failed to assign tenant');
    } else {
      toast.success(tenantId ? 'Violation assigned to tenant' : 'Tenant unassigned');
      onAssigned();
    }
  };

  const handleGenerateNotice = async () => {
    const tenant = tenants.find(t => t.id === selectedTenantId);
    if (!tenant) return;

    setGeneratingPDF(true);
    try {
      await generateViolationNoticePDF({
        tenantName: tenant.company_name,
        contactName: tenant.contact_name,
        unitNumber: tenant.unit_number,
        propertyAddress,
        violationNumber,
        agency,
        issuedDate,
        description: descriptionRaw,
      });
      toast.success('Notice PDF downloaded');
    } catch {
      toast.error('Failed to generate notice');
    }
    setGeneratingPDF(false);
  };

  const assignedTenant = tenants.find(t => t.id === currentTenantId);

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  if (tenants.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <Users className="w-4 h-4" />
        Tenant Assignment
      </h4>

      {suggestedTenantId && !currentTenantId && selectedTenantId === 'none' && (
        <div className="flex items-center gap-2 text-xs bg-accent/50 rounded-md px-3 py-2 border border-accent">
          <UserCheck className="w-3.5 h-3.5 text-primary" />
          <span>
            Suggested: <strong>{tenants.find(t => t.id === suggestedTenantId)?.company_name}</strong>
            {' '}(unit match in description)
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs ml-auto"
            onClick={() => setSelectedTenantId(suggestedTenantId)}
          >
            Use
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
          <SelectTrigger className="w-56 h-8 text-xs">
            <SelectValue placeholder="Select tenant..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {tenants.map(t => (
              <SelectItem key={t.id} value={t.id}>
                {t.company_name}{t.unit_number ? ` (${t.unit_number})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={handleAssign}
          disabled={saving || selectedTenantId === (currentTenantId || 'none')}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          {currentTenantId ? 'Update' : 'Assign'}
        </Button>

        {selectedTenantId && selectedTenantId !== 'none' && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={handleGenerateNotice}
            disabled={generatingPDF}
          >
            {generatingPDF ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileDown className="w-3 h-3 mr-1" />}
            Generate Notice
          </Button>
        )}
      </div>

      {assignedTenant && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Badge variant="secondary" className="text-[10px]">
            Assigned to {assignedTenant.company_name}
            {assignedTenant.unit_number ? ` (${assignedTenant.unit_number})` : ''}
          </Badge>
        </div>
      )}
    </div>
  );
};
