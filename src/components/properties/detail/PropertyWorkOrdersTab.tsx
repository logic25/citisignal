import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Wrench, 
  Plus,
  Loader2,
  Calendar,
  Link2,
  DollarSign,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Check,
  X,
  Clock,
  AlertTriangle,
  Send,
  Search,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface WorkOrder {
  id: string;
  scope: string;
  status: string;
  created_at: string;
  linked_violation_id: string | null;
  vendor_id: string | null;
  quoted_amount?: number | null;
  approved_amount?: number | null;
  approved_at?: string | null;
  priority?: string | null;
  due_date?: string | null;
  notes?: string | null;
  dispatched_at?: string | null;
  vendor_notified_via?: string | null;
}

interface Violation {
  id: string;
  agency: string;
  violation_number: string;
}

interface Vendor {
  id: string;
  name: string;
  phone_number: string | null;
  trade_type: string | null;
  coi_expiration_date: string | null;
}

interface WorkOrderMessage {
  id: string;
  work_order_id: string;
  sender_type: string;
  sender_name: string | null;
  channel: string;
  message: string;
  extracted_amount: number | null;
  created_at: string;
}

interface PropertyWorkOrdersTabProps {
  propertyId: string;
  workOrders: WorkOrder[];
  violations: Violation[];
  onRefresh: () => void;
}

const TRADE_TYPES = [
  'General Contractor', 'Electrician', 'Plumber', 'HVAC', 'Roofer',
  'Mason', 'Carpenter', 'Painter', 'Fire Safety', 'Elevator', 'Expeditor', 'Other',
];

