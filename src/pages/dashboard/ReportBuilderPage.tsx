import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, FileText, Play, Download, Clock, Trash2, Copy, Table as TableIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

const REPORT_TYPES = [
  { value: 'financial', label: 'Financial Summary', description: 'Income, expenses, NOI by property' },
  { value: 'violations', label: 'Violations Report', description: 'Open/closed violations by status, agency, severity' },
  { value: 'compliance', label: 'Compliance Report', description: 'Local law compliance status and deadlines' },
  { value: 'cam', label: 'CAM Reconciliation', description: 'Budget vs actual, tenant allocations' },
  { value: 'tenant', label: 'Tenant Report', description: 'Lease expirations, rent rolls, occupancy' },
  { value: 'work_orders', label: 'Work Orders Report', description: 'WO status, vendor performance, costs' },
  { value: 'custom', label: 'Custom Report', description: 'Build from scratch with any data sources' },
];

const DATA_SOURCES = [
  { value: 'violations', label: 'Violations' },
  { value: 'applications', label: 'Applications' },
  { value: 'compliance_requirements', label: 'Compliance Requirements' },
  { value: 'financial_transactions', label: 'Financial Transactions' },
  { value: 'cam_budgets', label: 'CAM Budgets' },
  { value: 'tenants', label: 'Tenants' },
  { value: 'work_orders', label: 'Work Orders' },
  { value: 'properties', label: 'Properties' },
];

interface ReportFilters {
  property_id?: string | null;
  date_start?: string;
  date_end?: string;
}

interface ReportTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  report_type: string;
  data_sources: string[];
  filters: ReportFilters;
  created_at: string;
}

