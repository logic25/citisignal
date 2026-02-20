import { ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import AdminOverview from "./AdminOverview";
import AdminAPILogsPage from "./AdminAPILogsPage";
import AdminUsersPage from "./AdminUsersPage";
import AdminRoadmapPage from "./AdminRoadmapPage";
import AdminFeatureRequestsPage from "./AdminFeatureRequestsPage";
import AdminBugReportsPage from "./AdminBugReportsPage";
import InviteCodesTab from "@/components/admin/InviteCodesTab";

const AdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">System health, users, and platform management</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="api-logs">API Logs</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="invite-codes">Invite Codes</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="requests">Feature Requests</TabsTrigger>
          <TabsTrigger value="bugs">Bug Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><AdminOverview /></TabsContent>
        <TabsContent value="api-logs"><AdminAPILogsPage /></TabsContent>
        <TabsContent value="users"><AdminUsersPage /></TabsContent>
        <TabsContent value="invite-codes"><InviteCodesTab /></TabsContent>
        <TabsContent value="roadmap"><AdminRoadmapPage /></TabsContent>
        <TabsContent value="requests"><AdminFeatureRequestsPage /></TabsContent>
        <TabsContent value="bugs"><AdminBugReportsPage /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
