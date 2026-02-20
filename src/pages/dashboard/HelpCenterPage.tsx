import { HelpCircle, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HowToGuides } from "@/components/helpdesk/HowToGuides";
import { FeatureRequests } from "@/components/helpdesk/FeatureRequests";
import { BugReports } from "@/components/helpdesk/BugReports";
import { AIUsageDashboard } from "@/components/helpdesk/AIUsageDashboard";
import { ClarityPlaceholder } from "@/components/helpdesk/ClarityPlaceholder";
import { Button } from "@/components/ui/button";
import { useTour } from "@/components/tour/TourContext";
import { useAdminRole } from "@/hooks/useAdminRole";

const HelpCenterPage = () => {
  const { restartTour } = useTour();
  const { isAdmin } = useAdminRole();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Help Center</h1>
            <p className="text-sm text-muted-foreground">Guides, bug reports, and feature requests</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={restartTour} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Restart Tour
        </Button>
      </div>

      <Tabs defaultValue="guides" className="space-y-4">
        <TabsList>
          <TabsTrigger value="guides">How-To Guides</TabsTrigger>
          <TabsTrigger value="bugs">Bug Reports</TabsTrigger>
          <TabsTrigger value="requests">Feature Requests</TabsTrigger>
          {isAdmin && <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>}
          {isAdmin && <TabsTrigger value="session-analytics">Session Analytics</TabsTrigger>}
        </TabsList>

        <TabsContent value="guides"><HowToGuides /></TabsContent>
        <TabsContent value="bugs"><BugReports /></TabsContent>
        <TabsContent value="requests"><FeatureRequests /></TabsContent>
        {isAdmin && (
          <TabsContent value="ai-usage"><AIUsageDashboard /></TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="session-analytics"><ClarityPlaceholder /></TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default HelpCenterPage;
