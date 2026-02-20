import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';

export default function AdminUsersPage() {
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Fetch enriched user list from admin edge function (includes email + last_sign_in_at)
      const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-get-users');
      if (fnError) throw fnError;

      const profiles = fnData?.users ?? [];
      const userIds = profiles.map((p: any) => p.user_id);

      // Get property counts per user
      const { data: properties } = await supabase
        .from('properties')
        .select('user_id')
        .in('user_id', userIds);

      const propertyCounts: Record<string, number> = {};
      for (const p of properties || []) {
        propertyCounts[p.user_id] = (propertyCounts[p.user_id] || 0) + 1;
      }

      // Get admin roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');
      const adminSet = new Set((roles || []).filter((r) => r.role === 'admin').map((r) => r.user_id));

      return profiles.map((p: any) => ({
        ...p,
        propertyCount: propertyCounts[p.user_id] || 0,
        isAdmin: adminSet.has(p.user_id),
      }));
    },
  });

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">{users?.length ?? 0} registered users</p>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger className="cursor-default underline decoration-dotted underline-offset-2">User</TooltipTrigger>
                      <TooltipContent>The user's display name and email address</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger className="cursor-default underline decoration-dotted underline-offset-2">Signed Up</TooltipTrigger>
                      <TooltipContent>Date the account was created</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger className="cursor-default underline decoration-dotted underline-offset-2">Last Sign-In</TooltipTrigger>
                      <TooltipContent>The last time this user logged into CitiSignal</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger className="cursor-default underline decoration-dotted underline-offset-2">Properties</TooltipTrigger>
                      <TooltipContent>Number of properties this user has added to their portfolio</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger className="cursor-default underline decoration-dotted underline-offset-2">Role</TooltipTrigger>
                      <TooltipContent>Admin users can access the Admin Panel; regular users cannot</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="w-[80px]">
                    <Tooltip>
                      <TooltipTrigger className="cursor-default underline decoration-dotted underline-offset-2">Detail</TooltipTrigger>
                      <TooltipContent>View this user's full profile and activity history</TooltipContent>
                    </Tooltip>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell>
                  </TableRow>
                ) : !users?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found</TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.display_name || 'No name'}</p>
                          <p className="text-xs text-muted-foreground">{user.email || user.user_id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.last_sign_in_at
                          ? format(new Date(user.last_sign_in_at), 'MMM d, yyyy')
                          : <span className="text-muted-foreground/50">Never</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.propertyCount}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.isAdmin ? (
                          <Badge className="bg-primary">Admin</Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/dashboard/admin/users/${user.user_id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
