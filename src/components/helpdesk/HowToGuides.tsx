import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Search, Building2, AlertTriangle, ClipboardList, Users, FileStack, 
  Bell, Settings, ChevronDown, Receipt, BarChart3 
} from "lucide-react";

interface Guide {
  title: string;
  icon: React.ElementType;
  items: { title: string; steps: string[] }[];
}

const GUIDES: Guide[] = [
  {
    title: "Properties",
    icon: Building2,
    items: [
      { title: "Add a new property", steps: ["Go to Properties page", "Click '+ Add Property'", "Enter an NYC address to auto-populate building data from DOB", "Select agencies to track and save"] },
      { title: "Sync violations", steps: ["Open the Properties page", "Click 'Sync All' to pull latest violations from NYC Open Data", "Or open a single property and sync from its detail page"] },
      { title: "View property details", steps: ["Click any property row in the table", "Browse tabs: Overview, Violations, Documents, Work Orders, Tenants, Taxes", "Use the AI chat button for property-specific questions"] },
    ],
  },
  {
    title: "Violations",
    icon: AlertTriangle,
    items: [
      { title: "Track violations", steps: ["Go to Violations page for a cross-property view", "Filter by agency, severity, or status", "Click a violation to see full details and hearing dates"] },
      { title: "Understand severity levels", steps: ["Critical: Stop Work Orders, Vacate Orders, Class I violations", "High: Class II, Class A violations", "Moderate: Class III, Class B violations", "Low: Administrative or informational"] },
    ],
  },
  {
    title: "Work Orders",
    icon: ClipboardList,
    items: [
      { title: "Create a work order", steps: ["Go to Work Orders page", "Click '+ New Work Order'", "Link to a property and optionally a violation", "Assign a vendor and set priority"] },
      { title: "Generate a purchase order", steps: ["Open a work order", "Click 'Generate PO'", "Set amount and scope", "Send to vendor for signature via unique link"] },
    ],
  },
  {
    title: "Vendors",
    icon: Users,
    items: [
      { title: "Add a vendor", steps: ["Go to Vendors page", "Click '+ Add Vendor'", "Enter company details and trade specialties", "Vendor will appear in work order assignment dropdowns"] },
    ],
  },
  {
    title: "Applications & Permits",
    icon: FileStack,
    items: [
      { title: "View building applications", steps: ["Open a property detail page", "Switch to the Applications tab", "Auto-synced DOB/BIS applications appear here", "Add tenant notes to track permit activity"] },
    ],
  },
  {
    title: "Notifications & Alerts",
    icon: Bell,
    items: [
      { title: "Set up SMS alerts", steps: ["Go to a property's settings", "Enter the owner's phone number", "Toggle 'Enable SMS Alerts'", "You'll receive texts when new violations are detected"] },
      { title: "Configure email digests", steps: ["Go to Settings page", "Switch to Email tab", "Choose digest frequency (daily/weekly)", "Select which event types to include"] },
    ],
  },
  {
    title: "Finance",
    icon: Receipt,
    items: [
      { title: "CAM charge management", steps: ["Go to CAM Charges page", "Create a budget for a property and year", "Add line items by category", "Allocate charges to tenants"] },
      { title: "Owner statements", steps: ["Go to Owner Statements page", "Select a property and date range", "Review income and expense summaries", "Export or print the statement"] },
    ],
  },
  {
    title: "Reports & Settings",
    icon: Settings,
    items: [
      { title: "Build custom reports", steps: ["Go to Reports page", "Select report type and date range", "Filter by property or violation type", "Export to PDF or CSV"] },
      { title: "Manage your profile", steps: ["Go to Settings page", "Update company name and license info", "Set PO terms & conditions", "Configure Telegram bot integration"] },
    ],
  },
];

export function HowToGuides() {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();

  const filtered = GUIDES.map((g) => ({
    ...g,
    items: g.items.filter(
      (i) => i.title.toLowerCase().includes(q) || i.steps.some((s) => s.toLowerCase().includes(q))
    ),
  })).filter((g) => g.items.length > 0 || g.title.toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search guides..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No guides match your search.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((guide) => (
            <Card key={guide.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <guide.icon className="h-4 w-4 text-muted-foreground" />
                  {guide.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {guide.items.map((item) => (
                  <Collapsible key={item.title}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium hover:text-primary transition-colors py-1">
                      {item.title}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1 pl-2 pt-1 pb-2">
                        {item.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