export default function ReportBuilderPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [newTemplate, setNewTemplate] = useState({
    name: '', description: '', report_type: 'financial',
    property_id: 'all', date_start: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
    date_end: format(new Date(), 'yyyy-MM-dd'),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('id, address').order('address');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['report-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('report_templates').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ReportTemplate[];
    },
    enabled: !!user,
  });

  const { data: runs = [] } = useQuery({
    queryKey: ['report-runs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('report_runs').select('*').order('generated_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('report_templates').insert({
        user_id: user!.id,
        name: newTemplate.name,
        description: newTemplate.description,
        report_type: newTemplate.report_type,
        data_sources: selectedSources,
        filters: {
          property_id: newTemplate.property_id === 'all' ? null : newTemplate.property_id,
          date_start: newTemplate.date_start,
          date_end: newTemplate.date_end,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      setShowCreate(false);
      setNewTemplate({ name: '', description: '', report_type: 'financial', property_id: 'all', date_start: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'), date_end: format(new Date(), 'yyyy-MM-dd') });
      setSelectedSources([]);
      toast.success('Report template created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runReport = useMutation({
    mutationFn: async (template: ReportTemplate) => {
      const filters: ReportFilters = template.filters || {};
      const dataSources: string[] = template.data_sources || [];
      const results: Record<string, any[]> = {};
      let totalRows = 0;

      for (const source of dataSources) {
        let query = supabase.from(source as any).select('*');
        if (filters.property_id) {
          query = query.eq('property_id', filters.property_id);
        }
        if (filters.date_start && source === 'financial_transactions') {
          query = query.gte('transaction_date', filters.date_start);
        }
        if (filters.date_end && source === 'financial_transactions') {
          query = query.lte('transaction_date', filters.date_end);
        }
        const { data, error } = await query.limit(500);
        if (!error && data) {
          results[source] = data as any[];
          totalRows += data.length;
        }
      }

      const { error } = await supabase.from('report_runs').insert({
        template_id: template.id,
        user_id: user!.id,
        name: template.name,
        report_type: template.report_type,
        parameters: filters as any,
        result_data: results as any,
        row_count: totalRows,
        status: 'completed',
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-runs'] });
      toast.success('Report generated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('report_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      toast.success('Template deleted');
    },
  });

  const [viewRun, setViewRun] = useState<any>(null);

  const exportCSV = useCallback((run: any) => {
    if (!run?.result_data) return;
    const resultData = run.result_data as Record<string, any[]>;
    const lines: string[] = [];
    for (const [source, rows] of Object.entries(resultData)) {
      if (!rows.length) continue;
      lines.push(`--- ${source.replace('_', ' ').toUpperCase()} ---`);
      const cols = Object.keys(rows[0]).filter(k => !['raw_data', 'result_data', 'metadata'].includes(k));
      lines.push(cols.join(','));
      for (const row of rows) {
        lines.push(cols.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return '';
          const str = typeof v === 'object' ? JSON.stringify(v) : String(v);
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(','));
      }
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${run.name || 'report'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Report Builder</h1>
          <p className="text-muted-foreground">Create custom reports from your property data</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Report Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Report Template</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <Label>Report Name</Label>
                <Input value={newTemplate.name} onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Monthly Financial Summary" />
              </div>
              <div>
                <Label>Report Type</Label>
                <Select value={newTemplate.report_type} onValueChange={v => {
                  setNewTemplate(p => ({ ...p, report_type: v }));
                  // Auto-select data sources based on type
                  const autoSources: Record<string, string[]> = {
                    financial: ['financial_transactions'],
                    violations: ['violations'],
                    compliance: ['compliance_requirements'],
                    cam: ['cam_budgets', 'financial_transactions'],
                    tenant: ['tenants'],
                    work_orders: ['work_orders'],
                    custom: [],
                  };
                  setSelectedSources(autoSources[v] || []);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map(rt => (
                      <SelectItem key={rt.value} value={rt.value}>
                        <div>
                          <div className="font-medium">{rt.label}</div>
                          <div className="text-xs text-muted-foreground">{rt.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data Sources</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {DATA_SOURCES.map(ds => (
                    <label key={ds.value} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-muted/50">
                      <Checkbox
                        checked={selectedSources.includes(ds.value)}
                        onCheckedChange={checked => {
                          setSelectedSources(prev => checked ? [...prev, ds.value] : prev.filter(s => s !== ds.value));
                        }}
                      />
                      {ds.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Property</Label>
                <Select value={newTemplate.property_id} onValueChange={v => setNewTemplate(p => ({ ...p, property_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={newTemplate.date_start} onChange={e => setNewTemplate(p => ({ ...p, date_start: e.target.value }))} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={newTemplate.date_end} onChange={e => setNewTemplate(p => ({ ...p, date_end: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={newTemplate.description} onChange={e => setNewTemplate(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="What this report shows..." />
              </div>
              <Button onClick={() => createTemplate.mutate()} disabled={!newTemplate.name || selectedSources.length === 0} className="w-full">
                Create Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="history">Run History ({runs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          {templates.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No report templates yet. Create one to get started.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(t => {
                const sources: string[] = t.data_sources || [];
                return (
                  <Card key={t.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{t.name}</CardTitle>
                          <Badge variant="outline" className="mt-1 capitalize">{t.report_type}</Badge>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => deleteTemplate.mutate(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3">
                      {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                      <div className="flex flex-wrap gap-1">
                        {sources.map((s: string) => (
                          <Badge key={s} variant="secondary" className="text-xs capitalize">{s.replace('_', ' ')}</Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Created {format(new Date(t.created_at), 'MMM d, yyyy')}</p>
                    </CardContent>
                    <div className="p-4 pt-0">
                      <Button className="w-full" onClick={() => runReport.mutate(t)} disabled={runReport.isPending}>
                        <Play className="w-4 h-4 mr-2" />Run Report
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              {runs.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground">No reports generated yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Rows</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{r.report_type}</Badge></TableCell>
                        <TableCell className="tabular-nums">{r.row_count}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === 'completed' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">{format(new Date(r.generated_at), 'MM/dd/yy h:mm a')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setViewRun(r)}>
                              <FileText className="w-4 h-4 mr-1" />View
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => exportCSV(r)} title="Export CSV">
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Report Run Dialog */}
      <Dialog open={!!viewRun} onOpenChange={() => setViewRun(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{viewRun?.name}</DialogTitle>
              <Button size="sm" variant="outline" onClick={() => exportCSV(viewRun)}>
                <Download className="w-4 h-4 mr-1" />Export CSV
              </Button>
            </div>
          </DialogHeader>
          {viewRun?.result_data && Object.entries(viewRun.result_data as Record<string, any[]>).map(([source, rows]) => (
            <div key={source} className="space-y-2">
              <h3 className="font-semibold capitalize">{source.replace('_', ' ')} <Badge variant="secondary">{rows.length} rows</Badge></h3>
              {rows.length > 0 && (
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(rows[0]).filter(k => !['raw_data', 'result_data', 'metadata'].includes(k)).slice(0, 8).map(col => (
                          <TableHead key={col} className="capitalize text-xs">{col.replace('_', ' ')}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 20).map((row, i) => (
                        <TableRow key={i}>
                          {Object.entries(row).filter(([k]) => !['raw_data', 'result_data', 'metadata'].includes(k)).slice(0, 8).map(([k, v]) => (
                            <TableCell key={k} className="text-xs max-w-[200px] truncate">
                              {v === null ? '—' : typeof v === 'object' ? JSON.stringify(v).substring(0, 50) : String(v).substring(0, 50)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
