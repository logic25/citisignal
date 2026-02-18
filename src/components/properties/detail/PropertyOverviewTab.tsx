import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useComplianceScore } from '@/hooks/useComplianceScore';
import { ComplianceScoreCard } from '@/components/dashboard/ComplianceScoreCard';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, 
  FileText, 
  Wrench, 
  Calendar,
  Building2,
  Flame,
  Droplets,
  Cog,
  Shield,
  User,
  Ruler,
  Layers,
  Home,
  Landmark,
  Scale,
  RefreshCw,
  MapPin,
  GraduationCap
} from 'lucide-react';
import { getBoroughName } from '@/lib/property-utils';
import { isActiveViolation } from '@/lib/violation-utils';
import { PropertyAIWidget } from '@/components/properties/PropertyAIWidget';
import { LocalLawComplianceGrid } from '@/components/properties/detail/LocalLawComplianceGrid';

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
  owner_name?: string | null;
  
  // Zoning
  zoning_district?: string | null;
  zoning_district_2?: string | null;
  zoning_district_3?: string | null;
  zoning_map?: string | null;
  overlay_district?: string | null;
  special_district?: string | null;
  commercial_overlay?: string | null;
  split_zone?: boolean | null;
  limited_height_district?: string | null;
  lot_area_sqft?: number | null;
  building_area_sqft?: number | null;
  residential_area_sqft?: number | null;
  commercial_area_sqft?: number | null;
  floor_area_ratio?: number | null;
  max_floor_area_ratio?: number | null;
  air_rights_sqft?: number | null;
  unused_far?: number | null;
  
  // Lot dimensions
  lot_frontage?: number | null;
  lot_depth?: number | null;

  building_class?: string | null;
  occupancy_group?: string | null;
  year_built?: number | null;
  land_use?: string | null;
  total_units?: number | null;
  
  // Location / Neighborhood
  community_board?: string | null;
  council_district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  school_district?: string | null;
  police_precinct?: string | null;
  fire_company?: string | null;
  sanitation_borough?: string | null;
  sanitation_subsection?: string | null;
  
  // Landmark
  is_landmark?: boolean | null;
  landmark_status?: string | null;
  historic_district?: string | null;
  
  // Restrictions
  loft_law?: boolean | null;
  is_city_owned?: boolean | null;
  professional_cert_restricted?: boolean | null;
  legal_adult_use?: boolean | null;
  hpd_multiple_dwelling?: boolean | null;
  environmental_restrictions?: string | null;
  
  assessed_land_value?: number | null;
  assessed_total_value?: number | null;
  number_of_buildings?: number | null;
}

interface Violation {
  id: string;
  status: string;
  oath_status?: string | null;
  cure_due_date: string | null;
  hearing_date: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
}

interface Document {
  id: string;
  document_type: string;
}

interface WorkOrder {
  id: string;
  status: string;
}

interface PropertyOverviewTabProps {
  property: Property;
  violations: Violation[];
  documents: Document[];
  workOrders: WorkOrder[];
  onTabChange?: (tab: string) => void;
}

const LAND_USE_LABELS: Record<string, string> = {
  '01': 'One & Two Family',
  '02': 'Multi-Family Walk-Up',
  '03': 'Multi-Family Elevator',
  '04': 'Mixed Residential & Commercial',
  '05': 'Commercial & Office',
  '06': 'Industrial & Manufacturing',
  '07': 'Transportation & Utility',
  '08': 'Public Facilities & Institutions',
  '09': 'Open Space & Recreation',
  '10': 'Parking Facilities',
  '11': 'Vacant Land',
};

