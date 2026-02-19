import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Bug, AlertCircle, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useState } from 'react';

const statusOptions = [
  { value: 'open', label: 'Open', icon: AlertCircle, color: 'text-orange-500' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-blue-500' },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle2, color: 'text-emerald-500' },
];

const severityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-destructive/10 text-destructive',
};

export default function AdminBugReportsPage() {
  const queryClient = useQueryClient();
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const { data: reports, isLoading } = useQuery({
    queryKey: ['admin-bug-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bug_reports' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('bug_reports' as any)
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bug-reports'] });
      toast.success('Bug report updated');
      setEditingNote(null);
    },
    onError: () => toast.error('Failed to update'),
  });

  const counts = {
    open: reports?.filter((r: any) => r.status === 'open').length || 0,
    in_progress: reports?.filter((r: any) => r.status === 'in_progress').length || 0,
    resolved: reports?.filter((r: any) => r.status === 'resolved').length || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bug className="w-6 h-6" /> Bug Reports
        </h1>
        <p className="text-muted-foreground">Review and manage bug reports from beta testers</p>
      </div>

      <div className="flex gap-3">
        {statusOptions.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.value} className="flex-1">
              <CardContent className="pt-4 pb-3 px-4 flex items-center gap-2">
                <Icon className={`w-5 h-5 ${s.color}`} />
                <span className="text-xl font-bold">{counts[s.value as keyof typeof counts]}</span>
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !reports?.length ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No bug reports yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report: any) => (
            <Card key={report.id}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{report.title}</span>
                      <Badge variant="outline" className={`text-xs ${severityColors[report.severity] || ''}`}>
                        {report.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                      <span>{format(new Date(report.created_at), 'MMM d, yyyy h:mm a')}</span>
                      {report.page_url && <span className="font-mono">{report.page_url}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Select
                      value={report.status}
                      onValueChange={(val) => updateMutation.mutate({ id: report.id, updates: { status: val } })}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Admin notes */}
                <div className="mt-3 pt-3 border-t border-border">
                  {editingNote === report.id ? (
                    <div className="flex gap-2">
                      <Input
                        className="h-8 text-sm"
                        placeholder="Add a note for the reporter..."
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          updateMutation.mutate({ id: report.id, updates: { admin_notes: noteText } });
                        }}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNote(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { setEditingNote(report.id); setNoteText(report.admin_notes || ''); }}
                    >
                      {report.admin_notes ? `Note: ${report.admin_notes}` : '+ Add admin note'}
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
