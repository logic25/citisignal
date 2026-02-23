import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, DollarSign, Building2, Users, TrendingUp, ChevronDown, ChevronRight, Pencil, Trash2, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

const CAM_CATEGORIES = [
  { value: 'insurance', label: 'Insurance' },
  { value: 'taxes', label: 'Real Estate Taxes' },
  { value: 'maintenance', label: 'Maintenance & Repairs' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'management', label: 'Management Fee' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'snow_removal', label: 'Snow Removal' },
  { value: 'security', label: 'Security' },
  { value: 'janitorial', label: 'Janitorial' },
  { value: 'reserves', label: 'Capital Reserves' },
  { value: 'other', label: 'Other' },
];

const ALLOCATION_METHODS = [
  { value: 'pro_rata_sqft', label: 'Pro-Rata (by Sq Ft)' },
  { value: 'fixed_amount', label: 'Fixed Amount' },
  { value: 'percentage', label: 'Fixed Percentage' },
];

export default function CAMPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedBudget, setExpandedBudget] = useState<string | null>(null);
  const [showCreateBudget, setShowCreateBudget] = useState(false);
  const [showAddLineItem, setShowAddLineItem] = useState<string | null>(null);
  const [showAllocations, setShowAllocations] = useState<string | null>(null);
  const [newBudget, setNewBudget] = useState({ property_id: '', budget_year: new Date().getFullYear(), name: 'Annual CAM Budget' });
  const [newLineItem, setNewLineItem] = useState({ category: '', description: '', budgeted_amount: 0 });
  const [newAllocation, setNewAllocation] = useState({ tenant_id: '', allocation_method: 'pro_rata_sqft', tenant_sqft: 0, fixed_amount: 0, allocation_percentage: 0 });

  // Fetch properties
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('id, address, building_area_sqft').order('address');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch CAM budgets with line items
  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['cam-budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cam_budgets')
        .select('*, property:properties(id, address, building_area_sqft)')
        .order('budget_year', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Fetch line items for expanded budget
  const { data: lineItems = [] } = useQuery({
    queryKey: ['cam-line-items', expandedBudget],
    queryFn: async () => {
      if (!expandedBudget) return [];
      const { data, error } = await supabase.from('cam_line_items').select('*').eq('budget_id', expandedBudget).order('category');
      if (error) throw error;
      return data;
    },
    enabled: !!expandedBudget,
  });

  // Fetch allocations for expanded budget
  const { data: allocations = [] } = useQuery({
    queryKey: ['cam-allocations', showAllocations],
    queryFn: async () => {
      if (!showAllocations) return [];
      const { data, error } = await supabase
        .from('cam_tenant_allocations')
        .select('*, tenant:tenants(id, company_name, unit_number)')
        .eq('budget_id', showAllocations);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!showAllocations,
  });

  // Fetch tenants for the selected property
  const selectedPropertyId = budgets.find(b => b.id === (showAllocations || expandedBudget))?.property_id;
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return [];
      const { data, error } = await supabase.from('tenants').select('*').eq('property_id', selectedPropertyId).eq('status', 'active');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPropertyId,
  });

  // Create budget
  const createBudget = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('cam_budgets').insert({
        ...newBudget,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cam-budgets'] });
      setShowCreateBudget(false);
      setNewBudget({ property_id: '', budget_year: new Date().getFullYear(), name: 'Annual CAM Budget' });
      toast.success('CAM budget created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Add line item
  const addLineItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('cam_line_items').insert({
        budget_id: showAddLineItem!,
        ...newLineItem,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cam-line-items', expandedBudget] });
      recalcBudgetTotal();
      setShowAddLineItem(null);
      setNewLineItem({ category: '', description: '', budgeted_amount: 0 });
      toast.success('Line item added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Add tenant allocation
  const addAllocation = useMutation({
    mutationFn: async () => {
      const budget = budgets.find(b => b.id === showAllocations);
      const totalBudget = budget?.total_budget || 0;
      let estimatedAnnual = 0;
      if (newAllocation.allocation_method === 'pro_rata_sqft') {
        const totalSqft = budget?.property?.building_area_sqft || 1;
        estimatedAnnual = (newAllocation.tenant_sqft / totalSqft) * totalBudget;
      } else if (newAllocation.allocation_method === 'fixed_amount') {
        estimatedAnnual = newAllocation.fixed_amount;
      } else {
        estimatedAnnual = (newAllocation.allocation_percentage / 100) * totalBudget;
      }
      const { error } = await supabase.from('cam_tenant_allocations').insert({
        budget_id: showAllocations!,
        tenant_id: newAllocation.tenant_id,
        allocation_method: newAllocation.allocation_method,
        tenant_sqft: newAllocation.tenant_sqft || null,
        fixed_amount: newAllocation.fixed_amount || null,
        allocation_percentage: newAllocation.allocation_percentage || null,
        estimated_annual: estimatedAnnual,
        monthly_charge: estimatedAnnual / 12,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cam-allocations', showAllocations] });
      setNewAllocation({ tenant_id: '', allocation_method: 'pro_rata_sqft', tenant_sqft: 0, fixed_amount: 0, allocation_percentage: 0 });
      toast.success('Tenant allocation added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete line item
  const deleteLineItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cam_line_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cam-line-items', expandedBudget] });
      recalcBudgetTotal();
      toast.success('Line item deleted');
    },
  });

  // Update actual amount
  const updateActual = useMutation({
    mutationFn: async ({ id, actual }: { id: string; actual: number }) => {
      const { error } = await supabase.from('cam_line_items').update({ actual_amount: actual }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cam-line-items', expandedBudget] });
    },
  });

  const recalcBudgetTotal = async () => {
    if (!expandedBudget) return;
    const { data } = await supabase.from('cam_line_items').select('budgeted_amount').eq('budget_id', expandedBudget);
    const total = data?.reduce((s, i) => s + Number(i.budgeted_amount), 0) || 0;
    await supabase.from('cam_budgets').update({ total_budget: total }).eq('id', expandedBudget);
    queryClient.invalidateQueries({ queryKey: ['cam-budgets'] });
  };

  const totalBudgeted = lineItems.reduce((s, i) => s + Number(i.budgeted_amount), 0);
  const totalActual = lineItems.reduce((s, i) => s + Number(i.actual_amount), 0);
  const variance = totalBudgeted - totalActual;
  const spentPct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CAM Charges & Budgets</h1>
          <p className="text-muted-foreground">Common Area Maintenance budget management and tenant allocations</p>
        </div>
        <Dialog open={showCreateBudget} onOpenChange={setShowCreateBudget}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New CAM Budget</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create CAM Budget</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Property</Label>
                <Select value={newBudget.property_id} onValueChange={v => setNewBudget(p => ({ ...p, property_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Budget Year</Label>
                <Input type="number" value={newBudget.budget_year} onChange={e => setNewBudget(p => ({ ...p, budget_year: parseInt(e.target.value) }))} />
              </div>
              <div>
                <Label>Budget Name</Label>
                <Input value={newBudget.name} onChange={e => setNewBudget(p => ({ ...p, name: e.target.value }))} />
              </div>
              <Button onClick={() => createBudget.mutate()} disabled={!newBudget.property_id} className="w-full">Create Budget</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Budgeted</p>
                <p className="text-xl font-bold">${budgets.reduce((s, b) => s + Number(b.total_budget), 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="w-5 h-5 text-green-500" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Active Budgets</p>
                <p className="text-xl font-bold">{budgets.filter(b => b.status === 'active').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><Building2 className="w-5 h-5 text-blue-500" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Properties</p>
                <p className="text-xl font-bold">{new Set(budgets.map(b => b.property_id)).size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10"><Calculator className="w-5 h-5 text-amber-500" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Reconciliation</p>
                <p className="text-xl font-bold">{budgets.filter(b => b.status === 'active').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budgets List */}
      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading budgets...</CardContent></Card>
      ) : budgets.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No CAM budgets yet. Create one to get started.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {budgets.map(budget => {
            const isExpanded = expandedBudget === budget.id;
            return (
              <Card key={budget.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedBudget(isExpanded ? null : budget.id)}
                >
                  <div className="flex items-center gap-4">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{budget.name}</p>
                        <Badge variant={budget.status === 'active' ? 'default' : budget.status === 'reconciled' ? 'secondary' : 'outline'}>
                          {budget.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{budget.property?.address} • {budget.budget_year}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">${Number(budget.total_budget).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">annual budget</p>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    {/* Budget vs Actual Summary */}
                    {lineItems.length > 0 && (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Budgeted</p>
                          <p className="text-lg font-bold">${totalBudgeted.toLocaleString()}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Actual Spent</p>
                          <p className="text-lg font-bold">${totalActual.toLocaleString()}</p>
                        </div>
                        <div className={`rounded-lg p-3 ${variance >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                          <p className="text-xs text-muted-foreground">Variance</p>
                          <p className={`text-lg font-bold ${variance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {variance >= 0 ? '+' : ''}${variance.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {lineItems.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Budget utilized</span>
                          <span className="text-xs font-medium">{spentPct.toFixed(0)}%</span>
                        </div>
                        <Progress value={Math.min(spentPct, 100)} className="h-2" />
                      </div>
                    )}

                    {/* Line Items Table */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Budget Line Items</h3>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowAllocations(showAllocations === budget.id ? null : budget.id)}>
                          <Users className="w-4 h-4 mr-1" />Tenant Allocations
                        </Button>
                        <Button size="sm" onClick={() => { setShowAddLineItem(budget.id); setNewLineItem({ category: '', description: '', budgeted_amount: 0 }); }}>
                          <Plus className="w-4 h-4 mr-1" />Add Item
                        </Button>
                      </div>
                    </div>

                    {lineItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No line items yet. Add categories like Insurance, Taxes, Maintenance, etc.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Budgeted</TableHead>
                            <TableHead className="text-right">Actual</TableHead>
                            <TableHead className="text-right">Variance</TableHead>
                            <TableHead className="w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineItems.map(item => {
                            const itemVar = Number(item.budgeted_amount) - Number(item.actual_amount);
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium capitalize">{item.category.replace('_', ' ')}</TableCell>
                                <TableCell className="text-muted-foreground">{item.description || '—'}</TableCell>
                                <TableCell className="text-right tabular-nums">${Number(item.budgeted_amount).toLocaleString()}</TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    className="w-28 text-right h-8 inline-block tabular-nums"
                                    value={item.actual_amount}
                                    onChange={e => updateActual.mutate({ id: item.id, actual: parseFloat(e.target.value) || 0 })}
                                  />
                                </TableCell>
                                <TableCell className={`text-right tabular-nums ${itemVar >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                  {itemVar >= 0 ? '+' : ''}${itemVar.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteLineItem.mutate(item.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}

                    {/* Tenant Allocations Section */}
                    {showAllocations === budget.id && (
                      <div className="border-t pt-4 space-y-3">
                        <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" />Tenant Allocations</h3>
                        <p className="text-xs text-muted-foreground">Total property area: {budget.property?.building_area_sqft?.toLocaleString() || 'N/A'} sq ft</p>
                        
                        {allocations.length > 0 && (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Tenant</TableHead>
                                <TableHead>Unit</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead className="text-right">Sq Ft / %</TableHead>
                                <TableHead className="text-right">Est. Annual</TableHead>
                                <TableHead className="text-right">Monthly</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {allocations.map(a => (
                                <TableRow key={a.id}>
                                  <TableCell className="font-medium">{a.tenant?.company_name}</TableCell>
                                  <TableCell>{a.tenant?.unit_number || '—'}</TableCell>
                                  <TableCell className="capitalize">{a.allocation_method.replace('_', ' ')}</TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {a.allocation_method === 'pro_rata_sqft' ? `${Number(a.tenant_sqft).toLocaleString()} sf` :
                                     a.allocation_method === 'percentage' ? `${a.allocation_percentage}%` : '—'}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">${Number(a.estimated_annual).toLocaleString()}</TableCell>
                                  <TableCell className="text-right tabular-nums font-medium">${Number(a.monthly_charge).toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}

                        {/* Add Allocation */}
                        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                          <h4 className="text-sm font-medium">Add Tenant Allocation</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs">Tenant</Label>
                              <Select value={newAllocation.tenant_id} onValueChange={v => setNewAllocation(p => ({ ...p, tenant_id: v }))}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                  {tenants.filter(t => !allocations.find(a => a.tenant_id === t.id)).map(t => (
                                    <SelectItem key={t.id} value={t.id}>{t.company_name} {t.unit_number ? `(${t.unit_number})` : ''}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Method</Label>
                              <Select value={newAllocation.allocation_method} onValueChange={v => setNewAllocation(p => ({ ...p, allocation_method: v }))}>
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {ALLOCATION_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            {newAllocation.allocation_method === 'pro_rata_sqft' && (
                              <div>
                                <Label className="text-xs">Tenant Sq Ft</Label>
                                <Input type="number" className="h-9" value={newAllocation.tenant_sqft || ''} onChange={e => setNewAllocation(p => ({ ...p, tenant_sqft: parseFloat(e.target.value) || 0 }))} />
                              </div>
                            )}
                            {newAllocation.allocation_method === 'fixed_amount' && (
                              <div>
                                <Label className="text-xs">Annual Amount</Label>
                                <Input type="number" className="h-9" value={newAllocation.fixed_amount || ''} onChange={e => setNewAllocation(p => ({ ...p, fixed_amount: parseFloat(e.target.value) || 0 }))} />
                              </div>
                            )}
                            {newAllocation.allocation_method === 'percentage' && (
                              <div>
                                <Label className="text-xs">Percentage</Label>
                                <Input type="number" className="h-9" value={newAllocation.allocation_percentage || ''} onChange={e => setNewAllocation(p => ({ ...p, allocation_percentage: parseFloat(e.target.value) || 0 }))} />
                              </div>
                            )}
                            <div className="flex items-end">
                              <Button size="sm" className="w-full" disabled={!newAllocation.tenant_id} onClick={() => addAllocation.mutate()}>
                                Add
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Reconciliation Summary */}
                    {lineItems.length > 0 && allocations.length > 0 && showAllocations === budget.id && (
                      <div className="border-t pt-4 space-y-3">
                        <h3 className="font-semibold flex items-center gap-2"><Calculator className="w-4 h-4" />Reconciliation Summary</h3>
                        <p className="text-xs text-muted-foreground">Compares budgeted vs actual and calculates each tenant's share of the variance.</p>
                        
                        {/* Line Item Variance Table */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Budgeted</TableHead>
                              <TableHead className="text-right">Actual</TableHead>
                              <TableHead className="text-right">Variance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map(item => {
                              const budgeted = Number(item.budgeted_amount);
                              const actual = Number(item.actual_amount);
                              const itemVariance = actual - budgeted;
                              return (
                                <TableRow key={item.id}>
                                  <TableCell className="capitalize">{item.category.replace('_', ' ')}</TableCell>
                                  <TableCell className="text-right tabular-nums">${budgeted.toLocaleString()}</TableCell>
                                  <TableCell className="text-right tabular-nums">${actual.toLocaleString()}</TableCell>
                                  <TableCell className={`text-right tabular-nums font-medium ${itemVariance > 0 ? 'text-destructive' : itemVariance < 0 ? 'text-green-600' : ''}`}>
                                    {itemVariance > 0 ? '+' : ''}${itemVariance.toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow className="font-bold border-t-2">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right tabular-nums">${totalBudgeted.toLocaleString()}</TableCell>
                              <TableCell className="text-right tabular-nums">${totalActual.toLocaleString()}</TableCell>
                              <TableCell className={`text-right tabular-nums ${(totalActual - totalBudgeted) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                {(totalActual - totalBudgeted) > 0 ? '+' : ''}${(totalActual - totalBudgeted).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>

                        {/* Tenant Reconciliation */}
                        <h4 className="text-sm font-semibold mt-4">Tenant Variance Shares</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tenant</TableHead>
                              <TableHead className="text-right">Allocation %</TableHead>
                              <TableHead className="text-right">Est. Annual</TableHead>
                              <TableHead className="text-right">Actual Share</TableHead>
                              <TableHead className="text-right">Reconciliation</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const totalVarianceAmt = totalActual - totalBudgeted;
                              const totalAllocatedPct = allocations.reduce((sum: number, a: any) => {
                                if (a.allocation_method === 'pro_rata_sqft') {
                                  const totalSqft = budget.property?.building_area_sqft || 1;
                                  return sum + (Number(a.tenant_sqft) / totalSqft) * 100;
                                }
                                if (a.allocation_method === 'percentage') return sum + Number(a.allocation_percentage || 0);
                                if (a.allocation_method === 'fixed_amount') return sum + (totalBudgeted > 0 ? (Number(a.fixed_amount) / totalBudgeted) * 100 : 0);
                                return sum;
                              }, 0);
                              
                              let totalRecon = 0;
                              const rows = allocations.map((a: any) => {
                                let pct = 0;
                                if (a.allocation_method === 'pro_rata_sqft') {
                                  const totalSqft = budget.property?.building_area_sqft || 1;
                                  pct = (Number(a.tenant_sqft) / totalSqft) * 100;
                                } else if (a.allocation_method === 'percentage') {
                                  pct = Number(a.allocation_percentage || 0);
                                } else if (a.allocation_method === 'fixed_amount') {
                                  pct = totalBudgeted > 0 ? (Number(a.fixed_amount) / totalBudgeted) * 100 : 0;
                                }
                                const actualShare = totalActual * (pct / 100);
                                const reconAmount = actualShare - Number(a.estimated_annual);
                                totalRecon += reconAmount;
                                return (
                                  <TableRow key={a.id}>
                                    <TableCell className="font-medium">{a.tenant?.company_name}</TableCell>
                                    <TableCell className="text-right tabular-nums">{pct.toFixed(1)}%</TableCell>
                                    <TableCell className="text-right tabular-nums">${Number(a.estimated_annual).toLocaleString()}</TableCell>
                                    <TableCell className="text-right tabular-nums">${actualShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                    <TableCell className={`text-right tabular-nums font-medium ${reconAmount > 0 ? 'text-destructive' : reconAmount < 0 ? 'text-green-600' : ''}`}>
                                      {reconAmount > 0 ? '+' : ''}${reconAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </TableCell>
                                  </TableRow>
                                );
                              });
                              return (
                                <>
                                  {rows}
                                  <TableRow className="font-bold border-t-2">
                                    <TableCell>Net Reconciliation</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className={`text-right tabular-nums ${totalRecon > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                      {totalRecon > 0 ? '+' : ''}${totalRecon.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </TableCell>
                                  </TableRow>
                                </>
                              );
                            })()}
                          </TableBody>
                        </Table>
                        <p className="text-xs text-muted-foreground">
                          Positive = tenant owes additional. Negative = tenant is owed a credit.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Line Item Dialog */}
      <Dialog open={!!showAddLineItem} onOpenChange={() => setShowAddLineItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Budget Line Item</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select value={newLineItem.category} onValueChange={v => setNewLineItem(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CAM_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={newLineItem.description} onChange={e => setNewLineItem(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <Label>Budgeted Amount</Label>
              <Input type="number" value={newLineItem.budgeted_amount || ''} onChange={e => setNewLineItem(p => ({ ...p, budgeted_amount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <Button onClick={() => addLineItem.mutate()} disabled={!newLineItem.category} className="w-full">Add Line Item</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
