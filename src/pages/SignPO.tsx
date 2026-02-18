import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, FileText, DollarSign, Building2, Calendar, Pen } from 'lucide-react';
import { toast } from 'sonner';

const SignPO = () => {
  const { token } = useParams<{ token: string }>();
  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPO = async () => {
      if (!token) { setError('Invalid link'); setLoading(false); return; }

      const { data, error: fetchErr } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          property:properties(address, borough),
          vendor:vendors(name, phone_number, email)
        `)
        .eq('vendor_sign_token', token)
        .maybeSingle();

      if (fetchErr || !data) {
        setError('Purchase order not found or link expired.');
        setLoading(false);
        return;
      }

      setPo(data);
      if (data.vendor_signed_at) setSigned(true);
      setLoading(false);
    };
    fetchPO();
  }, [token]);

  const handleSign = async () => {
    if (!po) return;
    setSigning(true);
    try {
      const { error: updateErr } = await supabase
        .from('purchase_orders')
        .update({
          vendor_signed_at: new Date().toISOString(),
          status: 'fully_executed',
        })
        .eq('id', po.id)
        .eq('vendor_sign_token', token);

      if (updateErr) throw updateErr;

      // Update work order status to in_progress
      await supabase
        .from('work_orders')
        .update({ status: 'in_progress' as any })
        .eq('id', po.work_order_id);

      setSigned(true);
      toast.success('Purchase order signed successfully!');
    } catch {
      toast.error('Failed to sign. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Unable to Load</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const property = po?.property as any;
  const vendor = po?.vendor as any;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Purchase Order</h1>
          <p className="text-muted-foreground mt-1">{po?.po_number}</p>
        </div>

        {/* Status */}
        {signed && (
          <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              Fully Executed — Signed by both parties
            </span>
          </div>
        )}

        {/* PO Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Purchase Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">PO Number</span>
                <p className="font-bold text-lg">{po?.po_number}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Amount
                </span>
                <p className="font-bold text-lg text-emerald-600">${po?.amount?.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Property
                </span>
                <p className="font-medium">{property?.address}</p>
                {property?.borough && <p className="text-sm text-muted-foreground">{property.borough}</p>}
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date
                </span>
                <p className="font-medium">{new Date(po?.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">Scope of Work</span>
              <p className="mt-1 font-medium">{po?.scope}</p>
            </div>

            <div className="pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">Vendor</span>
              <p className="font-medium">{vendor?.name}</p>
              {vendor?.email && <p className="text-sm text-muted-foreground">{vendor.email}</p>}
              {vendor?.phone_number && <p className="text-sm text-muted-foreground">{vendor.phone_number}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Signatures */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pen className="w-5 h-5" />
              Signatures
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Property Owner</p>
                <p className="text-sm text-muted-foreground">
                  Signed {po?.owner_signed_at ? new Date(po.owner_signed_at).toLocaleString() : '—'}
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Signed
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Vendor ({vendor?.name})</p>
                <p className="text-sm text-muted-foreground">
                  {signed
                    ? `Signed ${new Date(po?.vendor_signed_at).toLocaleString()}`
                    : 'Awaiting signature'}
                </p>
              </div>
              {signed ? (
                <Badge className="bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Signed
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  Pending
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sign Button */}
        {!signed && (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              By signing, you agree to perform the work described above for the stated amount.
            </p>
            <Button
              size="lg"
              className="w-full md:w-auto px-12 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSign}
              disabled={signing}
            >
              {signing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Pen className="w-4 h-4 mr-2" />
              )}
              Sign Purchase Order
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Property Guard • Purchase Order System
        </p>
      </div>
    </div>
  );
};

export default SignPO;
