import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ArrowLeft, Building2, AlertTriangle, FileText, MessageSquare,
  Users, MessageCircle, ChevronDown, ExternalLink, ShieldCheck, Mail
} from 'lucide-react';
import { format } from 'date-fns';

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();

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

  const properties: any[] = userRecord?.property_list ?? [];
  const propertyIds = properties.map((p: any) => p.id);

  // Full user data via admin edge function
  const { data: userData } = useQuery({
    queryKey: ['admin-user-full-data', userId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-get-user-data', {
        body: { userId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!userId && propertyIds.length >= 0,
  });

  const totalViolations = properties.reduce((sum: number, p: any) => sum + (p.total_violations || 0), 0);
  const openViolations = properties.reduce((sum: number, p: any) => sum + (p.open_violations || 0), 0);
  const tenantCount = (userData?.tenants || []).filter((t: any) => t.status === 'active').length;
  const docCount = (userData?.documents || []).length;
  const telegramConnected = !!userData?.telegram;

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

  const addressMap: Record<string, string> = userData?.addressMap || {};
  const getAddr = (propertyId: string) => addressMap[propertyId] || properties.find((p: any) => p.id === propertyId)?.address || '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/admin?tab=users"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{userRecord.display_name || 'User Detail'}</h1>
          <p className="text-muted-foreground text-sm">{userRecord.email || userRecord.company_name || userId}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={<Building2 className="w-6 h-6 text-primary" />} value={properties.length} label="Properties" />
        <StatCard icon={<AlertTriangle className="w-6 h-6 text-destructive" />} value={openViolations} label="Open Violations" />
        <StatCard icon={<Users className="w-6 h-6 text-primary" />} value={tenantCount} label="Active Tenants" />
        <StatCard icon={<FileText className="w-6 h-6 text-primary" />} value={docCount} label="Documents" />
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-6 h-6 text-primary" />
              <div>
                <Badge variant={telegramConnected ? 'default' : 'secondary'} className={telegramConnected ? 'bg-green-600' : ''}>
                  {telegramConnected ? 'Connected' : 'Not Connected'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Telegram</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <DLItem label="Email" value={userRecord.email} />
            <DLItem label="Phone" value={userRecord.phone} />
            <DLItem label="Company" value={userRecord.company_name} />
            <DLItem label="License ID" value={userRecord.license_id} />
            <DLItem label="Signed Up" value={userRecord.created_at ? format(new Date(userRecord.created_at), 'MMM d, yyyy') : null} />
            <DLItem label="Last Sign-In" value={userRecord.last_sign_in_at ? format(new Date(userRecord.last_sign_in_at), 'MMM d, yyyy h:mm a') : null} />
          </dl>
        </CardContent>
      </Card>

      {/* Properties */}
      <Card>
        <CardHeader><CardTitle>Properties</CardTitle></CardHeader>
        <CardContent>
          {!properties.length ? (
            <p className="text-muted-foreground text-sm">No properties</p>
          ) : (
            <div className="space-y-2">
              {properties.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-sm">{p.address}</p>
                    <p className="text-xs text-muted-foreground">{p.borough}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.open_violations > 0 && <Badge variant="destructive">{p.open_violations} open</Badge>}
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/dashboard/properties/${p.id}`}>
                        <ExternalLink className="w-3 h-3 mr-1" /> View
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Violations Summary */}
      <ExpandableSection title="Violations" count={userData?.violations?.length || 0} icon={<AlertTriangle className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-3">Agency</th>
                <th className="pb-2 pr-3">Violation #</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Severity</th>
                <th className="pb-2 pr-3">Issued</th>
                <th className="pb-2 pr-3">Penalty</th>
                <th className="pb-2">Property</th>
              </tr>
            </thead>
            <tbody>
              {(userData?.violations || []).slice(0, 50).map((v: any) => (
                <tr key={v.id} className="border-b border-border/50">
                  <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">{v.agency}</Badge></td>
                  <td className="py-2 pr-3 font-mono text-xs">{v.violation_number}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={v.status === 'open' ? 'destructive' : 'secondary'} className="text-xs">{v.status}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-xs">{v.severity || '—'}</td>
                  <td className="py-2 pr-3 text-xs">{v.issued_date ? format(new Date(v.issued_date), 'MM/dd/yy') : '—'}</td>
                  <td className="py-2 pr-3 text-xs">{v.penalty_amount ? `$${v.penalty_amount.toLocaleString()}` : '—'}</td>
                  <td className="py-2 text-xs truncate max-w-[150px]">{getAddr(v.property_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!userData?.violations?.length && <p className="text-muted-foreground text-sm py-3">No violations</p>}
        </div>
      </ExpandableSection>

      {/* Compliance */}
      <ExpandableSection title="Compliance Requirements" count={userData?.compliance?.length || 0} icon={<ShieldCheck className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-3">Local Law</th>
                <th className="pb-2 pr-3">Requirement</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Due Date</th>
                <th className="pb-2">Property</th>
              </tr>
            </thead>
            <tbody>
              {(userData?.compliance || []).map((c: any) => (
                <tr key={c.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium text-xs">{c.local_law}</td>
                  <td className="py-2 pr-3 text-xs">{c.requirement_name}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={c.status === 'overdue' ? 'destructive' : c.status === 'compliant' ? 'default' : 'secondary'} className="text-xs">{c.status}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-xs">{c.due_date ? format(new Date(c.due_date), 'MM/dd/yy') : '—'}</td>
                  <td className="py-2 text-xs truncate max-w-[150px]">{getAddr(c.property_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!userData?.compliance?.length && <p className="text-muted-foreground text-sm py-3">No compliance records</p>}
        </div>
      </ExpandableSection>

      {/* Tenants */}
      <ExpandableSection title="Tenants" count={userData?.tenants?.length || 0} icon={<Users className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-3">Company</th>
                <th className="pb-2 pr-3">Unit</th>
                <th className="pb-2 pr-3">Lease End</th>
                <th className="pb-2 pr-3">Rent</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2">Property</th>
              </tr>
            </thead>
            <tbody>
              {(userData?.tenants || []).map((t: any) => {
                const leaseEnd = t.lease_end_date ? new Date(t.lease_end_date) : null;
                const expiringSoon = leaseEnd && leaseEnd.getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000 && leaseEnd.getTime() > Date.now();
                return (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 text-xs font-medium">{t.company_name || '—'}</td>
                    <td className="py-2 pr-3 text-xs">{t.unit_number || '—'}</td>
                    <td className="py-2 pr-3 text-xs">
                      {leaseEnd ? (
                        <span className={expiringSoon ? 'text-warning font-medium' : ''}>
                          {format(leaseEnd, 'MM/dd/yy')}{expiringSoon ? ' ⚠️' : ''}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-xs">{t.monthly_rent ? `$${t.monthly_rent.toLocaleString()}` : '—'}</td>
                    <td className="py-2 pr-3"><Badge variant={t.status === 'active' ? 'default' : 'secondary'} className="text-xs">{t.status}</Badge></td>
                    <td className="py-2 text-xs truncate max-w-[150px]">{getAddr(t.property_id)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!userData?.tenants?.length && <p className="text-muted-foreground text-sm py-3">No tenants</p>}
        </div>
      </ExpandableSection>

      {/* Documents */}
      <ExpandableSection title="Documents" count={docCount} icon={<FileText className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-3">Name</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">Uploaded</th>
                <th className="pb-2 pr-3">Expires</th>
                <th className="pb-2 pr-3">Text</th>
                <th className="pb-2">Property</th>
              </tr>
            </thead>
            <tbody>
              {(userData?.documents || []).map((d: any) => (
                <tr key={d.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 text-xs font-medium truncate max-w-[200px]">{d.document_name}</td>
                  <td className="py-2 pr-3 text-xs">{d.document_type}</td>
                  <td className="py-2 pr-3 text-xs">{d.created_at ? format(new Date(d.created_at), 'MM/dd/yy') : '—'}</td>
                  <td className="py-2 pr-3 text-xs">{d.expiration_date ? format(new Date(d.expiration_date), 'MM/dd/yy') : '—'}</td>
                  <td className="py-2 pr-3 text-xs">{d.extracted_text ? '✅' : '⚠️'}</td>
                  <td className="py-2 text-xs truncate max-w-[150px]">{getAddr(d.property_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!docCount && <p className="text-muted-foreground text-sm py-3">No documents</p>}
        </div>
      </ExpandableSection>

      {/* Work Orders */}
      <ExpandableSection title="Work Orders" count={userData?.workOrders?.length || 0} icon={<MessageSquare className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-3">Scope</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Priority</th>
                <th className="pb-2 pr-3">Quoted</th>
                <th className="pb-2 pr-3">Due</th>
                <th className="pb-2">Property</th>
              </tr>
            </thead>
            <tbody>
              {(userData?.workOrders || []).map((w: any) => (
                <tr key={w.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 text-xs truncate max-w-[200px]">{w.scope}</td>
                  <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">{w.status}</Badge></td>
                  <td className="py-2 pr-3 text-xs">{w.priority || '—'}</td>
                  <td className="py-2 pr-3 text-xs">{w.quoted_amount ? `$${w.quoted_amount.toLocaleString()}` : '—'}</td>
                  <td className="py-2 pr-3 text-xs">{w.due_date ? format(new Date(w.due_date), 'MM/dd/yy') : '—'}</td>
                  <td className="py-2 text-xs truncate max-w-[150px]">{getAddr(w.property_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!userData?.workOrders?.length && <p className="text-muted-foreground text-sm py-3">No work orders</p>}
        </div>
      </ExpandableSection>

      {/* Notification Preferences */}
      <ExpandableSection title="Notification Preferences" count={null} icon={<Mail className="w-4 h-4" />}>
        {userData?.emailPreferences ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Email Alerts</h4>
              <ul className="space-y-1 text-xs">
                <li>New violations: {userData.emailPreferences.notify_new_violations ? '✅' : '❌'}</li>
                <li>Status changes: {userData.emailPreferences.notify_status_changes ? '✅' : '❌'}</li>
                <li>Expirations: {userData.emailPreferences.notify_expirations ? '✅' : '❌'}</li>
                <li>New applications: {userData.emailPreferences.notify_new_applications ? '✅' : '❌'}</li>
                <li>Digest: {userData.emailPreferences.digest_frequency} ({userData.emailPreferences.digest_day})</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Telegram Alerts</h4>
              <ul className="space-y-1 text-xs">
                <li>New violations: {userData.emailPreferences.telegram_new_violations ? '✅' : '❌'}</li>
                <li>Status changes: {userData.emailPreferences.telegram_status_changes ? '✅' : '❌'}</li>
                <li>Expirations: {userData.emailPreferences.telegram_expirations ? '✅' : '❌'}</li>
                <li>Critical alerts: {userData.emailPreferences.telegram_critical_alerts ? '✅' : '❌'}</li>
                <li>Daily summary: {userData.emailPreferences.telegram_daily_summary ? '✅' : '❌'}</li>
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No notification preferences configured</p>
        )}
      </ExpandableSection>

      {/* Telegram Status */}
      {userData?.telegram && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Telegram Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <DLItem label="Username" value={userData.telegram.telegram_username} />
              <DLItem label="Chat ID" value={userData.telegram.chat_id} />
              <DLItem label="Linked" value={userData.telegram.created_at ? format(new Date(userData.telegram.created_at), 'MMM d, yyyy') : null} />
            </dl>
          </CardContent>
        </Card>
      )}

      {/* AI Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> AI Activity
            <Badge variant="secondary" className="ml-auto">{userData?.aiQuestionCount || 0} questions (30d)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(userData?.aiConversations || []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No AI conversations</p>
          ) : (
            <div className="space-y-2">
              {(userData?.aiConversations || []).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded border border-border/50 text-xs">
                  <span className="font-medium truncate max-w-[300px]">{c.title || 'Untitled'}</span>
                  <span className="text-muted-foreground">{c.updated_at ? format(new Date(c.updated_at), 'MMM d, h:mm a') : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DLItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || '—'}</dd>
    </div>
  );
}

function ExpandableSection({ title, count, icon, children }: { title: string; count: number | null; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Collapsible>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="text-sm flex items-center gap-2">
              {icon} {title}
              {count !== null && <Badge variant="secondary" className="ml-1">{count}</Badge>}
              <ChevronDown className="w-4 h-4 ml-auto transition-transform [[data-state=open]>&]:rotate-180" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
