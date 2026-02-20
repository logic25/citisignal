import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";
import { ExternalLink, HelpCircle, Loader2 } from "lucide-react";

const FEATURE_LABELS: Record<string, string> = {
  stress_test: "Roadmap Stress Test",
  telemetry_analysis: "Behavior Analysis",
  collection_message: "Collection Email",
  plan_analysis: "Plan Analysis",
  rfp_extract: "RFP Extraction",
  payment_risk: "Payment Risk Score",
  checklist_followup: "Checklist Follow-up",
  extract_tasks: "Task Extraction",
  claimflow: "ClaimFlow Package",
};

const MODEL_LABELS: Record<string, string> = {
  "google/gemini-3-flash-preview": "Gemini Flash (fast, efficient)",
  "google/gemini-2.5-flash": "Gemini Flash 2.5 (multimodal)",
  "google/gemini-2.5-pro": "Gemini Pro (most powerful)",
};

const friendlyFeature = (f: string) => FEATURE_LABELS[f] ?? f.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const friendlyModel = (m: string) => MODEL_LABELS[m] ?? m;

const DATE_RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function TooltipLabel({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-1 cursor-default">
          {children}
          <HelpCircle className="w-3 h-3 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{tip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function AIUsageDashboard() {
  const [rangeDays, setRangeDays] = useState(30);

  const since = subDays(new Date(), rangeDays).toISOString();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["ai-usage-logs", rangeDays],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_usage_logs" as any)
        .select("*, profiles(display_name)")
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rows = logs ?? [];

  // KPIs
  const totalRequests = rows.length;
  const totalTokens = rows.reduce((s: number, r: any) => s + (r.total_tokens || 0), 0);
  const wordsProcessed = Math.round(totalTokens * 0.75);
  const estimatedCost = rows.reduce((s: number, r: any) => s + parseFloat(r.estimated_cost_usd || 0), 0);
  const featuresUsed = new Set(rows.map((r: any) => r.feature)).size;

  // By feature
  const featureMap: Record<string, number> = {};
  rows.forEach((r: any) => {
    featureMap[r.feature] = (featureMap[r.feature] || 0) + 1;
  });
  const featureChartData = Object.entries(featureMap)
    .sort((a, b) => b[1] - a[1])
    .map(([f, count]) => ({ name: friendlyFeature(f), count }));

  // By day
  const dayMap: Record<string, number> = {};
  rows.forEach((r: any) => {
    const day = format(new Date(r.created_at), "MM/dd");
    dayMap[day] = (dayMap[day] || 0) + 1;
  });
  const dailyChartData = Object.entries(dayMap).map(([date, count]) => ({ date, count }));

  // By model
  const modelMap: Record<string, number> = {};
  rows.forEach((r: any) => {
    modelMap[r.model] = (modelMap[r.model] || 0) + 1;
  });
  const modelEntries = Object.entries(modelMap).sort((a, b) => b[1] - a[1]);

  // By user
  const userMap: Record<string, { name: string; count: number }> = {};
  rows.forEach((r: any) => {
    const uid = r.user_id || "unknown";
    const name = r.profiles?.display_name || "Unknown User";
    if (!userMap[uid]) userMap[uid] = { name, count: 0 };
    userMap[uid].count += 1;
  });
  const userEntries = Object.entries(userMap).sort((a, b) => b[1].count - a[1].count);

  // Cost breakdown
  const costMap: Record<string, { requests: number; tokens: number; cost: number }> = {};
  rows.forEach((r: any) => {
    if (!costMap[r.feature]) costMap[r.feature] = { requests: 0, tokens: 0, cost: 0 };
    costMap[r.feature].requests += 1;
    costMap[r.feature].tokens += r.total_tokens || 0;
    costMap[r.feature].cost += parseFloat(r.estimated_cost_usd || 0);
  });
  const costRows = Object.entries(costMap).sort((a, b) => b[1].cost - a[1].cost);

  const isEmpty = totalRequests === 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Date range */}
        <div className="flex items-center gap-2">
          {DATE_RANGES.map(r => (
            <Button
              key={r.days}
              size="sm"
              variant={rangeDays === r.days ? "default" : "outline"}
              onClick={() => setRangeDays(r.days)}
              className="text-xs"
            >
              {r.label}
            </Button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <TooltipLabel tip="How many times AI was used across all features in this period">
                <p className="text-xs text-muted-foreground font-medium">Total Requests</p>
              </TooltipLabel>
              <p className="text-2xl font-bold text-foreground mt-1">{totalRequests.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <TooltipLabel tip="Approximate number of words the AI read and wrote (tokens × 0.75). Not an exact word count.">
                <p className="text-xs text-muted-foreground font-medium">Words Processed</p>
              </TooltipLabel>
              <p className="text-2xl font-bold text-foreground mt-1">{wordsProcessed.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <TooltipLabel tip="Approximate cost based on Gemini Flash pricing ($0.15 per 1M tokens). See Lovable Billing for actual charges.">
                <p className="text-xs text-muted-foreground font-medium">Estimated Cost</p>
              </TooltipLabel>
              <p className="text-2xl font-bold text-foreground mt-1">${estimatedCost.toFixed(4)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <TooltipLabel tip="How many distinct parts of the app have made AI calls in this period">
                <p className="text-xs text-muted-foreground font-medium">Features Using AI</p>
              </TooltipLabel>
              <p className="text-2xl font-bold text-foreground mt-1">{featuresUsed}</p>
            </CardContent>
          </Card>
        </div>

        {isEmpty ? (
          <Card>
            <CardContent className="text-center py-16">
              <p className="text-muted-foreground text-sm">No AI activity recorded in the last {rangeDays} days.</p>
              <p className="text-muted-foreground text-xs mt-1">Run an AI Stress Test or use the Idea Analyzer to generate logs.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Feature chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Requests by Feature</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={featureChartData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        angle={-30}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <RechartsTooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Daily chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Daily AI Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dailyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <RechartsTooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Progress bars row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Models */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">AI Models Used</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {modelEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data</p>
                  ) : modelEntries.map(([model, count]) => {
                    const pct = totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0;
                    return (
                      <div key={model}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground">{friendlyModel(model)}</span>
                          <span className="text-xs text-muted-foreground">{pct}% ({count})</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Users */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Usage by Team Member</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {userEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data</p>
                  ) : userEntries.slice(0, 8).map(([uid, { name, count }]) => {
                    const pct = totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0;
                    return (
                      <div key={uid}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground">{name}</span>
                          <span className="text-xs text-muted-foreground">{pct}% ({count})</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Cost breakdown table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Cost Breakdown by Feature</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium text-muted-foreground">Feature</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Requests</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Words Processed</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costRows.map(([feature, { requests, tokens, cost }]) => (
                        <tr key={feature} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 font-medium text-foreground">{friendlyFeature(feature)}</td>
                          <td className="py-2 text-right text-muted-foreground">{requests}</td>
                          <td className="py-2 text-right text-muted-foreground">{Math.round(tokens * 0.75).toLocaleString()}</td>
                          <td className="py-2 text-right text-muted-foreground">${cost.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <td className="py-2 font-semibold text-foreground">Total</td>
                        <td className="py-2 text-right font-semibold text-foreground">{totalRequests}</td>
                        <td className="py-2 text-right font-semibold text-foreground">{wordsProcessed.toLocaleString()}</td>
                        <td className="py-2 text-right font-semibold text-foreground">${estimatedCost.toFixed(4)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Billing link */}
        <div className="flex justify-end">
          <a
            href="https://lovable.dev/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 underline underline-offset-2"
          >
            View Lovable Billing <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </TooltipProvider>
  );
}
