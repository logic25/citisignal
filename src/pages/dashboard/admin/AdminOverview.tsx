import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, Users, Building2, AlertTriangle, UserPlus, Ticket, ExternalLink } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';

export default function AdminOverview() {
  const [, setSearchParams] = useSearchParams();

  // API health summary (last 24h)
  const { data: apiHealth, dataUpdatedAt } = useQuery({
    queryKey: ['admin-api-health'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('api_call_logs')
        .select('endpoint, status_code, response_time_ms')
        .gte('created_at', since);
      if (error) throw error;

      const endpoints: Record<string, { total: number; errors: number; avgMs: number }> = {};
      for (const row of data || []) {
        if (!endpoints[row.endpoint]) endpoints[row.endpoint] = { total: 0, errors: 0, avgMs: 0 };
        const e = endpoints[row.endpoint];
        e.total++;
        if (!row.status_code || row.status_code >= 400) e.errors++;
        e.avgMs += row.response_time_ms || 0;
      }
      for (const key of Object.keys(endpoints)) {
        endpoints[key].avgMs = Math.round(endpoints[key].avgMs / endpoints[key].total);
      }
      return endpoints;
    },
    refetchInterval: 30_000,
  });

  // User count
  const { data: userCount } = useQuery({
    queryKey: ['admin-user-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // New users last 7 days
  const { data: newUsersCount } = useQuery({
    queryKey: ['admin-new-users-7d'],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since);
      if (error) throw error;
      return count || 0;
    },
  });

  // Property count
  const { data: propertyCount } = useQuery({
    queryKey: ['admin-property-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Active violations
  const { data: violationCount } = useQuery({
    queryKey: ['admin-violation-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('violations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      if (error) throw error;
      return count || 0;
    },
  });

  // Active invite codes
  const { data: activeCodesCount } = useQuery({
    queryKey: ['admin-active-invite-codes'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('invite_codes')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return count || 0;
    },
  });

  // Properties with open violations
  const { data: propertiesWithViolations } = useQuery({
    queryKey: ['admin-properties-with-violations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('violations')
        .select('property_id')
        .eq('status', 'open');
      if (error) throw error;
      const unique = new Set((data || []).map((v) => v.property_id));
      return unique.size;
    },
  });

  const getHealthColor = (errors: number, total: number) => {
    const rate = total > 0 ? errors / total : 0;
    if (rate === 0) return 'bg-green-500';
    if (rate < 0.1) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const endpointDescriptions: Record<string, string> = {
    PLUTO: 'Property/zoning data from NYC\'s Primary Land Use Tax Output. Used to sync lot size, building class, and zoning info.',
    DOB_JOBS: 'Department of Buildings permit applications — used to track active construction and alteration work on your properties.',
    ECB: 'Environmental Control Board violations — fines and penalties issued for building code infractions.',
    OATH: 'Office of Administrative Trials and Hearings — tracks hearing outcomes and adjudicated penalty amounts.',
    PAD: 'Property Address Directory — used to resolve and normalize NYC addresses to their BIN/BBL identifiers.',
    DOB_VIOLATIONS: 'Department of Buildings violations — structural and safety violations issued against a property.',
  };

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Overview</h1>
        <p className="text-muted-foreground">System health and user statistics</p>
      </div>

      {/* Row 1: Core stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{userCount ?? '—'}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{propertyCount ?? '—'}</p>
                <p className="text-sm text-muted-foreground">Total Properties</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{violationCount ?? '—'}</p>
                <p className="text-sm text-muted-foreground">Open Violations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Growth & activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-default">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{newUsersCount ?? '—'}</p>
                    <p className="text-sm text-muted-foreground">New Users (7 days)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>How many accounts were created in the last 7 days — a measure of platform growth.</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-default">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Ticket className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{activeCodesCount ?? '—'}</p>
                    <p className="text-sm text-muted-foreground">Active Invite Codes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>Invite codes that are currently enabled and available to use for sign-up.</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-default">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-warning" />
                  <div>
                    <p className="text-2xl font-bold">{propertiesWithViolations ?? '—'}</p>
                    <p className="text-sm text-muted-foreground">Properties with Violations</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>Number of distinct properties that have at least one open violation.</TooltipContent>
        </Tooltip>
      </div>

      {/* API Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              NYC Open Data API Health (24h)
            </CardTitle>
            <button
              onClick={() => setSearchParams({ tab: 'api-logs' })}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View Full Logs <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {!apiHealth || Object.keys(apiHealth).length === 0 ? (
            <p className="text-muted-foreground text-sm">No API calls logged yet. Calls will appear here once properties are synced.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(apiHealth).map(([endpoint, stats]) => (
                  <div key={endpoint} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger>
                          <div className={`w-3 h-3 rounded-full ${getHealthColor(stats.errors, stats.total)}`} />
                        </TooltipTrigger>
                        <TooltipContent>Green = 0% error rate, Yellow = under 10% errors, Red = over 10% errors in the last 24 hours.</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="font-medium text-sm cursor-default underline decoration-dotted underline-offset-2">{endpoint}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{endpointDescriptions[endpoint] ?? `NYC Open Data endpoint: ${endpoint}`}</TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{stats.total} calls</Badge>
                      {stats.errors > 0 && (
                        <Badge variant="destructive" className="text-xs">{stats.errors} err</Badge>
                      )}
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-xs text-muted-foreground cursor-default">{stats.avgMs}ms</span>
                        </TooltipTrigger>
                        <TooltipContent>Average response time from NYC Open Data in milliseconds. Under 500ms is healthy.</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
              {dataUpdatedAt > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  Last updated: {format(new Date(dataUpdatedAt), 'MMM d, HH:mm:ss')}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}

