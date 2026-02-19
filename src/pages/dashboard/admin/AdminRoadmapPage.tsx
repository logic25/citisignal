import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

const PHASES = ['live', 'in_progress', 'next_up', 'future'] as const;
const PHASE_LABELS: Record<string, string> = {
  live: 'Live',
  in_progress: 'In Progress',
  next_up: 'Next Up',
  future: 'Future',
};
const PHASE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  live: 'default',
  in_progress: 'secondary',
  next_up: 'outline',
  future: 'outline',
};

type RoadmapItem = {
  id: string;
  title: string;
  description: string | null;
  phase: string;
  sort_order: number;
  created_at: string;
};

export default function AdminRoadmapPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [form, setForm] = useState({ title: '', description: '', phase: 'future', sort_order: 0 });

  const { data: items, isLoading } = useQuery({
    queryKey: ['admin-roadmap-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roadmap_items')
        .select('*')
        .order('phase')
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

  const openCreate = () => {
    setEditingItem(null);
    setForm({ title: '', description: '', phase: 'future', sort_order: (items?.length ?? 0) + 1 });
    setDialogOpen(true);
  };

  const openEdit = (item: RoadmapItem) => {
    setEditingItem(item);
    setForm({ title: item.title, description: item.description || '', phase: item.phase, sort_order: item.sort_order });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setForm({ title: '', description: '', phase: 'future', sort_order: 0 });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate({ ...form, id: editingItem?.id });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roadmap Management</h1>
          <p className="text-muted-foreground">{items?.length ?? 0} items across {PHASES.length} phases</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phase</label>
                  <Select value={form.phase} onValueChange={(v) => setForm({ ...form, phase: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PHASES.map((p) => (
                        <SelectItem key={p} value={p}>{PHASE_LABELS[p]}</SelectItem>
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading...</TableCell>
                </TableRow>
              ) : !items?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No roadmap items yet</TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground text-xs">{item.sort_order}</TableCell>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>
                      <Badge variant={PHASE_VARIANTS[item.phase] || 'outline'}>
                        {PHASE_LABELS[item.phase] || item.phase}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                      {item.description || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
