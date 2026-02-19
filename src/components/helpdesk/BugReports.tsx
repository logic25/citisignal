import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bug, Plus, Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const severityConfig = {
  low: { label: 'Low', color: 'bg-muted text-muted-foreground' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  critical: { label: 'Critical', color: 'bg-destructive/10 text-destructive' },
};

const statusConfig = {
  open: { label: 'Open', icon: AlertCircle, color: 'text-orange-500' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-blue-500' },
  resolved: { label: 'Resolved', icon: CheckCircle2, color: 'text-emerald-500' },
};

export function BugReports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');

  const { data: reports, isLoading } = useQuery({
    queryKey: ['bug-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bug_reports' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('bug_reports' as any).insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        severity,
        page_url: window.location.pathname,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
      toast.success('Bug report submitted — thank you!');
      setTitle('');
      setDescription('');
      setSeverity('medium');
      setOpen(false);
    },
    onError: () => toast.error('Failed to submit bug report'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Found a bug? Let us know and we'll fix it.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Report Bug
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bug className="w-5 h-5" /> Report a Bug
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="Brief description of the issue"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label>Details</Label>
                <Textarea
                  placeholder="What happened? What did you expect? Steps to reproduce..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  maxLength={2000}
                />
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low — cosmetic issue</SelectItem>
                    <SelectItem value="medium">Medium — feature works but incorrectly</SelectItem>
                    <SelectItem value="high">High — feature broken</SelectItem>
                    <SelectItem value="critical">Critical — can't use the app</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => submitMutation.mutate()}
                disabled={!title.trim() || !description.trim() || submitMutation.isPending}
              >
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Bug className="w-4 h-4 mr-1" />}
                Submit Report
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !reports?.length ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No bug reports yet — that's great!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((report: any) => {
            const sev = severityConfig[report.severity as keyof typeof severityConfig] || severityConfig.medium;
            const stat = statusConfig[report.status as keyof typeof statusConfig] || statusConfig.open;
            const StatusIcon = stat.icon;
            return (
              <Card key={report.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIcon className={`w-4 h-4 shrink-0 ${stat.color}`} />
                        <span className="font-medium text-sm text-foreground truncate">{report.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{report.description}</p>
                      {report.admin_notes && (
                        <p className="text-xs text-primary mt-1 italic">Admin: {report.admin_notes}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className={`text-xs ${sev.color}`}>{sev.label}</Badge>
                      <span className="text-xs text-muted-foreground">{format(new Date(report.created_at), 'MMM d')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
