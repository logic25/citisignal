import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Ticket, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface InviteCode {
  id: string;
  code: string;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

const InviteCodesTab = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [newCode, setNewCode] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['invite-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as InviteCode[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const normalized = newCode.trim().toUpperCase();
      if (!normalized) throw new Error('Code cannot be empty');
      const { error } = await supabase.from('invite_codes').insert({
        code: normalized,
        max_uses: parseInt(maxUses) || 1,
        expires_at: expiresAt || null,
        notes: notes || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invite-codes'] });
      toast.success('Invite code created');
      setIsCreateOpen(false);
      setNewCode('');
      setMaxUses('1');
      setExpiresAt('');
      setNotes('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('invite_codes')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invite-codes'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invite_codes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invite-codes'] });
      toast.success('Invite code deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setNewCode(code);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Invite Codes</h2>
          <p className="text-sm text-muted-foreground">Manage who can create a CitiSignal account</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              New Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Invite Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    placeholder="e.g. CITIBETA"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={generateRandomCode}>
                    Random
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxUses">Max Uses</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">How many times this code can be used to create an account</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires At (optional)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  placeholder="e.g. For John Smith"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newCode.trim()}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Code'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-foreground">{codes.length}</p>
            <p className="text-xs text-muted-foreground">Total Codes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-foreground">{codes.filter(c => c.is_active).length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-foreground">{codes.reduce((sum, c) => sum + c.use_count, 0)}</p>
            <p className="text-xs text-muted-foreground">Total Uses</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="w-4 h-4" />
            All Codes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading codes...</p>
          ) : codes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No invite codes yet. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => {
                  const isExhausted = code.use_count >= code.max_uses;
                  const isExpired = code.expires_at ? new Date(code.expires_at) < new Date() : false;
                  return (
                    <TableRow key={code.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-foreground">{code.code}</span>
                          <button
                            onClick={() => copyCode(code.code, code.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedId === code.id ? (
                              <Check className="w-3 h-3 text-primary" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={isExhausted ? 'text-destructive font-medium' : 'text-foreground'}>
                          {code.use_count} / {code.max_uses}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {code.expires_at ? (
                          <span className={isExpired ? 'text-destructive' : ''}>
                            {format(new Date(code.expires_at), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                        {code.notes || '—'}
                      </TableCell>
                      <TableCell>
                        {isExpired || isExhausted ? (
                          <Badge variant="destructive" className="text-xs">
                            {isExpired ? 'Expired' : 'Exhausted'}
                          </Badge>
                        ) : (
                          <Switch
                            checked={code.is_active}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ id: code.id, is_active: checked })
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(code.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(code.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteCodesTab;
