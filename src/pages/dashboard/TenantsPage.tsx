import { useState } from "react";
import { Users, Plus, Pencil, Trash2, Loader2, AlertTriangle, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { differenceInDays, format, parseISO } from "date-fns";

const EMPTY_FORM = {
  property_id: "",
  company_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  unit_number: "",
  lease_start: "",
  lease_end: "",
  rent_amount: "",
  escalation_notes: "",
  renewal_option_date: "",
  security_deposit: "",
  lease_type: "gross",
  status: "active",
  notes: "",
};

const TenantsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");

  const { data: properties } = useQuery({
    queryKey: ["properties-list", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id, address").order("address");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["all-tenants", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*, properties(id, address)")
        .order("company_name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        property_id: form.property_id,
        company_name: form.company_name.trim(),
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        unit_number: form.unit_number || null,
        lease_start: form.lease_start || null,
        lease_end: form.lease_end || null,
        rent_amount: form.rent_amount ? parseFloat(form.rent_amount) : null,
        escalation_notes: form.escalation_notes || null,
        renewal_option_date: form.renewal_option_date || null,
        security_deposit: form.security_deposit ? parseFloat(form.security_deposit) : null,
        lease_type: form.lease_type,
        status: form.status,
        notes: form.notes || null,
      };
      const { error } = editingId
        ? await supabase.from("tenants").update(payload).eq("id", editingId)
        : await supabase.from("tenants").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editingId ? "Tenant updated" : "Tenant added");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["all-tenants"] });
    },
    onError: () => toast.error("Failed to save tenant"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tenant removed");
      queryClient.invalidateQueries({ queryKey: ["all-tenants"] });
    },
    onError: () => toast.error("Failed to delete tenant"),
  });

  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setDialogOpen(true); };
  const openEdit = (t: any) => {
    setForm({
      property_id: t.property_id,
      company_name: t.company_name,
      contact_name: t.contact_name || "",
      contact_email: t.contact_email || "",
      contact_phone: t.contact_phone || "",
      unit_number: t.unit_number || "",
      lease_start: t.lease_start || "",
      lease_end: t.lease_end || "",
      rent_amount: t.rent_amount?.toString() || "",
      escalation_notes: t.escalation_notes || "",
      renewal_option_date: t.renewal_option_date || "",
      security_deposit: t.security_deposit?.toString() || "",
      lease_type: t.lease_type || "gross",
      status: t.status,
      notes: t.notes || "",
    });
    setEditingId(t.id);
    setDialogOpen(true);
  };

  const setField = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const getLeaseStatusBadge = (t: any) => {
    if (!t.lease_end) return null;
    const days = differenceInDays(parseISO(t.lease_end), new Date());
    if (days < 0) return <Badge variant="destructive" className="text-[10px]">Expired</Badge>;
    if (days <= 30) return <Badge className="bg-destructive/80 text-destructive-foreground text-[10px]">{days}d left</Badge>;
    if (days <= 90) return <Badge className="bg-warning/80 text-warning-foreground text-[10px]">{days}d left</Badge>;
    return null;
  };

  const filtered = (tenants || []).filter(t =>
    !search || t.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.properties?.address?.toLowerCase().includes(search.toLowerCase())
  );

  const activeTenants = (tenants || []).filter(t => t.status === "active");
  const totalRent = activeTenants.reduce((s, t) => s + (t.rent_amount || 0), 0);
  const expiringCount = activeTenants.filter(t => t.lease_end && differenceInDays(parseISO(t.lease_end), new Date()) <= 90).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Tenants</h1>
            <p className="text-sm text-muted-foreground">All tenants across your properties</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew} disabled={!properties?.length}>
              <Plus className="w-4 h-4 mr-1" /> Add Tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Edit Tenant" : "Add Tenant"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Property *</Label>
                <Select value={form.property_id} onValueChange={v => setField("property_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {(properties || []).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Company Name *</Label><Input value={form.company_name} onChange={e => setField("company_name", e.target.value)} /></div>
              <div><Label>Unit / Suite</Label><Input value={form.unit_number} onChange={e => setField("unit_number", e.target.value)} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setField("contact_name", e.target.value)} /></div>
              <div><Label>Contact Email</Label><Input type="email" value={form.contact_email} onChange={e => setField("contact_email", e.target.value)} /></div>
              <div><Label>Contact Phone</Label><Input value={form.contact_phone} onChange={e => setField("contact_phone", e.target.value)} /></div>
              <div><Label>Lease Type</Label>
                <Select value={form.lease_type} onValueChange={v => setField("lease_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gross">Gross</SelectItem>
                    <SelectItem value="nnn">NNN</SelectItem>
                    <SelectItem value="modified_gross">Modified Gross</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Lease Start</Label><Input type="date" value={form.lease_start} onChange={e => setField("lease_start", e.target.value)} /></div>
              <div><Label>Lease End</Label><Input type="date" value={form.lease_end} onChange={e => setField("lease_end", e.target.value)} /></div>
              <div><Label>Monthly Rent ($)</Label><Input type="number" value={form.rent_amount} onChange={e => setField("rent_amount", e.target.value)} /></div>
              <div><Label>Security Deposit ($)</Label><Input type="number" value={form.security_deposit} onChange={e => setField("security_deposit", e.target.value)} /></div>
              <div><Label>Renewal Option Date</Label><Input type="date" value={form.renewal_option_date} onChange={e => setField("renewal_option_date", e.target.value)} /></div>
              <div className="col-span-2"><Label>Escalation Notes</Label><Textarea value={form.escalation_notes} onChange={e => setField("escalation_notes", e.target.value)} className="min-h-[60px]" /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setField("notes", e.target.value)} className="min-h-[60px]" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.company_name.trim() || !form.property_id}
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {editingId ? "Update" : "Add"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 pb-4 text-center">
          <div className="text-2xl font-bold text-foreground">{activeTenants.length}</div>
          <div className="text-xs text-muted-foreground">Active Tenants</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <div className="text-2xl font-bold text-foreground">${totalRent.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Monthly Rent Roll</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <div className={`text-2xl font-bold ${expiringCount > 0 ? "text-warning" : "text-foreground"}`}>{expiringCount}</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            {expiringCount > 0 && <AlertTriangle className="w-3 h-3 text-warning" />}
            Leases Expiring ≤90d
          </div>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search tenants…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : !filtered.length ? (
        <Card><CardContent className="py-12 text-center">
          <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{search ? "No tenants match your search." : "No tenants yet. Click Add Tenant to get started."}</p>
        </CardContent></Card>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Lease End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.company_name}</div>
                    {t.contact_name && <div className="text-xs text-muted-foreground">{t.contact_name}</div>}
                  </TableCell>
                  <TableCell>
                    {t.properties ? (
                      <Link to={`/dashboard/properties/${t.properties.id}`} className="text-primary hover:underline text-sm">
                        {t.properties.address}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{t.unit_number || "—"}</TableCell>
                  <TableCell className="text-sm">{t.rent_amount ? `$${t.rent_amount.toLocaleString()}` : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{t.lease_end ? format(parseISO(t.lease_end), "MMM d, yyyy") : "—"}</span>
                      {getLeaseStatusBadge(t)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.status === "active" ? "default" : t.status === "pending" ? "secondary" : "outline"} className="text-[10px]">
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default TenantsPage;