export const PropertyOverviewTab = ({ 
  property, 
  violations, 
  documents, 
  workOrders,
  onTabChange 
}: PropertyOverviewTabProps) => {
  const { score: complianceData, isLoading: scoreLoading, recalculate } = useComplianceScore(property.id);

  useEffect(() => {
    if (!scoreLoading && !complianceData && property.id) {
      recalculate();
    }
  }, [scoreLoading, complianceData, property.id, recalculate]);
  
  const activeViolations = violations.filter(isActiveViolation);
  const openViolations = activeViolations.filter(v => v.status === 'open').length;
  const inProgressViolations = activeViolations.filter(v => v.status === 'in_progress').length;
  const activeWorkOrders = workOrders.filter(w => w.status !== 'completed').length;

  const upcomingDeadlines = activeViolations
    .filter(v => v.cure_due_date && new Date(v.cure_due_date) > new Date())
    .sort((a, b) => new Date(a.cure_due_date!).getTime() - new Date(b.cure_due_date!).getTime());
  
  const nextDeadline = upcomingDeadlines[0];
  const daysUntilDeadline = nextDeadline 
    ? Math.ceil((new Date(nextDeadline.cure_due_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const criticalIssues = activeViolations.filter(v => v.is_stop_work_order || v.is_vacate_order).length;
  const complianceScore = complianceData?.score ?? Math.max(0, 100 - (openViolations * 5) - (criticalIssues * 25));

  const getCOStatusBadge = (status: string | null | undefined) => {
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

  const coStatus = getCOStatusBadge(property.co_status);

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined || num === 0) return '-';
    return num.toLocaleString();
  };

  const hasNeighborhoodData = property.school_district || property.police_precinct || property.fire_company || property.sanitation_borough;

  return (
    <div className="space-y-4">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card 
          className="cursor-pointer hover:border-destructive/50 transition-colors"
          onClick={() => onTabChange?.('violations')}
        >
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-xl font-bold">{openViolations}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-orange-500/50 transition-colors"
          onClick={() => onTabChange?.('violations')}
        >
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{inProgressViolations}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-warning/50 transition-colors"
          onClick={() => onTabChange?.('violations')}
        >
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {daysUntilDeadline !== null ? `${daysUntilDeadline}d` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">Next Deadline</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-blue-500/50 transition-colors"
          onClick={() => onTabChange?.('work-orders')}
        >
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{activeWorkOrders}</p>
                <p className="text-xs text-muted-foreground">Work Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onTabChange?.('docs')}
        >
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{documents.length}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Synced */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <RefreshCw className="w-3 h-3" />
        <span>
          Last synced: {property.last_synced_at 
            ? new Date(property.last_synced_at).toLocaleString()
            : 'Never'}
        </span>
      </div>

      {/* Building Details */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Building Details
            </CardTitle>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${coStatus.className}`}>
              <span>{coStatus.icon}</span>
              {coStatus.label}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* Core Building Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Owner / Entity</p>
                <p className="font-medium text-sm">{property.owner_name || 'Not specified'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Year Built</p>
                <p className="font-medium text-sm">{property.year_built || '-'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Building Class</p>
                <p className="font-medium text-sm">{property.building_class || '-'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Home className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Land Use</p>
                <p className="font-medium text-sm">
                  {property.land_use 
                    ? (LAND_USE_LABELS[property.land_use] || property.land_use) 
                    : (property.occupancy_group || property.primary_use_group || '-')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Stories</p>
                <p className="font-medium text-sm">{property.stories && property.stories > 0 ? property.stories : '-'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Ruler className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Height</p>
                <p className="font-medium text-sm">{property.height_ft && property.height_ft > 0 ? `${property.height_ft} ft` : '-'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Layers className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Gross SF</p>
                <p className="font-medium text-sm">{property.gross_sqft && property.gross_sqft > 0 ? `${property.gross_sqft.toLocaleString()} sf` : '-'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Home className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Units (Res / Total)</p>
                <p className="font-medium text-sm">
                  {property.dwelling_units && property.dwelling_units > 0 ? property.dwelling_units : '-'}
                  {property.total_units && property.total_units > 0 && property.total_units !== property.dwelling_units 
                    ? ` / ${property.total_units}` : ''}
                </p>
              </div>
            </div>
            {/* Lot dimensions */}
            {(property.lot_frontage || property.lot_depth) && (
              <div className="flex items-start gap-2">
                <Ruler className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Lot (Front × Depth)</p>
                  <p className="font-medium text-sm">
                    {property.lot_frontage ? `${property.lot_frontage}'` : '-'} × {property.lot_depth ? `${property.lot_depth}'` : '-'}
                  </p>
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">BIN</p>
              <p className="font-medium text-sm font-mono">{property.bin || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Borough / Block / Lot</p>
              <p className="font-medium text-sm font-mono">
                {property.bbl ? (
                  <>
                    {getBoroughName(property.bbl.charAt(0))} / {property.bbl.substring(1, 6).replace(/^0+/, '')} / {property.bbl.substring(6, 10).replace(/^0+/, '')}
                  </>
                ) : '-'}
              </p>
            </div>
          </div>

          {/* Zoning & Area */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" /> Zoning & Area
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Zoning District</p>
                <p className="font-medium">
                  {property.zoning_district || '-'}
                  {property.zoning_district_2 ? ` / ${property.zoning_district_2}` : ''}
                  {property.zoning_district_3 ? ` / ${property.zoning_district_3}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Zoning Map</p>
                <p className="font-medium">{property.zoning_map || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Overlay District</p>
                <p className="font-medium">{property.overlay_district || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Special District</p>
                <p className="font-medium">{property.special_district || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Commercial Overlay</p>
                <p className="font-medium">{property.commercial_overlay || '-'}</p>
              </div>
              {property.limited_height_district && (
                <div>
                  <p className="text-xs text-muted-foreground">Limited Height</p>
                  <p className="font-medium">{property.limited_height_district}</p>
                </div>
              )}
              {property.split_zone && (
                <div>
                  <p className="text-xs text-muted-foreground">Split Zone</p>
                  <p className="font-medium">Yes</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Lot Area</p>
                <p className="font-medium">{formatNumber(property.lot_area_sqft)} sf</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Building Area</p>
                <p className="font-medium">{formatNumber(property.building_area_sqft || property.gross_sqft)} sf</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Built FAR / Max FAR</p>
                <p className="font-medium">
                  {property.floor_area_ratio?.toFixed(2) || '-'} / {property.max_floor_area_ratio?.toFixed(2) || '-'}
                </p>
              </div>
              {property.air_rights_sqft && property.air_rights_sqft > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Unused Air Rights</p>
                  <p className="font-medium">{formatNumber(property.air_rights_sqft)} sf</p>
                </div>
              )}
            </div>
          </div>

          {/* Neighborhood Information */}
          {hasNeighborhoodData && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Neighborhood
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                {property.community_board && (
                  <div>
                    <p className="text-xs text-muted-foreground">Community District</p>
                    <p className="font-medium">{property.community_board}</p>
                  </div>
                )}
                {property.council_district && (
                  <div>
                    <p className="text-xs text-muted-foreground">Council District</p>
                    <p className="font-medium">{property.council_district}</p>
                  </div>
                )}
                {property.school_district && (
                  <div>
                    <p className="text-xs text-muted-foreground">School District</p>
                    <p className="font-medium">{property.school_district}</p>
                  </div>
                )}
                {property.police_precinct && (
                  <div>
                    <p className="text-xs text-muted-foreground">Police Precinct</p>
                    <p className="font-medium">{property.police_precinct}</p>
                  </div>
                )}
                {property.fire_company && (
                  <div>
                    <p className="text-xs text-muted-foreground">Fire Company</p>
                    <p className="font-medium">{property.fire_company}</p>
                  </div>
                )}
                {(property.sanitation_borough || property.sanitation_subsection) && (
                  <div>
                    <p className="text-xs text-muted-foreground">Sanitation</p>
                    <p className="font-medium">
                      {[property.sanitation_borough, property.sanitation_subsection].filter(Boolean).join(' / ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status & Restrictions */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5" /> Status & Restrictions
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Landmark Status</p>
                <p className="font-medium">{property.landmark_status || (property.is_landmark ? 'Landmark' : 'Not Landmarked')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Historic District</p>
                <p className="font-medium">{property.historic_district || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">City Owned</p>
                <p className="font-medium">{property.is_city_owned ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Loft Law</p>
                <p className="font-medium">{property.loft_law ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Legal Adult Use</p>
                <p className="font-medium">{property.legal_adult_use ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">HPD Multiple Dwelling</p>
                <p className="font-medium">{property.hpd_multiple_dwelling ? 'Yes' : 'No'}</p>
              </div>
              {property.environmental_restrictions && (
                <div className="col-span-2 md:col-span-4">
                  <p className="text-xs text-muted-foreground">Environmental Restrictions (E-Designation)</p>
                  <p className="font-medium text-xs">{property.environmental_restrictions}</p>
                </div>
              )}
            </div>
          </div>

          {/* Building Features — badge row */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium mb-1.5">Building Features</p>
            <div className="flex flex-wrap items-center gap-2">
              {property.has_gas && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Flame className="w-3 h-3" /> Gas
                </Badge>
              )}
              {property.has_boiler && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Droplets className="w-3 h-3" /> Boiler
                </Badge>
              )}
              {property.has_elevator && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Cog className="w-3 h-3" /> Elevator
                </Badge>
              )}
              {property.has_sprinkler && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Shield className="w-3 h-3" /> Sprinkler
                </Badge>
              )}
              {!property.has_gas && !property.has_boiler && !property.has_elevator && !property.has_sprinkler && (
                <span className="text-xs text-muted-foreground">None specified</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Score + Local Law Grid */}
      <div id="local-law-compliance" className="space-y-4">
        {complianceData ? (
          <ComplianceScoreCard
            score={complianceData.score}
            grade={complianceData.grade}
            violationScore={complianceData.violation_score}
            complianceScore={complianceData.compliance_score}
            resolutionScore={complianceData.resolution_score}
            violationDetails={complianceData.violation_details}
            complianceDetails={complianceData.compliance_details}
            resolutionDetails={complianceData.resolution_details}
            calculatedAt={complianceData.calculated_at}
            onRecalculate={recalculate}
          />
        ) : (
          <div className="bg-card rounded-xl border border-border p-5 shadow-card animate-pulse h-64" />
        )}
        <LocalLawComplianceGrid property={property} />
      </div>

      {/* Property AI Widget */}
      <PropertyAIWidget 
        propertyId={property.id}
        propertyData={{
          address: property.address,
          borough: property.borough,
          bin: property.bin,
          bbl: property.bbl,
          stories: property.stories,
          dwelling_units: property.dwelling_units,
          year_built: property.year_built,
          zoning_district: property.zoning_district,
          building_class: property.building_class,
          co_status: property.co_status,
        }}
        violations={violations}
        documents={documents}
        workOrders={workOrders}
      />
    </div>
  );
};
