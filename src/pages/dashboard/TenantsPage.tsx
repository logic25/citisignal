import { Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

const TenantsPage = () => {
  const { user } = useAuth();

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["all-tenants", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*, properties(id, address)")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Tenants</h1>
          <p className="text-sm text-muted-foreground">All tenants across your properties</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading tenants…</p>
      ) : !tenants?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No tenants found. Add tenants from a property's Tenants tab.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map((tenant: any) => (
            <Card key={tenant.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{tenant.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {tenant.unit_number && (
                  <p className="text-muted-foreground">Unit {tenant.unit_number}</p>
                )}
                {tenant.properties && (
                  <Link 
                    to={`/dashboard/properties/${tenant.properties.id}`}
                    className="text-primary hover:underline text-xs"
                  >
                    {tenant.properties.address}
                  </Link>
                )}
                <div className="flex gap-2 flex-wrap">
                  {tenant.lease_start && (
                    <Badge variant="secondary" className="text-xs">
                      Lease: {new Date(tenant.lease_start).toLocaleDateString()} – {tenant.lease_end ? new Date(tenant.lease_end).toLocaleDateString() : 'MTM'}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TenantsPage;
