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
  DialogFooter,
  DialogDescription,
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
  FileCheck,
  Camera,
  CreditCard,
  ExternalLink,
  Play,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface Property {
  id: string;
  address: string;
}

interface Vendor {
  id: string;
  name: string;
  zelle_email?: string | null;
  zelle_phone?: string | null;
  payment_preference?: string | null;
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

interface PurchaseOrder {
  id: string;
  po_number: string;
  amount: number;
  status: string;
  owner_signed_at: string | null;
  vendor_signed_at: string | null;
  vendor_sign_token: string;
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
  po_id?: string | null;
  completion_photos?: any[] | null;
  completion_notes?: string | null;
  completed_at?: string | null;
  verified_at?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
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
  const [poData, setPoData] = useState<Record<string, PurchaseOrder>>({});
  const [vendorDetails, setVendorDetails] = useState<Record<string, Vendor>>({});

  // Dispatch state
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  // Completion flow state
  const [completeDialogWO, setCompleteDialogWO] = useState<WorkOrder | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionFiles, setCompletionFiles] = useState<File[]>([]);
  const [uploadingCompletion, setUploadingCompletion] = useState(false);

  // Payment flow state
  const [payDialogWO, setPayDialogWO] = useState<WorkOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('zelle');
  const [paymentReference, setPaymentReference] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

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

  const fetchPOForWorkOrder = async (poId: string) => {
    const { data } = await supabase
      .from('purchase_orders')
      .select('id, po_number, amount, status, owner_signed_at, vendor_signed_at, vendor_sign_token')
      .eq('id', poId)
      .single();
    if (data) {
      setPoData(prev => ({ ...prev, [poId]: data as unknown as PurchaseOrder }));
    }
  };

