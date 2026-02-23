import { useMemo } from 'react';
import { MapPin } from 'lucide-react';

interface BoroughHeatmapProps {
  properties: Array<{ borough: string | null }>;
  violations: Array<{ property_id: string }>;
  propertyBoroughMap: Record<string, string | null>;
}

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Bronx', 'Queens', 'Staten Island'];

const BoroughHeatmap = ({ properties, violations, propertyBoroughMap }: BoroughHeatmapProps) => {
  const boroughData = useMemo(() => {
    const data = BOROUGHS.map(borough => {
      const propCount = properties.filter(p => {
        const b = (p.borough || '').toUpperCase();
        return b === borough.toUpperCase() || 
          (borough === 'Manhattan' && b === 'MANHATTAN') ||
          (borough === 'Staten Island' && (b === 'STATEN ISLAND' || b === 'STATEN IS'));
      }).length;

      const violationCount = Object.entries(propertyBoroughMap)
        .filter(([_, b]) => {
          const bn = (b || '').toUpperCase();
          return bn === borough.toUpperCase() || 
            (borough === 'Manhattan' && bn === 'MANHATTAN') ||
            (borough === 'Staten Island' && (bn === 'STATEN ISLAND' || bn === 'STATEN IS'));
        })
        .reduce((sum, [propId]) => {
          return sum + violations.filter(v => v.property_id === propId).length;
        }, 0);

      return { borough, properties: propCount, violations: violationCount };
    });
    return data;
  }, [properties, violations, propertyBoroughMap]);

  const maxViolations = Math.max(...boroughData.map(d => d.violations), 1);

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-muted/50 border-border';
    const ratio = count / maxViolations;
    if (ratio > 0.7) return 'bg-destructive/15 border-destructive/30';
    if (ratio > 0.3) return 'bg-warning/15 border-warning/30';
    return 'bg-info/10 border-info/30';
  };

  const hasData = boroughData.some(b => b.properties > 0);
  if (!hasData) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-info" />
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
            Property Distribution
          </h3>
          <p className="text-xs text-muted-foreground">Properties and violations by borough</p>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {boroughData.map(({ borough, properties: propCount, violations: vCount }) => (
          <div
            key={borough}
            className={`rounded-xl border p-4 text-center transition-colors ${getIntensity(vCount)}`}
          >
            <p className="text-xs font-medium text-muted-foreground mb-1 truncate">{borough}</p>
            <p className="text-xl font-display font-bold text-foreground">{propCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">properties</p>
            {vCount > 0 && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-sm font-bold text-destructive">{vCount}</p>
                <p className="text-[10px] text-muted-foreground">violations</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BoroughHeatmap;
