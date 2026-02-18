import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ArrowLeft,
  Users,
  Phone,
  Mail,
  FileCheck,
  Star,
  ClipboardList,
  DollarSign,
  Building2,
  Calendar,
  MessageCircle,
  Plus,
  Loader2,
  AlertCircle,
  TrendingUp,
  Clock,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

interface Vendor {
  id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  trade_type: string | null;
  coi_expiration_date: string | null;
  status: string;
  license_number: string | null;
  notes: string | null;
  address: string | null;
  telegram_chat_id: number | null;
  avg_rating: number;
  total_reviews: number;
  total_spent: number;
  created_at: string;
}

interface WorkOrder {
  id: string;
  scope: string;
  status: string;
  created_at: string;
  quoted_amount: number | null;
  approved_amount: number | null;
  priority: string | null;
  property: { id: string; address: string } | null;
}

interface Review {
  id: string;
  rating: number;
  title: string | null;
  review_text: string | null;
  quality_rating: number | null;
  timeliness_rating: number | null;
  communication_rating: number | null;
  value_rating: number | null;
  created_at: string;
  work_order_id: string | null;
  property_id: string | null;
}

const TRADE_TYPES = [
  'Plumber', 'Electrician', 'HVAC', 'General Contractor', 'Roofer',
  'Mason', 'Painter', 'Carpenter', 'Elevator', 'Fire Safety', 'Other'
];

const VendorDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '', phone_number: '', email: '', trade_type: '',
    coi_expiration_date: '', license_number: '', notes: '', address: '',
  });

  const [reviewForm, setReviewForm] = useState({
    rating: '5', title: '', review_text: '',
    quality_rating: '5', timeliness_rating: '5',
    communication_rating: '5', value_rating: '5',
    work_order_id: '',
  });

  const fetchVendor = useCallback(async () => {
    if (!id || !user) return;
    try {
      const [vendorRes, woRes, reviewsRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', id).single(),
        supabase.from('work_orders')
          .select('id, scope, status, created_at, quoted_amount, approved_amount, priority, property:properties(id, address)')
          .eq('vendor_id', id)
          .order('created_at', { ascending: false }),
        supabase.from('vendor_reviews').select('*').eq('vendor_id', id).order('created_at', { ascending: false }),
      ]);

      if (vendorRes.error) throw vendorRes.error;
      const v = vendorRes.data as unknown as Vendor;
      setVendor(v);
      setEditForm({
        name: v.name, phone_number: v.phone_number || '', email: v.email || '',
        trade_type: v.trade_type || '', coi_expiration_date: v.coi_expiration_date || '',
        license_number: v.license_number || '', notes: v.notes || '', address: v.address || '',
      });
      setWorkOrders((woRes.data || []) as unknown as WorkOrder[]);
      setReviews((reviewsRes.data || []) as unknown as Review[]);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load vendor');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { fetchVendor(); }, [fetchVendor]);

  const handleSaveProfile = async () => {
    if (!vendor) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('vendors').update({
        name: editForm.name,
        phone_number: editForm.phone_number || null,
        email: editForm.email || null,
        trade_type: editForm.trade_type || null,
        coi_expiration_date: editForm.coi_expiration_date || null,
        license_number: editForm.license_number || null,
        notes: editForm.notes || null,
        address: editForm.address || null,
      }).eq('id', vendor.id);
      if (error) throw error;
      toast.success('Vendor updated');
      setIsEditing(false);
      fetchVendor();
    } catch { toast.error('Failed to update'); }
    finally { setIsSaving(false); }
  };

  const handleSubmitReview = async () => {
    if (!vendor || !user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('vendor_reviews').insert({
        vendor_id: vendor.id,
        user_id: user.id,
        rating: parseInt(reviewForm.rating),
        title: reviewForm.title || null,
        review_text: reviewForm.review_text || null,
        quality_rating: parseInt(reviewForm.quality_rating) || null,
        timeliness_rating: parseInt(reviewForm.timeliness_rating) || null,
        communication_rating: parseInt(reviewForm.communication_rating) || null,
        value_rating: parseInt(reviewForm.value_rating) || null,
        work_order_id: reviewForm.work_order_id || null,
      });
      if (error) throw error;
      toast.success('Review submitted');
      setIsReviewDialogOpen(false);
      setReviewForm({ rating: '5', title: '', review_text: '', quality_rating: '5', timeliness_rating: '5', communication_rating: '5', value_rating: '5', work_order_id: '' });
      fetchVendor();
    } catch { toast.error('Failed to submit review'); }
    finally { setIsSaving(false); }
  };

  const isCoiExpired = (date: string | null) => date ? new Date(date) < new Date() : false;
  const isCoiExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const days = Math.floor((new Date(date).getTime() - Date.now()) / 86400000);
    return days <= 30 && days > 0;
  };

  const statusColors: Record<string, string> = {
    open: 'bg-destructive/10 text-destructive',
    dispatched: 'bg-orange-500/10 text-orange-600',
    quoted: 'bg-purple-500/10 text-purple-600',
    approved: 'bg-emerald-500/10 text-emerald-600',
    in_progress: 'bg-warning/10 text-warning',
    completed: 'bg-success/10 text-success',
  };

  const completedWOs = workOrders.filter(wo => wo.status === 'completed');
  const activeWOs = workOrders.filter(wo => !['completed', 'cancelled'].includes(wo.status));
  const totalSpent = workOrders.reduce((sum, wo) => sum + (wo.approved_amount || 0), 0);
  const avgQuote = workOrders.filter(wo => wo.quoted_amount).length > 0
    ? workOrders.reduce((sum, wo) => sum + (wo.quoted_amount || 0), 0) / workOrders.filter(wo => wo.quoted_amount).length
    : 0;
  const completionRate = workOrders.length > 0 ? Math.round((completedWOs.length / workOrders.length) * 100) : 0;

  const renderStars = (rating: number, size = 'w-4 h-4') => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${size} ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!vendor) {
    return <div className="text-center py-16"><AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" /><p>Vendor not found</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/vendors')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">{vendor.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  {vendor.trade_type && <Badge variant="secondary">{vendor.trade_type}</Badge>}
                  {vendor.avg_rating > 0 && (
                    <div className="flex items-center gap-1">
                      {renderStars(Math.round(vendor.avg_rating), 'w-3 h-3')}
                      <span className="text-sm text-muted-foreground">({vendor.total_reviews})</span>
                    </div>
                  )}
                  {vendor.telegram_chat_id && (
                    <Badge variant="outline" className="text-xs"><MessageCircle className="w-3 h-3 mr-1" />Telegram</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
          <Pencil className="w-4 h-4 mr-1" /> {isEditing ? 'Cancel' : 'Edit'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><ClipboardList className="w-4 h-4" /> Total Jobs</div>
            <p className="text-2xl font-bold">{workOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><CheckCircle2 className="w-4 h-4" /> Completed</div>
            <p className="text-2xl font-bold">{completedWOs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><TrendingUp className="w-4 h-4" /> Completion Rate</div>
            <p className="text-2xl font-bold">{completionRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><DollarSign className="w-4 h-4" /> Total Spent</div>
            <p className="text-2xl font-bold">${totalSpent.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><DollarSign className="w-4 h-4" /> Avg Quote</div>
            <p className="text-2xl font-bold">${Math.round(avgQuote).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="projects">Projects ({workOrders.length})</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Contact Information</CardTitle></CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Trade Type</Label>
                    <Select value={editForm.trade_type} onValueChange={v => setEditForm({ ...editForm, trade_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{TRADE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={editForm.phone_number} onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>License #</Label>
                    <Input value={editForm.license_number} onChange={e => setEditForm({ ...editForm, license_number: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>COI Expiration</Label>
                    <Input type="date" value={editForm.coi_expiration_date} onChange={e => setEditForm({ ...editForm, coi_expiration_date: e.target.value })} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes</Label>
                    <Textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="min-h-[80px]" />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button onClick={handleSaveProfile} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    {vendor.phone_number && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{vendor.phone_number}</span>
                      </div>
                    )}
                    {vendor.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{vendor.email}</span>
                      </div>
                    )}
                    {vendor.address && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span>{vendor.address}</span>
                      </div>
                    )}
                    {vendor.license_number && (
                      <div className="flex items-center gap-2 text-sm">
                        <FileCheck className="w-4 h-4 text-muted-foreground" />
                        <span>License: {vendor.license_number}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-muted-foreground">COI Status</span>
                      <div className="flex items-center gap-2 mt-1">
                        <FileCheck className={`w-4 h-4 ${
                          isCoiExpired(vendor.coi_expiration_date) ? 'text-destructive' :
                          isCoiExpiringSoon(vendor.coi_expiration_date) ? 'text-warning' :
                          vendor.coi_expiration_date ? 'text-success' : 'text-muted-foreground'
                        }`} />
                        <span className="font-medium">
                          {isCoiExpired(vendor.coi_expiration_date) ? 'Expired' :
                           isCoiExpiringSoon(vendor.coi_expiration_date) ? 'Expiring Soon' :
                           vendor.coi_expiration_date ? `Valid until ${new Date(vendor.coi_expiration_date).toLocaleDateString()}` :
                           'Not on file'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Member Since</span>
                      <p className="font-medium">{new Date(vendor.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div>
                    {vendor.notes && (
                      <div>
                        <span className="text-sm text-muted-foreground">Notes</span>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{vendor.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          {activeWOs.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Clock className="w-5 h-5" /> Active ({activeWOs.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {activeWOs.map(wo => (
                  <div key={wo.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{wo.scope}</p>
                      {wo.property && <p className="text-xs text-muted-foreground mt-0.5">{wo.property.address}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {wo.quoted_amount != null && <span className="text-sm font-medium">${wo.quoted_amount.toLocaleString()}</span>}
                      <Badge variant="outline" className={statusColors[wo.status] || ''}>
                        {wo.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> All Projects</CardTitle></CardHeader>
            <CardContent>
              {workOrders.length > 0 ? (
                <div className="space-y-3">
                  {workOrders.map(wo => (
                    <div key={wo.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-clamp-1">{wo.scope}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {wo.property && <span className="text-xs text-muted-foreground">{wo.property.address}</span>}
                          <span className="text-xs text-muted-foreground">{new Date(wo.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {(wo.approved_amount ?? wo.quoted_amount) != null && (
                          <span className="text-sm font-semibold">${(wo.approved_amount ?? wo.quoted_amount)!.toLocaleString()}</span>
                        )}
                        <Badge variant="outline" className={statusColors[wo.status] || ''}>
                          {wo.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-6">No projects yet</p>
              )}
            </CardContent>
          </Card>

          {/* Properties worked on */}
          {(() => {
            const propMap = new Map<string, { address: string; count: number }>();
            workOrders.forEach(wo => {
              if (wo.property) {
                const existing = propMap.get(wo.property.id);
                propMap.set(wo.property.id, { address: wo.property.address, count: (existing?.count || 0) + 1 });
              }
            });
            const props = Array.from(propMap.entries());
            if (props.length === 0) return null;
            return (
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Building2 className="w-5 h-5" /> Properties Worked On ({props.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {props.map(([propId, { address, count }]) => (
                      <div key={propId} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{address}</span>
                        </div>
                        <Badge variant="secondary">{count} job{count > 1 ? 's' : ''}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {vendor.avg_rating > 0 ? (
                <>
                  <span className="text-3xl font-bold">{vendor.avg_rating.toFixed(1)}</span>
                  {renderStars(Math.round(vendor.avg_rating))}
                  <span className="text-muted-foreground">({vendor.total_reviews} review{vendor.total_reviews !== 1 ? 's' : ''})</span>
                </>
              ) : (
                <span className="text-muted-foreground">No reviews yet</span>
              )}
            </div>
            <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="hero"><Plus className="w-4 h-4 mr-1" /> Add Review</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Review {vendor.name}</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Overall Rating *</Label>
                    <Select value={reviewForm.rating} onValueChange={v => setReviewForm({ ...reviewForm, rating: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[5, 4, 3, 2, 1].map(r => <SelectItem key={r} value={String(r)}>{r} Star{r > 1 ? 's' : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'quality_rating', label: 'Quality' },
                      { key: 'timeliness_rating', label: 'Timeliness' },
                      { key: 'communication_rating', label: 'Communication' },
                      { key: 'value_rating', label: 'Value' },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label}</Label>
                        <Select value={(reviewForm as any)[key]} onValueChange={v => setReviewForm({ ...reviewForm, [key]: v })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[5, 4, 3, 2, 1].map(r => <SelectItem key={r} value={String(r)}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input placeholder="e.g. Great work on plumbing repairs" value={reviewForm.title} onChange={e => setReviewForm({ ...reviewForm, title: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Review</Label>
                    <Textarea placeholder="Your experience..." value={reviewForm.review_text} onChange={e => setReviewForm({ ...reviewForm, review_text: e.target.value })} className="min-h-[80px]" />
                  </div>
                  {workOrders.length > 0 && (
                    <div className="space-y-2">
                      <Label>Related Work Order (optional)</Label>
                      <Select value={reviewForm.work_order_id} onValueChange={v => setReviewForm({ ...reviewForm, work_order_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {workOrders.map(wo => <SelectItem key={wo.id} value={wo.id}>{wo.scope.substring(0, 60)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmitReview} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Review'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map(review => (
                <Card key={review.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        {review.title && <p className="font-semibold">{review.title}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          {renderStars(review.rating, 'w-3 h-3')}
                          <span className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    {review.review_text && <p className="text-sm mt-2">{review.review_text}</p>}
                    <div className="flex flex-wrap gap-3 mt-3">
                      {review.quality_rating && <Badge variant="outline" className="text-xs">Quality: {review.quality_rating}/5</Badge>}
                      {review.timeliness_rating && <Badge variant="outline" className="text-xs">Timeliness: {review.timeliness_rating}/5</Badge>}
                      {review.communication_rating && <Badge variant="outline" className="text-xs">Communication: {review.communication_rating}/5</Badge>}
                      {review.value_rating && <Badge variant="outline" className="text-xs">Value: {review.value_rating}/5</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Star className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No reviews yet. Add a review to track this vendor's performance.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VendorDetailPage;