export const PropertyWorkOrdersTab = ({ 
  propertyId, 
  workOrders, 
  violations,
  onRefresh 
}: PropertyWorkOrdersTabProps) => {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scope, setScope] = useState('');
  const [linkedViolationId, setLinkedViolationId] = useState<string>('none');
  const [priority, setPriority] = useState<string>('normal');
  const [dueDate, setDueDate] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, WorkOrderMessage[]>>({});
  const [counterAmount, setCounterAmount] = useState<Record<string, string>>({});
  const [showCounter, setShowCounter] = useState<Record<string, boolean>>({});

  // Vendor matching state
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [tradeFilter, setTradeFilter] = useState<string>('all');
  const [vendorSearch, setVendorSearch] = useState('');
  const [sendSms, setSendSms] = useState(false);

  useEffect(() => {
    if (isDialogOpen) {
      fetchVendors();
    }
  }, [isDialogOpen]);

  const fetchVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select('id, name, phone_number, trade_type, coi_expiration_date')
      .eq('status', 'active')
      .order('name');
    setVendors(data || []);
  };

  const fetchMessages = async (workOrderId: string) => {
    const { data } = await supabase
      .from('work_order_messages')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: true });
    setMessages(prev => ({ ...prev, [workOrderId]: data || [] }));
  };

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
      if (!messages[id]) fetchMessages(id);
    }
    setExpandedRows(newSet);
  };

  const handleCreateWorkOrder = async () => {
    if (!scope.trim()) {
      toast.error('Please enter a scope of work');
      return;
    }
    if (selectedVendorIds.length === 0) {
      // Create single work order without vendor
      setIsSubmitting(true);
      try {
        const { error } = await supabase.from('work_orders').insert({
          property_id: propertyId,
          scope,
          linked_violation_id: linkedViolationId !== 'none' ? linkedViolationId : null,
          status: 'open',
          priority,
          due_date: dueDate || null,
        });
        if (error) throw error;
        toast.success('Work order created');
        resetForm();
        onRefresh();
      } catch (error) {
        console.error('Error:', error);
        toast.error('Failed to create work order');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Multi-dispatch: create one work order per vendor
    setIsSubmitting(true);
    try {
      for (const vendorId of selectedVendorIds) {
        const { data: wo, error } = await supabase.from('work_orders').insert({
          property_id: propertyId,
          scope,
          linked_violation_id: linkedViolationId !== 'none' ? linkedViolationId : null,
          vendor_id: vendorId,
          status: sendSms ? 'dispatched' : 'open',
          priority,
          due_date: dueDate || null,
          dispatched_at: sendSms ? new Date().toISOString() : null,
          vendor_notified_via: sendSms ? 'sms' : null,
        }).select().single();
        if (error) throw error;

        // Send SMS to vendor if selected
        if (sendSms && wo) {
          const vendor = vendors.find(v => v.id === vendorId);
          if (vendor?.phone_number) {
            try {
              await supabase.functions.invoke('send-sms', {
                body: {
                  to: vendor.phone_number,
                  message: `New work order request: ${scope.substring(0, 140)}. Please reply with your quote.`,
                },
              });
            } catch (e) {
              console.error('SMS failed for', vendor.name, e);
            }
          }
        }
      }
      toast.success(`${selectedVendorIds.length} work order(s) created${sendSms ? ' & dispatched' : ''}`);
      resetForm();
      onRefresh();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to create work orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsDialogOpen(false);
    setScope('');
    setLinkedViolationId('none');
    setPriority('normal');
    setDueDate('');
    setSelectedVendorIds([]);
    setTradeFilter('all');
    setVendorSearch('');
    setSendSms(false);
  };

  const handleApprove = async (wo: WorkOrder) => {
    try {
      const { error } = await supabase.from('work_orders').update({
        status: 'approved',
        approved_amount: wo.quoted_amount,
        approved_at: new Date().toISOString(),
        approved_by: user?.id,
      }).eq('id', wo.id);
      if (error) throw error;

      // Notify vendor
      if (wo.vendor_id) {
        const vendor = await supabase.from('vendors').select('phone_number, name').eq('id', wo.vendor_id).single();
        if (vendor.data?.phone_number) {
          await supabase.functions.invoke('send-sms', {
            body: { to: vendor.data.phone_number, message: `Your quote of $${wo.quoted_amount} has been approved. Please proceed with the work.` },
          });
        }
      }

      // Log message
      await supabase.from('work_order_messages').insert({
        work_order_id: wo.id,
        sender_type: 'owner',
        sender_name: 'Owner',
        channel: 'in_app',
        message: `Approved quote of $${wo.quoted_amount}`,
      });

      toast.success('Quote approved');
      onRefresh();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to approve');
    }
  };

  const handleReject = async (wo: WorkOrder) => {
    try {
      const { error } = await supabase.from('work_orders').update({
        status: 'open',
        quoted_amount: null,
      }).eq('id', wo.id);
      if (error) throw error;

      if (wo.vendor_id) {
        const vendor = await supabase.from('vendors').select('phone_number').eq('id', wo.vendor_id).single();
        if (vendor.data?.phone_number) {
          await supabase.functions.invoke('send-sms', {
            body: { to: vendor.data.phone_number, message: `Your quote was not accepted. We'll follow up with more details.` },
          });
        }
      }

      await supabase.from('work_order_messages').insert({
        work_order_id: wo.id,
        sender_type: 'owner',
        sender_name: 'Owner',
        channel: 'in_app',
        message: `Rejected quote of $${wo.quoted_amount}`,
      });

      toast.success('Quote rejected');
      onRefresh();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  const handleCounter = async (wo: WorkOrder) => {
    const amount = parseFloat(counterAmount[wo.id]);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    try {
      if (wo.vendor_id) {
        const vendor = await supabase.from('vendors').select('phone_number').eq('id', wo.vendor_id).single();
        if (vendor.data?.phone_number) {
          await supabase.functions.invoke('send-sms', {
            body: { to: vendor.data.phone_number, message: `We'd like to counter at $${amount}. Can you do this?` },
          });
        }
      }

      await supabase.from('work_order_messages').insert({
        work_order_id: wo.id,
        sender_type: 'owner',
        sender_name: 'Owner',
        channel: 'in_app',
        message: `Counter offer: $${amount}`,
      });

      // Reset quoted so vendor can re-quote
      await supabase.from('work_orders').update({
        status: 'dispatched',
        quoted_amount: null,
      }).eq('id', wo.id);

      toast.success('Counter offer sent');
      setShowCounter(prev => ({ ...prev, [wo.id]: false }));
      onRefresh();
    } catch (error) {
      toast.error('Failed to send counter');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('work_orders').update({ status: status as any }).eq('id', id);
      if (error) throw error;
      toast.success('Status updated');
      onRefresh();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500/10 text-blue-600';
      case 'dispatched': return 'bg-orange-500/10 text-orange-600';
      case 'quoted': return 'bg-purple-500/10 text-purple-600';
      case 'approved': return 'bg-emerald-500/10 text-emerald-600';
      case 'in_progress': return 'bg-warning/10 text-warning';
      case 'awaiting_docs': return 'bg-purple-500/10 text-purple-600';
      case 'completed': return 'bg-success/10 text-success';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: 'Open', dispatched: 'Dispatched', quoted: 'Quoted',
      approved: 'Approved', in_progress: 'In Progress',
      awaiting_docs: 'Awaiting Docs', completed: 'Completed',
    };
    return labels[status] || status;
  };

  const getPriorityBadge = (priority: string | null | undefined) => {
    switch (priority) {
      case 'urgent': return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Urgent</Badge>;
      case 'low': return <Badge className="bg-muted text-muted-foreground text-xs">Low</Badge>;
      default: return null;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms': return '📱';
      case 'whatsapp': return '💬';
      default: return '💻';
    }
  };

  const isCoiValid = (date: string | null) => {
    if (!date) return false;
    return new Date(date) > new Date();
  };

  const filteredVendors = vendors.filter(v => {
    if (tradeFilter !== 'all' && v.trade_type !== tradeFilter) return false;
    if (vendorSearch && !v.name.toLowerCase().includes(vendorSearch.toLowerCase())) return false;
    return true;
  });

  const toggleVendor = (id: string) => {
    setSelectedVendorIds(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Create Work Order Button */}
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="w-4 h-4" />
              Create Work Order
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Work Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">🔴 Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Scope of Work *</Label>
                <Textarea value={scope} onChange={e => setScope(e.target.value)} placeholder="Describe the work..." rows={3} />
              </div>

              <div className="space-y-2">
                <Label>Link to Violation (Optional)</Label>
                <Select value={linkedViolationId} onValueChange={setLinkedViolationId}>
                  <SelectTrigger><SelectValue placeholder="Select a violation" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked violation</SelectItem>
                    {violations.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.agency} #{v.violation_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Smart Vendor Matching */}
              <div className="space-y-3 border-t pt-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Find & Dispatch Vendors
                </Label>
                <div className="flex gap-2">
                  <Select value={tradeFilter} onValueChange={setTradeFilter}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Filter by trade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Trades</SelectItem>
                      {TRADE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Search vendors..." value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} className="flex-1" />
                </div>

                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {filteredVendors.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 text-center">No vendors found</p>
                  ) : filteredVendors.map(v => {
                    const coiValid = isCoiValid(v.coi_expiration_date);
                    const selected = selectedVendorIds.includes(v.id);
                    return (
                      <div
                        key={v.id}
                        onClick={() => toggleVendor(v.id)}
                        className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors ${selected ? 'bg-primary/5' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                            {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <div>
                            <span className="font-medium text-sm">{v.name}</span>
                            {v.trade_type && <span className="text-xs text-muted-foreground ml-2">({v.trade_type})</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {v.phone_number ? (
                            <Badge variant="outline" className="text-xs">📱</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">No phone</Badge>
                          )}
                          <Badge variant="outline" className={`text-xs ${coiValid ? 'text-success border-success/30' : 'text-destructive border-destructive/30'}`}>
                            <Shield className="w-3 h-3 mr-1" />
                            COI {coiValid ? '✓' : '✗'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedVendorIds.length > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <input
                      type="checkbox"
                      id="sendSmsDirect"
                      checked={sendSms}
                      onChange={e => setSendSms(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="sendSmsDirect" className="text-sm flex items-center gap-2 cursor-pointer">
                      <Send className="w-4 h-4" />
                      Dispatch via SMS ({selectedVendorIds.length} vendor{selectedVendorIds.length > 1 ? 's' : ''})
                    </label>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button variant="hero" onClick={handleCreateWorkOrder} disabled={isSubmitting || !scope.trim()}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {selectedVendorIds.length > 1 ? `Create ${selectedVendorIds.length} Orders` : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Work Orders List */}
      {workOrders.length > 0 ? (
        <div className="space-y-4">
          {workOrders.map((wo) => {
            const linkedViolation = violations.find(v => v.id === wo.linked_violation_id);
            const expanded = expandedRows.has(wo.id);
            const woMessages = messages[wo.id] || [];
            
            return (
              <div key={wo.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Wrench className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground">{wo.scope}</p>
                          {getPriorityBadge(wo.priority)}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(wo.created_at).toLocaleDateString()}
                          </div>
                          {wo.due_date && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Due: {new Date(wo.due_date).toLocaleDateString()}
                            </div>
                          )}
                          {linkedViolation && (
                            <div className="flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              <Badge variant="outline" className="text-xs">
                                {linkedViolation.agency} #{linkedViolation.violation_number}
                              </Badge>
                            </div>
                          )}
                          {wo.quoted_amount != null && (
                            <div className="flex items-center gap-1 font-semibold text-foreground">
                              <DollarSign className="w-3 h-3" />
                              Quoted: ${wo.quoted_amount.toLocaleString()}
                            </div>
                          )}
                          {wo.approved_amount != null && (
                            <div className="flex items-center gap-1 font-semibold text-success">
                              <Check className="w-3 h-3" />
                              Approved: ${wo.approved_amount.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Approve/Reject buttons for quoted status */}
                      {wo.status === 'quoted' && wo.quoted_amount != null && (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-8 text-success border-success/30 hover:bg-success/10" onClick={() => handleApprove(wo)}>
                            <Check className="w-3 h-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => setShowCounter(prev => ({ ...prev, [wo.id]: !prev[wo.id] }))}>
                            <DollarSign className="w-3 h-3 mr-1" /> Counter
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleReject(wo)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                      <Select value={wo.status} onValueChange={v => updateStatus(wo.id, v as any)}>
                        <SelectTrigger className={`w-36 h-9 ${getStatusColor(wo.status)}`}>
                          <SelectValue>{getStatusLabel(wo.status)}</SelectValue>
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
                    </div>
                  </div>

                  {/* Counter offer input */}
                  {showCounter[wo.id] && (
                    <div className="flex items-center gap-2 mt-3 ml-14">
                      <Input
                        type="number"
                        placeholder="Enter counter amount..."
                        value={counterAmount[wo.id] || ''}
                        onChange={e => setCounterAmount(prev => ({ ...prev, [wo.id]: e.target.value }))}
                        className="w-48"
                      />
                      <Button size="sm" onClick={() => handleCounter(wo)}>Send Counter</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowCounter(prev => ({ ...prev, [wo.id]: false }))}>Cancel</Button>
                    </div>
                  )}
                </div>

                {/* Expandable message thread */}
                <Collapsible open={expanded} onOpenChange={() => toggleRow(wo.id)}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center gap-2 px-5 py-2 text-xs text-muted-foreground hover:bg-muted/50 border-t border-border transition-colors">
                      {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <MessageSquare className="w-3 h-3" />
                      Communication Thread
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-5 pb-4 space-y-2">
                      {woMessages.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No messages yet</p>
                      ) : woMessages.map(msg => (
                        <div key={msg.id} className={`flex gap-2 text-sm ${msg.sender_type === 'vendor' ? '' : 'flex-row-reverse'}`}>
                          <div className={`max-w-[70%] rounded-lg px-3 py-2 ${
                            msg.sender_type === 'vendor' ? 'bg-muted' : 
                            msg.sender_type === 'system' ? 'bg-blue-500/10' : 'bg-primary/10'
                          }`}>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                              <span>{getChannelIcon(msg.channel)}</span>
                              <span className="font-medium">{msg.sender_name || msg.sender_type}</span>
                              <span>·</span>
                              <span>{new Date(msg.created_at).toLocaleString()}</span>
                            </div>
                            <p>{msg.message}</p>
                            {msg.extracted_amount != null && (
                              <Badge className="mt-1 bg-success/10 text-success text-xs">
                                <DollarSign className="w-3 h-3 mr-0.5" />{msg.extracted_amount.toLocaleString()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Wrench className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold text-foreground mb-2">No work orders</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create work orders to track remediation tasks for this property.
          </p>
          <Button variant="hero" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Create Work Order
          </Button>
        </div>
      )}
    </div>
  );
};
