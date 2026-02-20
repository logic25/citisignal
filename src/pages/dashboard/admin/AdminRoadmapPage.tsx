import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Rocket, Loader2, Clock, Lightbulb, Zap, AlertTriangle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const PHASES = ['live', 'in_progress', 'next_up', 'future'] as const;
type Phase = typeof PHASES[number];

const PHASE_CONFIG: Record<Phase, { label: string; icon: typeof Rocket; color: string; description: string }> = {
  live: { label: 'Live', icon: Rocket, color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400', description: 'Shipped & available' },
  in_progress: { label: 'In Progress', icon: Loader2, color: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400', description: 'Currently building' },
  next_up: { label: 'Next Up', icon: Clock, color: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400', description: 'Planned for next sprint' },
  future: { label: 'Future', icon: Lightbulb, color: 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400', description: 'On the radar' },
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-warning/10 text-warning border-warning/30',
  low: 'bg-success/10 text-success border-success/30',
};

const AI_CATEGORIES = ['billing', 'projects', 'integrations', 'operations', 'general'] as const;

type RoadmapItem = {
  id: string;
  title: string;
  description: string | null;
  phase: string;
  sort_order: number;
  created_at: string;
};

type AIResult = {
  title: string;
  description: string;
  category: string;
  priority: string;
  evidence: string;
  duplicate_warning: string | null;
  challenges: { problem: string; solution: string }[];
};

async function runAITest(rawIdea: string, existingItems: string[]): Promise<AIResult> {
  const { data, error } = await supabase.functions.invoke('analyze-telemetry', {
    body: { mode: 'idea', raw_idea: rawIdea, existing_items: existingItems },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as AIResult;
}

function AIResultPanel({ result, onClose }: { result: AIResult; onClose?: () => void }) {
  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground text-sm">{result.title}</span>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${PRIORITY_COLORS[result.priority] || ''}`}>
            {result.priority} priority
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{result.category}</Badge>
          {onClose && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-1">✕</button>
          )}
        </div>
      </div>
      {result.duplicate_warning && (
        <div className="flex items-start gap-1.5 text-warning bg-warning/10 rounded px-2 py-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>Similar to: <em>{result.duplicate_warning}</em></span>
        </div>
      )}
      <p className="text-muted-foreground">{result.evidence}</p>
      {result.challenges?.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium text-foreground">Challenges</p>
          {result.challenges.map((c, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
              <span><span className="text-foreground">{c.problem}</span> → <span className="text-muted-foreground">{c.solution}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminRoadmapPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [form, setForm] = useState({ title: '', description: '', phase: 'future' as string, sort_order: 0 });

  // AI state per card (id -> result)
  const [cardAILoading, setCardAILoading] = useState<Record<string, boolean>>({});
  const [cardAIResult, setCardAIResult] = useState<Record<string, AIResult>>({});
  const [cardAITested, setCardAITested] = useState<Set<string>>(new Set());

  // AI state for dialog
  const [dialogAILoading, setDialogAILoading] = useState(false);
  const [dialogAIResult, setDialogAIResult] = useState<AIResult | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ['admin-roadmap-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roadmap_items')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as RoadmapItem[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (item: typeof form & { id?: string }) => {
      if (item.id) {
        const { error } = await supabase
          .from('roadmap_items')
          .update({ title: item.title, description: item.description || null, phase: item.phase, sort_order: item.sort_order })
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('roadmap_items')
          .insert({ title: item.title, description: item.description || null, phase: item.phase, sort_order: item.sort_order });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roadmap-items'] });
      toast.success(editingItem ? 'Item updated' : 'Item created');
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('roadmap_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roadmap-items'] });
      toast.success('Item deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  const moveItem = useMutation({
    mutationFn: async ({ id, phase }: { id: string; phase: string }) => {
      const { error } = await supabase.from('roadmap_items').update({ phase }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roadmap-items'] });
      toast.success('Item moved');
    },
  });

  const openCreate = (phase: Phase = 'future') => {
    const phaseItems = items?.filter(i => i.phase === phase) || [];
    setEditingItem(null);
    setForm({ title: '', description: '', phase, sort_order: phaseItems.length + 1 });
    setDialogAIResult(null);
    setDialogOpen(true);
  };

  const openEdit = (item: RoadmapItem) => {
    setEditingItem(item);
    setForm({ title: item.title, description: item.description || '', phase: item.phase, sort_order: item.sort_order });
    setDialogAIResult(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setForm({ title: '', description: '', phase: 'future', sort_order: 0 });
    setDialogAIResult(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate({ ...form, id: editingItem?.id });
  };

  const getPhaseItems = (phase: Phase) =>
    (items || []).filter(i => i.phase === phase).sort((a, b) => a.sort_order - b.sort_order);

  const totalItems = items?.length || 0;
  const existingTitles = items?.map(i => i.title) || [];

  const handleCardAITest = async (item: RoadmapItem) => {
    setCardAILoading(prev => ({ ...prev, [item.id]: true }));
    try {
      const idea = `${item.title}${item.description ? ': ' + item.description : ''}`;
      const others = existingTitles.filter(t => t !== item.title);
      const result = await runAITest(idea, others);
      setCardAIResult(prev => ({ ...prev, [item.id]: result }));
      setCardAITested(prev => new Set([...prev, item.id]));
    } catch (err: any) {
      toast.error('AI test failed: ' + err.message);
    } finally {
      setCardAILoading(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleDialogAITest = async () => {
    if (!form.title.trim()) {
      toast.error('Add a title first');
      return;
    }
    setDialogAILoading(true);
    try {
      const idea = `${form.title}${form.description ? ': ' + form.description : ''}`;
      const others = existingTitles.filter(t => t !== form.title);
      const result = await runAITest(idea, others);
      setDialogAIResult(result);
      // Auto-fill priority and category
      if (result.category) setForm(f => ({ ...f })); // category not in form but we show it
      toast.success('AI analysis complete');
    } catch (err: any) {
      toast.error('AI test failed: ' + err.message);
    } finally {
      setDialogAILoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roadmap</h1>
          <p className="text-muted-foreground">{totalItems} items across {PHASES.length} phases</p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="w-4 h-4 mr-1" /> Add Item
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {PHASES.map((phase) => {
          const config = PHASE_CONFIG[phase];
          const phaseItems = getPhaseItems(phase);
          const Icon = config.icon;

          return (
            <div key={phase} className="flex flex-col">
              {/* Column Header */}
              <div className={`flex items-center justify-between p-3 rounded-t-lg border ${config.color}`}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="font-semibold text-sm">{config.label}</span>
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">
                    {phaseItems.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => openCreate(phase)}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Column Body */}
              <div className="flex-1 bg-muted/30 border border-t-0 border-border rounded-b-lg p-2 space-y-2 min-h-[200px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : phaseItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    <p>{config.description}</p>
                    <p className="mt-1">No items yet</p>
                  </div>
                ) : (
                  phaseItems.map((item) => {
                    const isAILoading = cardAILoading[item.id];
                    const aiResult = cardAIResult[item.id];
                    const isTested = cardAITested.has(item.id);

                    return (
                      <Card key={item.id} className="group cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-medium text-sm text-foreground leading-tight">{item.title}</p>
                                {isTested && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary/30 text-primary">
                                    ⚡ AI tested
                                  </Badge>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                              )}
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-primary/70 hover:text-primary"
                                onClick={() => handleCardAITest(item)}
                                disabled={isAILoading}
                                title="Run AI Test"
                              >
                                {isAILoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Zap className="w-3 h-3" />
                                )}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(item)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => deleteMutation.mutate(item.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          {/* AI Result inline */}
                          {aiResult && (
                            <AIResultPanel
                              result={aiResult}
                              onClose={() => setCardAIResult(prev => { const n = { ...prev }; delete n[item.id]; return n; })}
                            />
                          )}

                          {/* Quick move buttons */}
                          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {PHASES.filter(p => p !== item.phase).map(targetPhase => (
                              <button
                                key={targetPhase}
                                onClick={() => moveItem.mutate({ id: item.id, phase: targetPhase })}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                              >
                                → {PHASE_CONFIG[targetPhase].label}
                              </button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Roadmap Item' : 'New Roadmap Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>

            {/* Test with AI button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDialogAITest}
              disabled={dialogAILoading || !form.title.trim()}
              className="gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
            >
              {dialogAILoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              {dialogAILoading ? 'Analyzing...' : 'Test with AI'}
            </Button>

            {/* Dialog AI Result */}
            {dialogAIResult && (
              <AIResultPanel result={dialogAIResult} onClose={() => setDialogAIResult(null)} />
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phase</label>
                <Select value={form.phase} onValueChange={(v) => setForm({ ...form, phase: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PHASES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          {PHASE_CONFIG[p].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort Order</label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {editingItem ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
