import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  ClipboardList, 
  Plus, 
  Search,
  Loader2,
  Building2,
  Users,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Calendar,
  Check,
  X,
  DollarSign,
  MessageSquare,
  Send,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Property {
  id: string;
  address: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface Violation {
  id: string;
  violation_number: string;
  agency: string;
}

interface WorkOrderMessage {
  id: string;
  sender_type: string;
  sender_name: string | null;
  channel: string | null;
  message: string;
  extracted_amount: number | null;
  created_at: string;
}

interface WorkOrder {
  id: string;
  scope: string;
  status: string;
  created_at: string;
  property: Property | null;
  vendor: Vendor | null;
  violation: Violation | null;
  priority?: string | null;
  due_date?: string | null;
  quoted_amount?: number | null;
  approved_amount?: number | null;
  dispatched_at?: string | null;
}

const WorkOrdersPage = () => {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
        fetchMessages(id);
      }
      return newSet;
    });
  };
  const [messages, setMessages] = useState<Record<string, WorkOrderMessage[]>>({});
  const [counterAmounts, setCounterAmounts] = useState<Record<string, string>>({});
  const [showCounter, setShowCounter] = useState<Record<string, boolean>>({});
  const [newMessage, setNewMessage] = useState<Record<string, string>>({});
  const [quoteInputs, setQuoteInputs] = useState<Record<string, string>>({});
  const [savingQuote, setSavingQuote] = useState<Record<string, boolean>>({});

  const fetchMessages = async (workOrderId: string) => {
    const { data } = await supabase
      .from('work_order_messages')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages(prev => ({ ...prev, [workOrderId]: data as unknown as WorkOrderMessage[] }));
    }
  };

  const handleSaveQuote = async (woId: string) => {
    const amount = parseFloat(quoteInputs[woId] || '');
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setSavingQuote(prev => ({ ...prev, [woId]: true }));
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ quoted_amount: amount })
        .eq('id', woId);
      if (error) throw error;
      toast.success(`Quote of $${amount.toLocaleString()} saved`);
      fetchData();
    } catch { toast.error('Failed to save quote'); }
    finally { setSavingQuote(prev => ({ ...prev, [woId]: false })); }
  };

  const handleApprove = async (wo: WorkOrder) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({
          status: 'approved' as any,
          approved_amount: wo.quoted_amount,
          approved_at: new Date().toISOString(),
        })
        .eq('id', wo.id);
      if (error) throw error;
      toast.success(`Quote of $${wo.quoted_amount?.toLocaleString()} approved`);
      fetchData();
    } catch { toast.error('Failed to approve'); }
  };

  const handleReject = async (wo: WorkOrder) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'open' as any, quoted_amount: null })
        .eq('id', wo.id);
      if (error) throw error;
      toast.success('Quote rejected, work order reopened');
      fetchData();
    } catch { toast.error('Failed to reject'); }
  };

  const handleCounter = async (wo: WorkOrder) => {
    const amount = parseFloat(counterAmounts[wo.id] || '');
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ quoted_amount: amount })
        .eq('id', wo.id);
      if (error) throw error;
      await supabase.from('work_order_messages').insert({
        work_order_id: wo.id,
        sender_type: 'owner',
        sender_name: 'You',
        channel: 'in_app',
        message: `Counter offer: $${amount.toLocaleString()}`,
      });
      toast.success(`Counter offer of $${amount.toLocaleString()} sent`);
      setShowCounter(prev => ({ ...prev, [wo.id]: false }));
      fetchData();
    } catch { toast.error('Failed to send counter'); }
  };

  const handleSendMessage = async (woId: string) => {
    const msg = newMessage[woId]?.trim();
    if (!msg) return;
    try {
      await supabase.from('work_order_messages').insert({
        work_order_id: woId,
        sender_type: 'owner',
        sender_name: 'You',
        channel: 'in_app',
        message: msg,
      });
      setNewMessage(prev => ({ ...prev, [woId]: '' }));
      fetchMessages(woId);
      toast.success('Message added');
    } catch { toast.error('Failed to send message'); }
  };

  const [formData, setFormData] = useState({
    property_id: '',
    vendor_id: '',
    linked_violation_id: '',
    scope: '',
  });

  const fetchData = async () => {
    if (!user) return;

    try {
      const [workOrdersRes, propertiesRes, vendorsRes, violationsRes] = await Promise.all([
        supabase
          .from('work_orders')
          .select(`
            *,
            property:properties(id, address),
            vendor:vendors(id, name),
            violation:violations(id, violation_number, agency)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('properties').select('id, address').order('address'),
        supabase.from('vendors').select('id, name').order('name'),
        supabase.from('violations').select('id, violation_number, agency').neq('status', 'closed'),
      ]);

      if (workOrdersRes.error) throw workOrdersRes.error;

      setWorkOrders(workOrdersRes.data as unknown as WorkOrder[] || []);
      setProperties(propertiesRes.data || []);
      setVendors(vendorsRes.data || []);
      setViolations(violationsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load work orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('work_orders').insert({
        property_id: formData.property_id,
        vendor_id: formData.vendor_id || null,
        linked_violation_id: formData.linked_violation_id || null,
        scope: formData.scope,
      });

      if (error) throw error;

      toast.success('Work order created');
      setIsDialogOpen(false);
      setFormData({
        property_id: '',
        vendor_id: '',
        linked_violation_id: '',
        scope: '',
      });
      fetchData();
    } catch (error) {
      console.error('Error creating work order:', error);
      toast.error('Failed to create work order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: status as any })
        .eq('id', id);

      if (error) throw error;
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const filteredWorkOrders = workOrders.filter(wo => {
    const matchesSearch = 
      wo.scope.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.property?.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.vendor?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    open: 'bg-destructive/10 text-destructive border-destructive',
    dispatched: 'bg-orange-500/10 text-orange-600 border-orange-500',
    quoted: 'bg-purple-500/10 text-purple-600 border-purple-500',
    approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500',
    in_progress: 'bg-warning/10 text-warning border-warning',
    awaiting_docs: 'bg-primary/10 text-primary border-primary',
    completed: 'bg-success/10 text-success border-success',
  };

  const getStatusBadge = (status: string) => {
    const labels: Record<string, string> = {
      open: 'Open',
      dispatched: 'Dispatched',
      quoted: 'Quoted',
      approved: 'Approved',
      in_progress: 'In Progress',
      awaiting_docs: 'Awaiting Docs',
      completed: 'Completed',
    };
    return (
      <Badge variant="outline" className={statusColors[status] || ''}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string | null | undefined) => {
    if (priority === 'urgent') return <Badge className="bg-destructive/10 text-destructive text-xs">Urgent</Badge>;
    if (priority === 'low') return <Badge className="bg-muted text-muted-foreground text-xs">Low</Badge>;
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Work Orders</h1>
          <p className="text-muted-foreground mt-1">
            Track work assignments and progress
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" disabled={properties.length === 0}>
              <Plus className="w-4 h-4" />
              Create Work Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Create Work Order</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label>Property *</Label>
                <Select
                  value={formData.property_id}
                  onValueChange={(v) => setFormData({ ...formData, property_id: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign Vendor</Label>
                <Select
                  value={formData.vendor_id}
                  onValueChange={(v) => setFormData({ ...formData, vendor_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {violations.length > 0 && (
                <div className="space-y-2">
                  <Label>Link to Violation</Label>
                  <Select
                    value={formData.linked_violation_id}
                    onValueChange={(v) => setFormData({ ...formData, linked_violation_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select violation (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {violations.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.agency} - #{v.violation_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="scope">Scope of Work *</Label>
                <Input
                  id="scope"
                  placeholder="Describe the work to be done..."
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="hero" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search work orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="awaiting_docs">Awaiting Docs</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Work Orders Table */}
      {filteredWorkOrders.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10"></TableHead>
              <TableHead className="font-semibold">Scope</TableHead>
                <TableHead className="font-semibold">Property</TableHead>
                <TableHead className="font-semibold">Vendor</TableHead>
                <TableHead className="font-semibold">Quote</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkOrders.map((workOrder) => (
                <Collapsible key={workOrder.id} asChild open={expandedRows.has(workOrder.id)} onOpenChange={() => toggleRow(workOrder.id)}>
                  <>
                    <TableRow className="hover:bg-muted/30">
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {expandedRows.has(workOrder.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <ClipboardList className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <span className="font-medium line-clamp-1">{workOrder.scope}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {getPriorityBadge(workOrder.priority)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          <span className="line-clamp-1">{workOrder.property?.address || 'No property'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {workOrder.vendor ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            {workOrder.vendor.name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {workOrder.quoted_amount != null ? (
                          <span className="font-semibold text-sm">${workOrder.quoted_amount.toLocaleString()}</span>
                        ) : workOrder.approved_amount != null ? (
                          <span className="font-semibold text-sm text-success">${workOrder.approved_amount.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={workOrder.status}
                          onValueChange={(v) => updateStatus(workOrder.id, v as any)}
                        >
                          <SelectTrigger className={`w-32 h-8 text-xs ${statusColors[workOrder.status]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="dispatched">Dispatched</SelectItem>
                            <SelectItem value="quoted">Quoted</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="awaiting_docs">Awaiting Docs</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(workOrder.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <tr className="bg-muted/20">
                        <td colSpan={7} className="p-4 border-t border-border">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Full Scope:</span>
                              <p className="font-medium">{workOrder.scope}</p>
                            </div>
                            {workOrder.violation && (
                              <div>
                                <span className="text-muted-foreground">Linked Violation:</span>
                                <p className="font-medium flex items-center gap-1 text-warning">
                                  <AlertTriangle className="w-3 h-3" />
                                  {workOrder.violation.agency} #{workOrder.violation.violation_number}
                                </p>
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground">Created:</span>
                              <p className="font-medium">{new Date(workOrder.created_at).toLocaleString()}</p>
                            </div>
                            {workOrder.due_date && (
                              <div>
                                <span className="text-muted-foreground">Due Date:</span>
                                <p className="font-medium">{new Date(workOrder.due_date).toLocaleDateString()}</p>
                              </div>
                            )}
                          </div>

                          {/* Approval Flow */}
                          {workOrder.status === 'quoted' && (
                            <div className="mt-4 p-3 rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
                              {workOrder.quoted_amount != null ? (
                                <>
                                  <div className="flex items-center gap-2 mb-3">
                                    <DollarSign className="w-4 h-4 text-purple-600" />
                                    <span className="font-semibold text-purple-700 dark:text-purple-300">
                                      Quote: ${workOrder.quoted_amount.toLocaleString()}
                                    </span>
                                    {workOrder.vendor && (
                                      <span className="text-sm text-muted-foreground">from {workOrder.vendor.name}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(workOrder)}>
                                      <Check className="w-3 h-3 mr-1" /> Approve
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setShowCounter(prev => ({ ...prev, [workOrder.id]: !prev[workOrder.id] }))}>
                                      <DollarSign className="w-3 h-3 mr-1" /> Counter
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleReject(workOrder)}>
                                      <X className="w-3 h-3 mr-1" /> Reject
                                    </Button>
                                  </div>
                                  {showCounter[workOrder.id] && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <Input
                                        type="number"
                                        placeholder="Your counter amount"
                                        className="w-40 h-8"
                                        value={counterAmounts[workOrder.id] || ''}
                                        onChange={(e) => setCounterAmounts(prev => ({ ...prev, [workOrder.id]: e.target.value }))}
                                      />
                                      <Button size="sm" onClick={() => handleCounter(workOrder)}>Send Counter</Button>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 mb-2">
                                    <DollarSign className="w-4 h-4 text-purple-600" />
                                    <span className="font-medium text-purple-700 dark:text-purple-300">
                                      Enter quote amount to approve or counter
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      placeholder="Quote amount ($)"
                                      className="w-44 h-8"
                                      value={quoteInputs[workOrder.id] || ''}
                                      onChange={(e) => setQuoteInputs(prev => ({ ...prev, [workOrder.id]: e.target.value }))}
                                    />
                                    <Button size="sm" onClick={() => handleSaveQuote(workOrder.id)} disabled={savingQuote[workOrder.id]}>
                                      {savingQuote[workOrder.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Set Quote'}
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleReject(workOrder)}>
                                      <X className="w-3 h-3 mr-1" /> Reject
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {workOrder.status === 'approved' && workOrder.approved_amount != null && (
                            <div className="mt-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
                              <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                  Approved: ${workOrder.approved_amount.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Communication Thread */}
                          <div className="mt-4">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-muted-foreground">Communication Thread</span>
                            </div>
                            {(messages[workOrder.id] || []).length > 0 ? (
                              <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
                                {(messages[workOrder.id] || []).map((msg) => (
                                  <div key={msg.id} className={`text-sm p-2 rounded-lg ${
                                    msg.sender_type === 'vendor' ? 'bg-blue-50 dark:bg-blue-950/30 ml-0 mr-8' :
                                    msg.sender_type === 'system' ? 'bg-muted mx-4 text-center italic' :
                                    'bg-primary/5 ml-8 mr-0'
                                  }`}>
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-medium text-xs">{msg.sender_name || msg.sender_type}</span>
                                      {msg.channel && <Badge variant="outline" className="text-[10px] h-4">{msg.channel}</Badge>}
                                      <span className="text-[10px] text-muted-foreground ml-auto">{new Date(msg.created_at).toLocaleString()}</span>
                                    </div>
                                    <p>{msg.message}</p>
                                    {msg.extracted_amount && (
                                      <Badge className="mt-1 bg-purple-100 text-purple-700 text-xs">Extracted: ${msg.extracted_amount.toLocaleString()}</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground mb-2">No messages yet.</p>
                            )}
                            <div className="flex items-center gap-2">
                              <Textarea
                                placeholder="Add a note..."
                                className="h-8 min-h-[32px] text-sm resize-none"
                                value={newMessage[workOrder.id] || ''}
                                onChange={(e) => setNewMessage(prev => ({ ...prev, [workOrder.id]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(workOrder.id); }}}
                              />
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSendMessage(workOrder.id)}>
                                <Send className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <ClipboardList className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            {properties.length === 0 ? 'Add a property first' : 'No work orders yet'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {properties.length === 0 
              ? 'You need properties to create work orders'
              : 'Create work orders to track vendor assignments'}
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkOrdersPage;