  const fetchVendorPaymentInfo = async (vendorId: string) => {
    const { data } = await supabase
      .from('vendors')
      .select('id, name, zelle_email, zelle_phone, payment_preference')
      .eq('id', vendorId)
      .single();
    if (data) {
      setVendorDetails(prev => ({ ...prev, [vendorId]: data as unknown as Vendor }));
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
      toast.success(`Quote of $${wo.quoted_amount?.toLocaleString()} approved — generating PO...`);

      // Auto-generate PO
      const { error: poErr } = await supabase.functions.invoke('generate-po', {
        body: { work_order_id: wo.id },
      });
      if (poErr) {
        console.error('PO generation error:', poErr);
        toast.error('Approved but PO generation failed. Try again from the detail view.');
      } else {
        toast.success('Purchase Order created and sent to vendor for signing!');
      }
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

      // Notify vendor via Telegram if they have a chat_id
      if (wo.vendor) {
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('telegram_chat_id')
          .eq('id', wo.vendor.id)
          .single();
        if (vendorData?.telegram_chat_id) {
          await supabase.functions.invoke('send-telegram', {
            body: {
              chat_id: vendorData.telegram_chat_id,
              message: `💰 *Counter Offer*\n\nThe owner has countered your quote for "${wo.scope.substring(0, 80)}" at ${wo.property?.address}.\n\nNew amount: *$${amount.toLocaleString()}*\n\nReply with your new price to counter, or "accept" to agree.`,
            },
          });
        }
      }

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

  // === Dispatch Work Order ===
  const handleDispatch = async (wo: WorkOrder) => {
    if (!wo.vendor) {
      toast.error('Assign a vendor before dispatching');
      return;
    }
    setDispatchingId(wo.id);
    try {
      // 1. Update status to dispatched
      const { error: updateErr } = await supabase
        .from('work_orders')
        .update({ status: 'dispatched' as any, dispatched_at: new Date().toISOString() })
        .eq('id', wo.id);
      if (updateErr) throw updateErr;

      // 2. Get full vendor info for email/phone
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('email, phone_number, name, telegram_chat_id')
        .eq('id', wo.vendor.id)
        .single();

      // 3. Send email notification via edge function
      if (vendorData?.email) {
        await supabase.functions.invoke('send-work-order-notification', {
          body: {
            vendor_email: vendorData.email,
            vendor_name: vendorData.name,
            property_address: wo.property?.address || '',
            scope_of_work: wo.scope,
            work_order_id: wo.id,
          },
        });
      }

      // 4. Send SMS if vendor has a phone and property has SMS enabled
      if (vendorData?.phone_number && wo.property?.id) {
        const { data: propData } = await supabase
          .from('properties')
          .select('sms_enabled, assigned_phone_number')
          .eq('id', wo.property.id)
          .single();
        if (propData?.sms_enabled && propData?.assigned_phone_number) {
          await supabase.functions.invoke('send-sms', {
            body: {
              to: vendorData.phone_number,
              from: propData.assigned_phone_number,
              message: `New work order from CitiSignal: ${wo.property?.address || 'Property'} - ${wo.scope.substring(0, 100)}. Check your email for details.`,
            },
          });
        }
      }

      // 5. Log dispatch in property_activity_log
      if (wo.property?.id) {
        await supabase.from('property_activity_log').insert({
          property_id: wo.property.id,
          activity_type: 'work_order_dispatched',
          title: `Work order dispatched to ${vendorData?.name || wo.vendor.name}`,
          description: wo.scope.substring(0, 200),
        });
      }

      toast.success(`Work order dispatched to ${vendorData?.name || wo.vendor.name}`);
      fetchData();
    } catch (e: any) {
      toast.error('Failed to dispatch: ' + (e.message || ''));
    } finally {
      setDispatchingId(null);
    }
  };

  // === Simulate Vendor Sign ===
  const handleSimulateVendorSign = async (wo: WorkOrder) => {
    if (!wo.po_id) return;
    try {
      // Update PO to fully_executed
      const { error: poErr } = await supabase
        .from('purchase_orders')
        .update({
          vendor_signed_at: new Date().toISOString(),
          status: 'fully_executed' as any,
        })
        .eq('id', wo.po_id);
      if (poErr) throw poErr;

      // Update work order to in_progress
      const { error: woErr } = await supabase
        .from('work_orders')
        .update({ status: 'in_progress' as any })
        .eq('id', wo.id);
      if (woErr) throw woErr;

      toast.success('Vendor signature simulated — PO fully executed, work order now In Progress');
      fetchData();
    } catch { toast.error('Failed to simulate vendor sign'); }
  };

  // === Mark Complete ===
  const handleMarkComplete = async () => {
    if (!completeDialogWO) return;
    setUploadingCompletion(true);
    try {
      // Upload photos
      const photoUrls: string[] = [];
      for (const file of completionFiles) {
        const path = `${completeDialogWO.id}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('work-order-photos')
          .upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from('work-order-photos')
          .getPublicUrl(path);
        photoUrls.push(urlData.publicUrl);
      }

      const { error } = await supabase
        .from('work_orders')
        .update({
          status: 'awaiting_docs' as any,
          completion_photos: photoUrls as any,
          completion_notes: completionNotes || null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', completeDialogWO.id);
      if (error) throw error;

      toast.success('Work marked as complete — awaiting owner verification');
      setCompleteDialogWO(null);
      setCompletionNotes('');
      setCompletionFiles([]);
      fetchData();
    } catch (e: any) {
      toast.error('Failed to mark complete: ' + (e.message || ''));
    } finally {
      setUploadingCompletion(false);
    }
  };

  // === Verify & Pay ===
  const handleVerifyAndPay = async () => {
    if (!payDialogWO) return;
    setProcessingPayment(true);
    try {
      const wo = workOrders.find(w => w.id === payDialogWO.id);
      const { error } = await supabase
        .from('work_orders')
        .update({
          status: 'completed' as any,
          verified_at: new Date().toISOString(),
          payment_method: paymentMethod as any,
          payment_status: 'paid' as any,
          payment_reference: paymentReference || null,
          paid_at: new Date().toISOString(),
        })
        .eq('id', payDialogWO.id);
      if (error) throw error;

      // Send vendor payment notification via Telegram
      if (wo?.vendor?.id) {
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('telegram_chat_id, name')
          .eq('id', wo.vendor.id)
          .single();
        if (vendorData?.telegram_chat_id) {
          const amount = wo.approved_amount || wo.quoted_amount || 0;
          const methodLabel = paymentMethod === 'zelle' ? 'Zelle' : paymentMethod === 'check' ? 'Check' : paymentMethod === 'stripe' ? 'Stripe' : 'Other';
          await supabase.functions.invoke('send-telegram', {
            body: {
              chat_id: vendorData.telegram_chat_id,
              message: `💵 *Payment Sent*\n\nPayment of *$${amount.toLocaleString()}* has been sent via *${methodLabel}*${paymentReference ? ` (Ref: ${paymentReference})` : ''} for work at *${wo.property?.address}*.\n\nScope: ${wo.scope.substring(0, 100)}`,
            },
          });
        }
      }

      toast.success('Work verified and payment recorded!');
      setPayDialogWO(null);
      setPaymentReference('');
      fetchData();
    } catch {
      toast.error('Failed to process payment');
    } finally {
      setProcessingPayment(false);
    }
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

      const orders = workOrdersRes.data as unknown as WorkOrder[] || [];
      setWorkOrders(orders);
      setProperties(propertiesRes.data || []);
      setVendors(vendorsRes.data || []);
      setViolations(violationsRes.data || []);

      // Fetch PO data for orders that have po_id
      orders.forEach(wo => {
        if (wo.po_id) fetchPOForWorkOrder(wo.po_id);
        if (wo.vendor?.id) fetchVendorPaymentInfo(wo.vendor.id);
      });
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
              {filteredWorkOrders.map((workOrder) => {
                const po = workOrder.po_id ? poData[workOrder.po_id] : null;
                const vendor = workOrder.vendor?.id ? vendorDetails[workOrder.vendor.id] : null;

                return (
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

                          {/* Approved + Dispatch / PO Pending Vendor Sign */}
                          {workOrder.status === 'approved' && workOrder.approved_amount != null && (
                            <div className="mt-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
                              <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                  Approved: ${workOrder.approved_amount.toLocaleString()}
                                </span>
                                {workOrder.po_id && (
                                  <Badge className="bg-emerald-100 text-emerald-700 ml-2">PO Generated</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {/* Dispatch Button */}
                                <Button
                                  size="sm"
                                  className="bg-orange-600 hover:bg-orange-700 text-white"
                                  onClick={() => handleDispatch(workOrder)}
                                  disabled={dispatchingId === workOrder.id}
                                >
                                  {dispatchingId === workOrder.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                                  Dispatch to Vendor
                                </Button>
                                {workOrder.po_id && (
                                  <>
                                    <p className="text-sm text-muted-foreground">
                                      PO sent to vendor for signing.
                                    </p>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                                      onClick={() => handleSimulateVendorSign(workOrder)}
                                    >
                                      <Play className="w-3 h-3 mr-1" />
                                      Simulate Vendor Sign
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Fully Executed PO Card */}
                          {po && po.status === 'fully_executed' && (
                            <Card className="mt-4 border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-800">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <FileCheck className="w-5 h-5 text-emerald-600" />
                                    <span className="font-bold text-emerald-700 dark:text-emerald-300 text-lg">
                                      {po.po_number}
                                    </span>
                                    <Badge className="bg-emerald-600 text-white">Fully Executed</Badge>
                                  </div>
                                  <a
                                    href={`/sign-po/${po.vendor_sign_token}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary flex items-center gap-1 hover:underline"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View PO
                                  </a>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Amount</span>
                                    <p className="font-bold text-lg">${po.amount.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Owner Signed</span>
                                    <p className="font-medium">{po.owner_signed_at ? new Date(po.owner_signed_at).toLocaleDateString() : '—'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Vendor Signed</span>
                                    <p className="font-medium">{po.vendor_signed_at ? new Date(po.vendor_signed_at).toLocaleDateString() : '—'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Status</span>
                                    <p className="font-medium text-emerald-600">✓ Both parties signed</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* In Progress — Mark Complete Button */}
                          {workOrder.status === 'in_progress' && (
                            <div className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 text-amber-600" />
                                  <span className="font-medium text-amber-700 dark:text-amber-300">Work In Progress</span>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => { setCompleteDialogWO(workOrder); setCompletionNotes(''); setCompletionFiles([]); }}
                                  className="bg-primary"
                                >
                                  <Camera className="w-3 h-3 mr-1" />
                                  Mark Complete
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Awaiting Docs — Photos + Verify & Pay */}
                          {workOrder.status === 'awaiting_docs' && (
                            <div className="mt-4 p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <ImageIcon className="w-4 h-4 text-blue-600" />
                                  <span className="font-medium text-blue-700 dark:text-blue-300">Completion Submitted — Awaiting Verification</span>
                                </div>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => {
                                    setPayDialogWO(workOrder);
                                    setPaymentMethod(vendor?.payment_preference || 'zelle');
                                    setPaymentReference('');
                                  }}
                                >
                                  <CreditCard className="w-3 h-3 mr-1" />
                                  Verify & Pay
                                </Button>
                              </div>
                              {workOrder.completion_notes && (
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium">Vendor notes:</span> {workOrder.completion_notes}
                                </p>
                              )}
                              {Array.isArray(workOrder.completion_photos) && workOrder.completion_photos.length > 0 && (
                                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                                  {(workOrder.completion_photos as string[]).map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                      <img
                                        src={url}
                                        alt={`Completion photo ${i + 1}`}
                                        className="w-full h-24 object-cover rounded-lg border border-border hover:opacity-80 transition"
                                      />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Completed — Payment Info */}
                          {workOrder.status === 'completed' && (
                            <div className="mt-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
                              <div className="flex items-center gap-2 mb-2">
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                  Work Completed & Verified
                                </span>
                                {workOrder.payment_status === 'paid' && (
                                  <Badge className="bg-emerald-600 text-white">Paid</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                {workOrder.completed_at && (
                                  <div>
                                    <span className="text-muted-foreground">Completed</span>
                                    <p className="font-medium">{new Date(workOrder.completed_at).toLocaleDateString()}</p>
                                  </div>
                                )}
                                {workOrder.verified_at && (
                                  <div>
                                    <span className="text-muted-foreground">Verified</span>
                                    <p className="font-medium">{new Date(workOrder.verified_at).toLocaleDateString()}</p>
                                  </div>
                                )}
                                {workOrder.payment_method && (
                                  <div>
                                    <span className="text-muted-foreground">Payment</span>
                                    <p className="font-medium capitalize">{workOrder.payment_method}</p>
                                  </div>
                                )}
                                {workOrder.payment_reference && (
                                  <div>
                                    <span className="text-muted-foreground">Reference</span>
                                    <p className="font-medium">{workOrder.payment_reference}</p>
                                  </div>
                                )}
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
                );
              })}
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

      {/* Mark Complete Dialog */}
      <Dialog open={!!completeDialogWO} onOpenChange={(open) => !open && setCompleteDialogWO(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Work Complete</DialogTitle>
            <DialogDescription>Upload completion photos and add notes before submitting.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Completion Photos</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setCompletionFiles(Array.from(e.target.files || []))}
                  className="hidden"
                  id="completion-photos"
                />
                <label htmlFor="completion-photos" className="cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload photos</p>
                </label>
                {completionFiles.length > 0 && (
                  <p className="text-sm text-primary mt-2">{completionFiles.length} file(s) selected</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Describe the completed work..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCompleteDialogWO(null)}>Cancel</Button>
            <Button onClick={handleMarkComplete} disabled={uploadingCompletion}>
              {uploadingCompletion ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              Submit Completion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify & Pay Dialog */}
      <Dialog open={!!payDialogWO} onOpenChange={(open) => !open && setPayDialogWO(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Verify Work & Pay Vendor</DialogTitle>
            <DialogDescription>Confirm work is satisfactory and record payment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {payDialogWO && (() => {
              const payWO = workOrders.find(w => w.id === payDialogWO.id);
              const payVendorId = payWO?.vendor?.id;
              const payVendor = payVendorId ? vendorDetails[payVendorId] : null;
              const payAmount = payWO?.approved_amount || payWO?.quoted_amount || 0;
              return (
                <>
                  {payVendor && (
                    <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                      <p><span className="text-muted-foreground">Vendor:</span> <span className="font-medium">{payVendor.name}</span></p>
                      <p><span className="text-muted-foreground">Amount:</span> <span className="font-bold text-lg">${payAmount.toLocaleString()}</span></p>
                    </div>
                  )}
                </>
              );
            })()}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="stripe">Stripe (coming soon)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mock Zelle Payment Flow */}
            {paymentMethod === 'zelle' && payDialogWO && (() => {
              const payWO = workOrders.find(w => w.id === payDialogWO.id);
              const payVendorId = payWO?.vendor?.id;
              const payVendor = payVendorId ? vendorDetails[payVendorId] : null;
              const payAmount = payWO?.approved_amount || payWO?.quoted_amount || 0;
              return (
                <div className="p-4 rounded-lg border-2 border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">Z</span>
                    </div>
                    <span className="font-semibold text-purple-700 dark:text-purple-300">Send via Zelle</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 rounded bg-background border border-border">
                      <span className="text-muted-foreground">Send to</span>
                      <span className="font-medium">{payVendor?.zelle_email || payVendor?.zelle_phone || 'Not configured'}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-background border border-border">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-bold text-lg">${payAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-background border border-border">
                      <span className="text-muted-foreground">Memo</span>
                      <span className="font-medium text-xs">WO - {payWO?.scope?.substring(0, 30)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Zelle Confirmation Number</Label>
                    <Input
                      placeholder="Enter Zelle confirmation #..."
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Check Payment Flow */}
            {paymentMethod === 'check' && (
              <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-700 space-y-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-700 dark:text-blue-300">Check Payment</span>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Check Number</Label>
                  <Input
                    placeholder="Enter check number..."
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Stripe / Other */}
            {paymentMethod === 'stripe' && (
              <div className="p-4 rounded-lg border border-border bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">Stripe payment integration coming soon.</p>
              </div>
            )}

            {paymentMethod === 'other' && (
              <div className="space-y-2">
                <Label>Payment Reference</Label>
                <Input
                  placeholder="Enter reference..."
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPayDialogWO(null)}>Cancel</Button>
            <Button onClick={handleVerifyAndPay} disabled={processingPayment || paymentMethod === 'stripe'} className="bg-emerald-600 hover:bg-emerald-700">
              {processingPayment ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CreditCard className="w-4 h-4 mr-1" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkOrdersPage;
