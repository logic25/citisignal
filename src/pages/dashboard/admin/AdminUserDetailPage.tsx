import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, AlertTriangle, FileText, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();

  // Load enriched user data (includes email, last_sign_in, property_list) from admin function
  const { data: userRecord, isLoading } = useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: async () => {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-get-users');
      if (fnError) throw fnError;
      const users = fnData?.users ?? [];
      return users.find((u: any) => u.user_id === userId) ?? null;
    },
    enabled: !!userId,
  });

  const { data: ddReports } = useQuery({
    queryKey: ['admin-user-dd-reports', userId],
    queryFn: async () => {
      // dd_reports RLS is per user — admin can't read other users' reports directly
      // Return 0 gracefully; a dedicated admin function could be added later
      return 0;
    },
    enabled: !!userId,
  });

  const properties: any[] = userRecord?.property_list ?? [];
  const totalViolations = properties.reduce((sum, p) => sum + (p.total_violations || 0), 0);
  const openViolations = properties.reduce((sum, p) => sum + (p.open_violations || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!userRecord) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard/admin?tab=users"><ArrowLeft className="w-4 h-4 mr-2" />Back to Users</Link>
        </Button>
        <p className="text-muted-foreground">User not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/admin?tab=users">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {userRecord.display_name || 'User Detail'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {userRecord.email || userRecord.company_name || userId}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-primary" />
              <div>
                <p className="text-xl font-bold">{properties.length}</p>
                <p className="text-xs text-muted-foreground">Properties</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <div>
                <p className="text-xl font-bold">{openViolations} / {totalViolations}</p>
                <p className="text-xs text-muted-foreground">Open / Total Violations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <div>
                <p className="text-xl font-bold">{ddReports ?? 0}</p>
                <p className="text-xs text-muted-foreground">DD Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-primary" />
              <div>
                <p className="text-xl font-bold">—</p>
                <p className="text-xs text-muted-foreground">AI Questions (this month)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile details */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{userRecord.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">{userRecord.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Company</dt>
              <dd className="font-medium">{userRecord.company_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">License ID</dt>
              <dd className="font-medium">{userRecord.license_id || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Signed Up</dt>
              <dd className="font-medium">
                {userRecord.created_at ? format(new Date(userRecord.created_at), 'MMM d, yyyy') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last Sign-In</dt>
              <dd className="font-medium">
                {userRecord.last_sign_in_at
                  ? format(new Date(userRecord.last_sign_in_at), 'MMM d, yyyy h:mm a')
                  : <span className="text-muted-foreground/50">Never</span>}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Properties list */}
      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
        </CardHeader>
        <CardContent>
          {!properties.length ? (
            <p className="text-muted-foreground text-sm">No properties</p>
          ) : (
            <div className="space-y-2">
              {properties.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-sm">{p.address}</p>
                    <p className="text-xs text-muted-foreground">{p.borough}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.open_violations > 0 && (
                      <Badge variant="destructive">{p.open_violations} open</Badge>
                    )}
                    {p.total_violations > 0 && (
                      <span className="text-xs text-muted-foreground">{p.total_violations} total</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
