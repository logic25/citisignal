import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, AlertTriangle, ClipboardList, ExternalLink, ShieldCheck } from 'lucide-react';
import { isActiveViolation, getAgencyColor } from '@/lib/violation-utils';
import { usePortfolioScores } from '@/hooks/useComplianceScore';

interface Property {
  id: string;
  address: string;
  borough: string | null;
  stories: number | null;
  portfolio_id: string | null;
  bbl: string | null;
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
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
  property_id: string;
  oath_status?: string | null;
  violation_class?: string | null;
  suppressed?: boolean | null;
}

interface PortfolioOverviewTabProps {
  properties: Property[];
  violations: Violation[];
  workOrderCount: number;
}

const AGENCY_CHART_COLORS: Record<string, string> = {
  DOB: '#f97316',
  ECB: '#3b82f6',
  HPD: '#a855f7',
  FDNY: '#ef4444',
  DEP: '#06b6d4',
  DOT: '#eab308',
  DSNY: '#22c55e',
  LPC: '#ec4899',
  DOF: '#6366f1',
};

const getGradeColor = (grade: string) => {
  switch (grade) {
    case 'A': return 'text-success';
    case 'B': return 'text-primary';
    case 'C': return 'text-warning';
    case 'D': return 'text-accent';
    default: return 'text-destructive';
  }
};

const getGradeBg = (grade: string) => {
  switch (grade) {
    case 'A': return 'bg-success/10 border-success/30';
    case 'B': return 'bg-primary/10 border-primary/30';
    case 'C': return 'bg-warning/10 border-warning/30';
    case 'D': return 'bg-accent/10 border-accent/30';
    default: return 'bg-destructive/10 border-destructive/30';
  }
};

export const PortfolioOverviewTab = ({ properties, violations, workOrderCount }: PortfolioOverviewTabProps) => {
  const navigate = useNavigate();
  const { scores } = usePortfolioScores();

  const activeViolations = useMemo(() => violations.filter(isActiveViolation), [violations]);

  const agencyData = useMemo(() => {
    const counts: Record<string, number> = {};
    activeViolations.forEach(v => {
      counts[v.agency] = (counts[v.agency] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([agency, count]) => ({ name: agency, value: count, color: AGENCY_CHART_COLORS[agency] || '#94a3b8' }))
      .sort((a, b) => b.value - a.value);
  }, [activeViolations]);

  const averageScore = useMemo(() => {
    const propertyIds = new Set(properties.map(p => p.id));
    const relevant = scores.filter(s => propertyIds.has(s.property_id));
    if (relevant.length === 0) return null;
    return Math.round(relevant.reduce((sum, s) => sum + s.score, 0) / relevant.length);
  }, [scores, properties]);

  const averageGrade = averageScore !== null
    ? averageScore >= 90 ? 'A' : averageScore >= 80 ? 'B' : averageScore >= 70 ? 'C' : averageScore >= 60 ? 'D' : 'F'
    : null;

  const getPropertyScore = (propertyId: string) => scores.find(s => s.property_id === propertyId);
  const getPropertyViolationCount = (propertyId: string) => activeViolations.filter(v => v.property_id === propertyId).length;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Properties</span>
          </div>
          <p className="text-2xl font-display font-bold text-foreground">{properties.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <span className="text-sm text-muted-foreground">Active Violations</span>
          </div>
          <p className="text-2xl font-display font-bold text-foreground">{activeViolations.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-info" />
            </div>
            <span className="text-sm text-muted-foreground">Avg Compliance</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-display font-bold text-foreground">{averageScore ?? '—'}</p>
            {averageGrade && (
              <span className={`text-lg font-display font-bold ${getGradeColor(averageGrade)}`}>{averageGrade}</span>
            )}
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-warning" />
            </div>
            <span className="text-sm text-muted-foreground">Pending Work Orders</span>
          </div>
          <p className="text-2xl font-display font-bold text-foreground">{workOrderCount}</p>
        </div>
      </div>

      {/* Donut Chart */}
      {agencyData.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground mb-4">
            Violations by Agency
          </h3>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-48 h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={agencyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {agencyData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${value} violations`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-display font-bold text-foreground">{activeViolations.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {agencyData.map(({ name, value, color }) => (
                <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary/30">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium text-foreground">{name}</span>
                  <span className="text-sm font-bold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Property Compliance Cards */}
      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground mb-4">
          Property Compliance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(property => {
            const score = getPropertyScore(property.id);
            const violationCount = getPropertyViolationCount(property.id);
            const grade = score?.grade || '—';

            return (
              <div
                key={property.id}
                className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground truncate">{property.address}</h4>
                    <p className="text-sm text-muted-foreground">{property.borough || 'NYC'}</p>
                  </div>
                  {score && (
                    <div className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center ${getGradeBg(grade)}`}>
                      <span className={`text-xl font-display font-bold ${getGradeColor(grade)}`}>{grade}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  {violationCount > 0 ? (
                    <Badge variant="destructive" className="text-xs">{violationCount} active violation{violationCount !== 1 ? 's' : ''}</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">No violations</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/dashboard/properties/${property.id}`)}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
