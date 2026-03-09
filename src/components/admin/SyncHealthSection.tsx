import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface SyncLogRow {
  endpoint_name: string;
  status: string;
  result_count: number;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
  property_id: string | null;
}

interface EndpointStats {
  total: number;
  success: number;
  empty: number;
  errors: number;
  timeouts: number;
  avgMs: number;
}

export default function SyncHealthSection() {
  const { data: syncHealth, dataUpdatedAt } = useQuery({
    queryKey: ['admin-sync-health'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('sync_health_logs')
        .select('endpoint_name, status, result_count, response_time_ms, error_message, created_at, property_id')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);
      return (data || []) as SyncLogRow[];
    },
    refetchInterval: 30_000,
  });

  if (!syncHealth) return null;

  // Aggregate by endpoint
  const endpointMap: Record<string, EndpointStats> = {};
  for (const row of syncHealth) {
    if (!endpointMap[row.endpoint_name]) {
      endpointMap[row.endpoint_name] = { total: 0, success: 0, empty: 0, errors: 0, timeouts: 0, avgMs: 0 };
    }
    const e = endpointMap[row.endpoint_name];
    e.total++;
    if (row.status === 'success') e.success++;
    else if (row.status === 'empty') e.empty++;
    else if (row.status === 'error') e.errors++;
    else if (row.status === 'timeout') e.timeouts++;
    e.avgMs += row.response_time_ms || 0;
  }
  for (const key of Object.keys(endpointMap)) {
    const e = endpointMap[key];
    e.avgMs = e.total > 0 ? Math.round(e.avgMs / e.total) : 0;
  }

  // Detect unhealthy endpoints
  const alerts: { endpoint: string; reason: string }[] = [];
  for (const [name, stats] of Object.entries(endpointMap)) {
    const errorRate = stats.total > 0 ? (stats.errors + stats.timeouts) / stats.total : 0;
    const emptyRate = stats.total > 0 ? stats.empty / stats.total : 0;
    if (errorRate > 0.3) {
      alerts.push({ endpoint: name, reason: `${Math.round(errorRate * 100)}% error rate` });
    } else if (emptyRate > 0.5) {
      alerts.push({ endpoint: name, reason: `${Math.round(emptyRate * 100)}% empty results — endpoint may have changed` });
    } else if (stats.success === 0 && stats.total > 0) {
      alerts.push({ endpoint: name, reason: 'zero successful calls — endpoint may be down' });
    }
  }

  // Recent errors
  const recentErrors = syncHealth
    .filter(r => r.status === 'error' || r.status === 'timeout')
    .slice(0, 10);

  const getHealthColor = (stats: EndpointStats) => {
    const errorRate = stats.total > 0 ? (stats.errors + stats.timeouts) / stats.total : 0;
    const emptyRate = stats.total > 0 ? stats.empty / stats.total : 0;
    if (errorRate === 0 && emptyRate < 0.2) return 'bg-green-500';
    if (errorRate < 0.1 && emptyRate < 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const successRate = (stats: EndpointStats) =>
    stats.total > 0 ? `${Math.round((stats.success / stats.total) * 100)}%` : '—';

  return (
    <>
      {/* Alert Banner */}
      {alerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>API Health Alert</AlertTitle>
          <AlertDescription>
            {alerts.map((a, i) => (
              <div key={i}>
                <strong>{a.endpoint}</strong>: {a.reason} in the last 24h. NYC Open Data may have changed this endpoint.
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Sync Health Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Sync Health (Last 24h)
            </CardTitle>
            {dataUpdatedAt > 0 && (
              <span className="text-xs text-muted-foreground">
                Updated: {format(new Date(dataUpdatedAt), 'MMM d, HH:mm:ss')}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(endpointMap).length === 0 ? (
            <p className="text-muted-foreground text-sm">No sync activity in the last 24 hours.</p>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                    <TableHead className="text-right">Avg Ms</TableHead>
                    <TableHead className="text-right">Empty</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(endpointMap)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([name, stats]) => (
                      <TableRow key={name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger>
                                <div className={`w-2.5 h-2.5 rounded-full ${getHealthColor(stats)}`} />
                              </TooltipTrigger>
                              <TooltipContent>
                                Green = healthy, Yellow = degraded, Red = failing
                              </TooltipContent>
                            </Tooltip>
                            <span className="font-medium text-sm">{name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{stats.total}</TableCell>
                        <TableCell className="text-right">{successRate(stats)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{stats.avgMs}ms</TableCell>
                        <TableCell className="text-right">
                          {stats.empty > 0 ? (
                            <Badge variant="secondary" className="text-xs">{stats.empty}</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {(stats.errors + stats.timeouts) > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              {stats.errors + stats.timeouts}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>

              {recentErrors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Recent Errors</h4>
                  <div className="space-y-1">
                    {recentErrors.map((err, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs p-2 rounded border border-border">
                        <span className="text-muted-foreground whitespace-nowrap">
                          {format(new Date(err.created_at), 'MMM d HH:mm')}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">{err.endpoint_name}</Badge>
                        <span className="text-destructive truncate">{err.error_message || err.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
