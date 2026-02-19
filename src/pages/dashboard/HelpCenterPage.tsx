import { HelpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HowToGuides } from "@/components/helpdesk/HowToGuides";
import { FeatureRequests } from "@/components/helpdesk/FeatureRequests";
import { BugReports } from "@/components/helpdesk/BugReports";

const HelpCenterPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Help Center</h1>
          <p className="text-sm text-muted-foreground">Guides, bug reports, and feature requests</p>
        </div>
      </div>

      <Tabs defaultValue="guides" className="space-y-4">
        <TabsList>
          <TabsTrigger value="guides">How-To Guides</TabsTrigger>
          <TabsTrigger value="bugs">Bug Reports</TabsTrigger>
          <TabsTrigger value="requests">Feature Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="guides"><HowToGuides /></TabsContent>
        <TabsContent value="bugs"><BugReports /></TabsContent>
        <TabsContent value="requests"><FeatureRequests /></TabsContent>
      </Tabs>
    </div>
  );
};

export default HelpCenterPage;
