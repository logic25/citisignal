import { useEffect, useState, useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { syncNYCBuildingDataByIdentifiers, toPropertyUpdate } from '@/lib/nyc-building-sync';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ArrowLeft, 
  Loader2, 
  RefreshCw,
  Building2,
  Settings,
  Clock,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { PropertyOverviewTab } from '@/components/properties/detail/PropertyOverviewTab';
import { PropertyApplicationsTab } from '@/components/properties/detail/PropertyApplicationsTab';
import { PropertyViolationsTab } from '@/components/properties/detail/PropertyViolationsTab';
import { PropertyComplaintsTab } from '@/components/properties/detail/PropertyComplaintsTab';
import { PropertyDocumentsTab } from '@/components/properties/detail/PropertyDocumentsTab';
import { PropertyWorkOrdersTab } from '@/components/properties/detail/PropertyWorkOrdersTab';
import { PropertyActivityTab } from '@/components/properties/detail/PropertyActivityTab';
import { PropertyTaxesTab } from '@/components/properties/detail/PropertyTaxesTab';
import { PropertyTenantsTab } from '@/components/properties/detail/PropertyTenantsTab';
import { PropertySettingsTab } from '@/components/properties/PropertySettingsTab';
import { EditPropertyDialog } from '@/components/properties/EditPropertyDialog';

import { getBoroughName } from '@/lib/property-utils';
import { Badge } from '@/components/ui/badge';
import { getAgencyColor, isActiveViolation } from '@/lib/violation-utils';

interface Property {
  id: string;
  address: string;
  jurisdiction: 'NYC' | 'NON_NYC';
  bin: string | null;
  bbl: string | null;
  borough: string | null;
  stories: number | null;
  height_ft: number | null;
  gross_sqft: number | null;
  primary_use_group: string | null;
  dwelling_units: number | null;
  use_type: string | null;
  co_status: string | null;
  co_data: Record<string, unknown> | null;
  applicable_agencies: string[] | null;
  has_gas: boolean | null;
  has_boiler: boolean | null;
  has_elevator: boolean | null;
  has_sprinkler: boolean | null;
  compliance_status: string | null;
  last_synced_at: string | null;
  created_at: string;
  owner_name?: string | null;
  owner_phone?: string | null;
  sms_enabled?: boolean | null;
}

interface Violation {
  id: string;
  agency: string;
  violation_number: string;
  issued_date: string;
  status: string;
  description_raw: string | null;
  cure_due_date: string | null;
  hearing_date: string | null;
  severity: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
  penalty_amount?: number | null;
  respondent_name?: string | null;
  violation_class?: string | null;
  oath_status?: string | null;
  notes?: string | null;
  source?: string | null;
  complaint_category?: string | null;
  disposition_code?: string | null;
  disposition_comments?: string | null;
  priority?: string | null;
  tenant_id?: string | null;
  violation_type?: string | null;
  suppressed?: boolean | null;
  suppression_reason?: string | null;
}

interface WorkOrder {
  id: string;
  scope: string;
  status: string;
  created_at: string;
  linked_violation_id: string | null;
  vendor_id: string | null;
  quoted_amount?: number | null;
  approved_amount?: number | null;
  priority?: string | null;
  due_date?: string | null;
  dispatched_at?: string | null;
}

interface Document {
  id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  file_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
  metadata: Record<string, unknown> | null;
}

const PropertyDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeAppCount, setActiveAppCount] = useState(0);

  const fetchPropertyData = async () => {
    if (!id) return;

    try {
      // Fetch property details
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single();

      if (propertyError) throw propertyError;
      setProperty(propertyData as Property);

      // Fetch related data in parallel
      const [violationsRes, workOrdersRes, documentsRes, applicationsRes] = await Promise.all([
        supabase
          .from('violations')
          .select('*')
          .eq('property_id', id)
          .order('issued_date', { ascending: false }),
        supabase
          .from('work_orders')
          .select('*')
          .eq('property_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('property_documents')
          .select('*')
          .eq('property_id', id)
          .order('uploaded_at', { ascending: false }),
        supabase
          .from('applications')
          .select('status, source, application_number')
          .eq('property_id', id),
      ]);

      if (!violationsRes.error) setViolations(violationsRes.data as Violation[] || []);
      if (!workOrdersRes.error) setWorkOrders(workOrdersRes.data as WorkOrder[] || []);
      if (!documentsRes.error) setDocuments(documentsRes.data as Document[] || []);
      if (!applicationsRes.error) {
        const TERMINAL = ['signed off', 'completed', 'complete', 'co issued', 'letter of completion', 'loc issued', 'signed off / completed', 'cancel', 'cancelled', 'withdrawn', 'filing withdrawn', 'disapproved', 'suspended'];
        const active = (applicationsRes.data || []).filter((a: { status: string | null; source: string; application_number: string }) => {
          const s = (a.status || '').toLowerCase();
          // For BIS single-char codes, decode
          if (a.source === 'DOB BIS' && s.length <= 2) {
            const decoded = ({ h: 'completed', i: 'signed off', j: 'disapproved', k: 'co issued', x: 'signed off / completed', l: 'withdrawn', m: 'disapproved', u: 'completed', '3': 'suspended' } as Record<string, string>)[s] || '';
            return !TERMINAL.some(c => decoded.includes(c));
          }
          // "Approved" only counts as active for initial filings (Doc 01)
          // All amendments (P1, P2, etc.) with Approved status are terminal
          if (s === 'approved') {
            const hasPSuffix = /-P\d+$/i.test(a.application_number);
            if (hasPSuffix) return false;
          }
          return !TERMINAL.some(c => s.includes(c));
        });
        setActiveAppCount(active.length);
      }

    } catch (error) {
      console.error('Error fetching property:', error);
      toast.error('Failed to load property');
      navigate('/dashboard/properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPropertyData();
  }, [id]);

  const syncViolations = async () => {
    if (!property?.bin && !property?.bbl) {
      toast.error('Property needs a BIN or BBL to sync');
      return;
    }

    setIsSyncing(true);

    try {
      // Run building data sync (PLUTO/DOB/E-Designations/LPC) and violation sync in parallel
      const [buildingData, violationResult] = await Promise.all([
        property.jurisdiction === 'NYC' 
          ? syncNYCBuildingDataByIdentifiers(property.bin, property.bbl)
          : Promise.resolve(null),
        supabase.functions.invoke('fetch-nyc-violations', {
          body: { 
            bin: property.bin, 
            bbl: property.bbl,
            property_id: property.id,
            applicable_agencies: property.applicable_agencies || ['DOB', 'ECB', 'HPD', 'FDNY', 'DOT', 'DSNY', 'DEP', 'LPC', 'DOF', 'DOHMH']
          }
        }),
      ]);

      // Save building data if fetched
      if (buildingData) {
        const updateData = toPropertyUpdate(buildingData);
        const { error: updateError } = await supabase
          .from('properties')
          .update(updateData)
          .eq('id', property.id);
        
        if (updateError) {
          console.error('Error saving building data:', updateError);
        }
      }

      if (violationResult.error) throw violationResult.error;

      const data = violationResult.data;
      if (data?.total_found > 0 || data?.new_applications > 0 || buildingData) {
        const parts = [];
        if (buildingData) parts.push('building data');
        if (data?.total_found > 0) parts.push(`${data.total_found} violations`);
        if (data?.applications_found > 0) parts.push(`${data.applications_found} applications`);
        toast.success(`Synced: ${parts.join(', ')}`);
      } else {
        toast.info('No new data found');
      }

      await fetchPropertyData();
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Failed to sync data');
    } finally {
      setIsSyncing(false);
    }
  };

  const getCOStatusDisplay = (status: string | null | undefined) => {
    switch (status) {
      case 'valid':
        return { icon: '🟢', label: 'Valid CO', className: 'bg-success/10 text-success border-success/20' };
      case 'temporary':
        return { icon: '🟡', label: 'Temp CO', className: 'bg-warning/10 text-warning border-warning/20' };
      case 'expired_tco':
        return { icon: '🔴', label: 'Expired TCO', className: 'bg-destructive/10 text-destructive border-destructive/20' };
      case 'missing':
        return { icon: '🔴', label: 'No CO', className: 'bg-destructive/10 text-destructive border-destructive/20' };
      case 'pre_1938':
        return { icon: '🏛️', label: 'Pre-1938', className: 'bg-muted text-muted-foreground border-muted' };
      case 'use_violation':
        return { icon: '🟡', label: 'Use Violation', className: 'bg-warning/10 text-warning border-warning/20' };
      default:
        return { icon: '❔', label: 'Unknown', className: 'bg-muted text-muted-foreground border-muted' };
    }
  };

  // Helper: is this a complaint record?
  const isComplaint = (v: Violation) => v.source === 'dob_complaints' || v.violation_number?.startsWith('COMP-');

  // Critical issues — SWOs and vacate orders should ALWAYS show, even if suppressed
  const criticalIssuesAll = useMemo(() => {
    return violations.filter(v => (v.is_stop_work_order || v.is_vacate_order) && v.status === 'open');
  }, [violations]);

  // Filter to only active violations (excluding complaints and SWO/vacate shown in critical banner) for badge counts
  const activeViolations = useMemo(() => {
    return violations.filter(v => isActiveViolation(v) && !isComplaint(v) && !v.is_stop_work_order && !v.is_vacate_order);
  }, [violations]);

  // Separate complaints from violations
  const complaints = useMemo(() => {
    return violations.filter(v => isComplaint(v) && !v.is_stop_work_order && !v.is_vacate_order);
  }, [violations]);

  // Count violations per agency - only active ones, excluding complaints
  const violationCountsByAgency = useMemo(() => {
    const counts: Record<string, number> = {};
    activeViolations.forEach(v => {
      counts[v.agency] = (counts[v.agency] || 0) + 1;
    });
    return counts;
  }, [activeViolations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold">Property not found</h2>
        <Button variant="outline" onClick={() => navigate('/dashboard/properties')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Properties
        </Button>
      </div>
    );
  }

  const coStatus = getCOStatusDisplay(property.co_status);
  const openViolations = activeViolations.filter(v => v.status === 'open').length;
  const criticalIssues = criticalIssuesAll;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/dashboard/properties')}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {property.address}
                </h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {property.borough && <span>{getBoroughName(property.borough)}</span>}
                  {property.bin && <span>• BIN: {property.bin}</span>}
                  {property.stories && <span>• {property.stories} stories</span>}
                </div>
              </div>
            </div>
            
            {/* Status Badges — violations-first, sorted by count descending */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${coStatus.className}`}>
                <span>{coStatus.icon}</span>
                {coStatus.label}
              </span>
              {[...(property.applicable_agencies || [])]
                .sort((a, b) => {
                  const countA = violationCountsByAgency[a] || 0;
                  const countB = violationCountsByAgency[b] || 0;
                  if (countB !== countA) return countB - countA;
                  return a.localeCompare(b);
                })
                .map((agency) => {
                  const count = violationCountsByAgency[agency] || 0;
                  const hasViolations = count > 0;
                  return (
                    <Badge 
                      key={agency} 
                      variant="outline" 
                      className={`text-xs transition-opacity ${
                        hasViolations 
                          ? getAgencyColor(agency) 
                          : 'bg-muted/30 text-muted-foreground/60 border-border/50'
                      }`}
                    >
                      {agency}
                      {hasViolations && (
                        <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-background/80 text-foreground">
                          {count}
                        </span>
                      )}
                    </Badge>
                  );
                })}
              {property.jurisdiction !== 'NYC' && (
                <Badge variant="secondary">Non-NYC</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setEditDialogOpen(true)}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            {property.last_synced_at && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Synced {formatDistanceToNow(new Date(property.last_synced_at), { addSuffix: true })}
              </span>
            )}
            <Button 
              variant="outline" 
              onClick={syncViolations}
              disabled={isSyncing || !property.bin}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Data'}
            </Button>
          </div>
        </div>
      </div>

      {/* Critical Alerts — Expandable SWO/Vacate Detail Panels */}
      {criticalIssues.length > 0 && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <h3 className="font-semibold text-destructive mb-3">⚠️ Critical Issues</h3>
          <div className="space-y-3">
            {criticalIssues.map((v) => (
              <Collapsible key={v.id}>
                <CollapsibleTrigger className="w-full text-left p-3 rounded-lg bg-destructive/5 border border-destructive/10 hover:bg-destructive/15 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {v.is_stop_work_order && <span className="text-lg">🚨</span>}
                      {v.is_vacate_order && <span className="text-lg">⛔</span>}
                      <span className="text-sm font-semibold text-destructive">
                        {v.is_stop_work_order ? 'Stop Work Order' : 'Vacate Order'}
                        {' '}— {v.agency} #{v.violation_number}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-destructive/60 transition-transform [[data-state=open]>&]:rotate-180" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-4 rounded-lg bg-background border border-destructive/10">
                    {/* Summary Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="text-sm font-medium">
                          {v.description_raw?.toLowerCase().includes('partial') ? 'Partial Stop Work Order' :
                           v.description_raw?.toLowerCase().includes('full') ? 'Full Stop Work Order' :
                           v.is_stop_work_order ? 'Stop Work Order' : 'Vacate Order'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Issued</p>
                        <p className="text-sm font-medium">{v.issued_date ? format(new Date(v.issued_date), 'MMM d, yyyy') : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge variant="outline" className={`text-xs ${v.status === 'open' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                          {v.status === 'open' ? 'Active' : 'Resolved'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Complaint #</p>
                        <p className="text-sm font-medium">{v.violation_number?.replace('COMP-', '')}</p>
                      </div>
                    </div>

                    {/* Description */}
                    {v.description_raw && (
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-1">Description</p>
                        <p className="text-sm">{v.description_raw}</p>
                      </div>
                    )}

                    {/* What This Means */}
                    <div className="mb-4 p-3 rounded-lg bg-muted/50">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">What This Means</p>
                      <p className="text-sm text-muted-foreground">
                        {v.is_stop_work_order && 'A Stop Work Order (SWO) means all construction activity at this property must cease immediately. Continuing work while an SWO is active can result in additional violations, criminal summonses, and fines up to $25,000. The SWO must be rescinded by DOB before any work can resume.'}
                        {v.is_vacate_order && 'A Vacate Order requires all occupants to leave the building immediately due to unsafe conditions. The building cannot be reoccupied until DOB rescinds the order after conditions are corrected.'}
                      </p>
                    </div>

                    {/* Recommended Actions */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Recommended Actions</p>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Contact your expeditor or licensed professional immediately</li>
                        <li>Do NOT continue any construction work</li>
                        <li>File for SWO rescission with DOB once conditions are corrected</li>
                        <li>Obtain required permits before resuming work</li>
                      </ul>
                    </div>

                    {/* Penalty & Deadline */}
                    {(v.penalty_amount || v.cure_due_date) && (
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                        {v.penalty_amount && v.penalty_amount > 0 && (
                          <span className="text-destructive font-medium">Penalty: ${v.penalty_amount.toLocaleString()}</span>
                        )}
                        {v.cure_due_date && (
                          <span className="text-warning font-medium">Cure by: {format(new Date(v.cure_due_date), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex gap-1 h-auto p-1 w-auto min-w-full md:flex md:flex-wrap md:w-full md:max-w-5xl">
            <TabsTrigger value="overview" className="whitespace-nowrap text-xs md:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="violations" className="whitespace-nowrap text-xs md:text-sm">
              Violations {openViolations > 0 && `(${openViolations})`}
            </TabsTrigger>
            <TabsTrigger value="complaints" className="whitespace-nowrap text-xs md:text-sm">
              Complaints {complaints.filter(c => c.status === 'open').length > 0 && `(${complaints.filter(c => c.status === 'open').length})`}
            </TabsTrigger>
            <TabsTrigger value="applications" className="whitespace-nowrap text-xs md:text-sm">
              Applications {activeAppCount > 0 && `(${activeAppCount})`}
            </TabsTrigger>
            <TabsTrigger value="tenants" className="whitespace-nowrap text-xs md:text-sm">Tenants</TabsTrigger>
            <TabsTrigger value="documents" className="whitespace-nowrap text-xs md:text-sm">
              Docs {documents.length > 0 && `(${documents.length})`}
            </TabsTrigger>
            <TabsTrigger value="work-orders" className="whitespace-nowrap text-xs md:text-sm">
              Work Orders {workOrders.length > 0 && `(${workOrders.length})`}
            </TabsTrigger>
            <TabsTrigger value="taxes" className="whitespace-nowrap text-xs md:text-sm">Taxes</TabsTrigger>
            <TabsTrigger value="activity" className="whitespace-nowrap text-xs md:text-sm">Activity</TabsTrigger>
            <TabsTrigger value="settings" className="whitespace-nowrap text-xs md:text-sm">Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-6">
          <PropertyOverviewTab 
            property={property} 
            violations={violations}
            documents={documents}
            workOrders={workOrders}
            onTabChange={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="violations" className="mt-6">
          <PropertyViolationsTab 
            violations={violations} 
            onRefresh={fetchPropertyData}
            bbl={property.bbl}
            propertyId={property.id}
            propertyAddress={property.address}
          />
        </TabsContent>

        <TabsContent value="complaints" className="mt-6">
          <PropertyComplaintsTab complaints={complaints} />
        </TabsContent>

        <TabsContent value="applications" className="mt-6">
          <PropertyApplicationsTab propertyId={property.id} />
        </TabsContent>

        <TabsContent value="tenants" className="mt-6">
          <PropertyTenantsTab propertyId={property.id} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <PropertyDocumentsTab 
            propertyId={property.id}
            documents={documents}
            onRefresh={fetchPropertyData}
          />
        </TabsContent>

        <TabsContent value="work-orders" className="mt-6">
          <PropertyWorkOrdersTab 
            propertyId={property.id}
            workOrders={workOrders}
            violations={violations}
            onRefresh={fetchPropertyData}
          />
        </TabsContent>

        <TabsContent value="taxes" className="mt-6">
          <PropertyTaxesTab propertyId={property.id} />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <PropertyActivityTab propertyId={property.id} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <PropertySettingsTab
            propertyId={property.id}
            ownerName={property.owner_name ?? null}
            ownerPhone={property.owner_phone ?? null}
            smsEnabled={property.sms_enabled ?? null}
            hasGas={property.has_gas ?? null}
            hasBoiler={property.has_boiler ?? null}
            hasElevator={property.has_elevator ?? null}
            hasSprinkler={property.has_sprinkler ?? null}
            hasRetainingWall={(property as any).has_retaining_wall ?? null}
            hasParkingStructure={(property as any).has_parking_structure ?? null}
            hasCoolingTower={(property as any).has_cooling_tower ?? null}
            hasWaterTank={(property as any).has_water_tank ?? null}
            hasFireAlarm={(property as any).has_fire_alarm ?? null}
            hasStandpipe={(property as any).has_standpipe ?? null}
            hasPlaceOfAssembly={(property as any).has_place_of_assembly ?? null}
            isFoodEstablishment={(property as any).is_food_establishment ?? null}
            hasBackflowDevice={(property as any).has_backflow_device ?? null}
            burnsNo4Oil={(property as any).burns_no4_oil ?? null}
            applicableAgencies={property.applicable_agencies}
            onUpdate={fetchPropertyData}
          />
        </TabsContent>
      </Tabs>


      {/* Edit Property Dialog */}
      <EditPropertyDialog
        property={property}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={fetchPropertyData}
      />
    </div>
  );
};

export default PropertyDetailPage;
