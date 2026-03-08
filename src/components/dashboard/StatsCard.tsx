import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'warning' | 'success' | 'danger';
  compact?: boolean;
}

const StatsCard = ({ title, value, subtitle, icon: Icon, trend, variant = 'default', compact = false }: StatsCardProps) => {
  const iconColors = {
    default: 'text-primary bg-primary/10',
    warning: 'text-warning bg-warning/10',
    success: 'text-success bg-success/10',
    danger: 'text-destructive bg-destructive/10',
  };

  if (compact) {
    return (
      <div className="bg-card rounded-xl border border-border p-3 md:p-4 shadow-card">
        <div className="flex items-center gap-2 md:gap-3 mb-1.5 md:mb-2">
          <div className={cn("w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center", iconColors[variant])}>
            <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </div>
          {trend && (
            <span className={cn(
              "text-xs font-medium px-1.5 py-0.5 rounded-full ml-auto",
              trend.isPositive ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
          )}
        </div>
        <p className="text-[10px] md:text-xs font-medium text-muted-foreground mb-0.5">{title}</p>
        <p className="text-xl md:text-2xl font-display font-bold text-foreground tabular-nums truncate">{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", iconColors[variant])}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className={cn(
            "text-sm font-medium px-2 py-0.5 rounded-full",
            trend.isPositive ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
          )}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
      <p className="text-3xl font-display font-bold text-foreground tabular-nums">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
};

export default StatsCard;
