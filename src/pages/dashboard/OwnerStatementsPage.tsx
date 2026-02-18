import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, DollarSign, TrendingUp, TrendingDown, FileText, Download, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

const INCOME_CATEGORIES = [
  { value: 'rent', label: 'Rent' },
  { value: 'cam_recovery', label: 'CAM Recovery' },
  { value: 'parking', label: 'Parking Revenue' },
  { value: 'late_fee', label: 'Late Fee' },
  { value: 'other_income', label: 'Other Income' },
];

const EXPENSE_CATEGORIES = [
  { value: 'work_order', label: 'Maintenance/Repairs' },
  { value: 'tax', label: 'Real Estate Taxes' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'utility', label: 'Utilities' },
  { value: 'management_fee', label: 'Management Fee' },
  { value: 'mortgage', label: 'Mortgage/Debt Service' },
  { value: 'maintenance', label: 'Common Area Maintenance' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'other', label: 'Other Expense' },
];

const PAYMENT_METHODS = [
  { value: 'check', label: 'Check' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'ach', label: 'ACH' },
  { value: 'wire', label: 'Wire Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export default function OwnerStatementsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    start: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [newTxn, setNewTxn] = useState({
    property_id: '', transaction_type: 'income', category: '', description: '', amount: 0,
    transaction_date: format(new Date(), 'yyyy-MM-dd'), reference_number: '', payment_method: '', notes: '', tenant_id: '',
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('id, address').order('address');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['financial-transactions', selectedProperty, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('financial_transactions')
        .select('*, property:properties(id, address), tenant:tenants(id, company_name)')
        .gte('transaction_date', dateRange.start)
        .lte('transaction_date', dateRange.end)
        .order('transaction_date', { ascending: false });
      if (selectedProperty !== 'all') {
        query = query.eq('property_id', selectedProperty);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants-for-txn', newTxn.property_id],
    queryFn: async () => {
      if (!newTxn.property_id) return [];
      const { data, error } = await supabase.from('tenants').select('id, company_name, unit_number').eq('property_id', newTxn.property_id);
      if (error) throw error;
      return data;
    },
    enabled: !!newTxn.property_id,
  });

  const addTransaction = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('financial_transactions').insert({
        property_id: newTxn.property_id,
        user_id: user!.id,
        tenant_id: newTxn.tenant_id || null,
        transaction_type: newTxn.transaction_type,
        category: newTxn.category,
        description: newTxn.description,
        amount: newTxn.amount,
        transaction_date: newTxn.transaction_date,
        reference_number: newTxn.reference_number || null,
        payment_method: newTxn.payment_method || null,
        notes: newTxn.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      setShowAddTransaction(false);
      setNewTxn({ property_id: '', transaction_type: 'income', category: '', description: '', amount: 0, transaction_date: format(new Date(), 'yyyy-MM-dd'), reference_number: '', payment_method: '', notes: '', tenant_id: '' });
      toast.success('Transaction recorded');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const income = transactions.filter(t => t.transaction_type === 'income');
  const expenses = transactions.filter(t => t.transaction_type === 'expense');
  const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const noi = totalIncome - totalExpenses;

  // Group by category for P&L
  const incomeByCategory = income.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const expenseByCategory = expenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const categories = newTxn.transaction_type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Owner Statements</h1>
          <p className="text-muted-foreground">Income, expenses, and P&L by property</p>
        </div>
        <Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Record Transaction</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Record Transaction</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={newTxn.transaction_type} onValueChange={v => setNewTxn(p => ({ ...p, transaction_type: v, category: '' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={newTxn.transaction_date} onChange={e => setNewTxn(p => ({ ...p, transaction_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Property</Label>
                <Select value={newTxn.property_id} onValueChange={v => setNewTxn(p => ({ ...p, property_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={newTxn.category} onValueChange={v => setNewTxn(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {newTxn.transaction_type === 'income' && tenants.length > 0 && (
                <div>
                  <Label>Tenant (optional)</Label>
                  <Select value={newTxn.tenant_id} onValueChange={v => setNewTxn(p => ({ ...p, tenant_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.company_name} {t.unit_number ? `(${t.unit_number})` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Amount</Label>
                <Input type="number" placeholder="0.00" value={newTxn.amount || ''} onChange={e => setNewTxn(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={newTxn.description} onChange={e => setNewTxn(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Payment Method</Label>
                  <Select value={newTxn.payment_method} onValueChange={v => setNewTxn(p => ({ ...p, payment_method: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reference #</Label>
                  <Input value={newTxn.reference_number} onChange={e => setNewTxn(p => ({ ...p, reference_number: e.target.value }))} placeholder="Check #, Invoice #" />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={newTxn.notes} onChange={e => setNewTxn(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
              <Button onClick={() => addTransaction.mutate()} disabled={!newTxn.property_id || !newTxn.category || !newTxn.amount} className="w-full">
                Record Transaction
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedProperty} onValueChange={setSelectedProperty}>
          <SelectTrigger className="w-64"><SelectValue placeholder="All properties" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-40" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} />
        <span className="text-muted-foreground">to</span>
        <Input type="date" className="w-40" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} />
      </div>

      {/* P&L Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="w-5 h-5 text-green-500" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-2xl font-bold text-green-600">${totalIncome.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><TrendingDown className="w-5 h-5 text-destructive" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-destructive">${totalExpenses.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={noi >= 0 ? 'border-green-500/30' : 'border-destructive/30'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${noi >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                <DollarSign className={`w-5 h-5 ${noi >= 0 ? 'text-green-500' : 'text-destructive'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Operating Income</p>
                <p className={`text-2xl font-bold ${noi >= 0 ? 'text-green-600' : 'text-destructive'}`}>${noi.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">Transaction Ledger</TabsTrigger>
          <TabsTrigger value="pnl">P&L Statement</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <Card>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground">No transactions recorded for this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="tabular-nums">{format(new Date(t.transaction_date), 'MM/dd/yy')}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{t.property?.address}</TableCell>
                        <TableCell>
                          <Badge variant={t.transaction_type === 'income' ? 'default' : 'destructive'} className="capitalize">
                            {t.category.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{t.description || '—'}</TableCell>
                        <TableCell>{t.tenant?.company_name || '—'}</TableCell>
                        <TableCell className="capitalize">{t.payment_method?.replace('_', ' ') || '—'}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${t.transaction_type === 'income' ? 'text-green-600' : 'text-destructive'}`}>
                          {t.transaction_type === 'expense' ? '-' : ''}${Number(t.amount).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pnl">
          <Card>
            <CardHeader><CardTitle>Profit & Loss Statement</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {/* Income Section */}
              <div>
                <h3 className="font-semibold text-green-600 mb-2">INCOME</h3>
                <Table>
                  <TableBody>
                    {Object.entries(incomeByCategory).map(([cat, amt]) => (
                      <TableRow key={cat}>
                        <TableCell className="capitalize">{cat.replace('_', ' ')}</TableCell>
                        <TableCell className="text-right tabular-nums text-green-600">${amt.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total Income</TableCell>
                      <TableCell className="text-right tabular-nums text-green-600">${totalIncome.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Expense Section */}
              <div>
                <h3 className="font-semibold text-destructive mb-2">EXPENSES</h3>
                <Table>
                  <TableBody>
                    {Object.entries(expenseByCategory).map(([cat, amt]) => (
                      <TableRow key={cat}>
                        <TableCell className="capitalize">{cat.replace('_', ' ')}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">${amt.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total Expenses</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">${totalExpenses.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* NOI */}
              <div className={`rounded-lg p-4 ${noi >= 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Net Operating Income (NOI)</span>
                  <span className={`text-2xl font-bold tabular-nums ${noi >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    ${noi.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
