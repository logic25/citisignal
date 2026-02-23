import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface TopPropertiesCardProps {
  properties: Array<{
    id: string;
    address: string;
    violationCount: number;
    grade: string | null;
  }>;
}

const getGradeColor = (grade: string | null) => {
  if (!grade) return 'text-muted-foreground';
  switch (grade) {
    case 'A': return 'text-success';
    case 'B': return 'text-primary';
    case 'C': return 'text-warning';
    case 'D': return 'text-accent';
    default: return 'text-destructive';
  }
};

const TopPropertiesCard = ({ properties }: TopPropertiesCardProps) => {
  if (properties.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
              Properties Requiring Attention
            </h3>
            <p className="text-xs text-muted-foreground">Top 5 by active violations</p>
          </div>
        </div>
        <Link to="/dashboard/properties" className="text-xs font-medium text-accent hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {properties.map((prop, i) => (
          <Link
            key={prop.id}
            to={`/dashboard/properties/${prop.id}`}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-mono text-muted-foreground w-5">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{prop.address}</p>
            </div>
            <Badge variant="destructive" className="text-xs shrink-0">
              {prop.violationCount} violations
            </Badge>
            {prop.grade && (
              <span className={`text-lg font-display font-bold w-8 text-center ${getGradeColor(prop.grade)}`}>
                {prop.grade}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default TopPropertiesCard;
