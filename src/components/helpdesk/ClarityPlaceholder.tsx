import { ExternalLink, Video, Flame, MousePointer2, ArrowDownToLine, Zap, LayoutDashboard, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const METRICS = [
  {
    icon: Video,
    title: "Session Recordings",
    description: "Watch real users click, scroll, and navigate. Understand exactly where they get confused or give up.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Flame,
    title: "Heatmaps",
    description: "See which parts of each page users click on most — and which parts they completely ignore.",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    icon: Zap,
    title: "Rage Clicks",
    description: "Spots where users click repeatedly in frustration — usually indicating something broken or confusing.",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  {
    icon: ArrowDownToLine,
    title: "Scroll Depth",
    description: "How far down a page users scroll before leaving. Shows if critical content is being seen.",
    color: "text-success",
    bg: "bg-success/10",
  },
  {
    icon: MousePointer2,
    title: "Dead Clicks",
    description: "Clicks on elements users expect to be interactive but aren't — reveals misleading UI patterns.",
    color: "text-warning",
    bg: "bg-warning/10",
  },
  {
    icon: LayoutDashboard,
    title: "Insights Dashboard",
    description: "AI-generated highlights from Clarity summarizing the biggest friction points in your app.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
];

const CLARITY_SCRIPT = `(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window,document,"clarity","script","YOUR_CLARITY_TAG_ID");`;

export function ClarityPlaceholder() {
  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Status Banner */}
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="w-10 h-10 rounded-full bg-warning/15 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">Microsoft Clarity is not yet connected</h3>
              <p className="text-sm text-muted-foreground">
                Clarity adds session recording, heatmaps, and rage-click detection — all free, with no data limits.
                Create a project at clarity.microsoft.com and paste your tag ID into <code className="text-xs bg-muted px-1 py-0.5 rounded">index.html</code>.
              </p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 gap-2" asChild>
              <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer">
                Create Clarity Project <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* What you'll see */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">What you'll see once Clarity is connected</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {METRICS.map((metric) => {
              const Icon = metric.icon;
              return (
                <Tooltip key={metric.title}>
                  <TooltipTrigger asChild>
                    <Card className="cursor-default hover:shadow-sm transition-shadow">
                      <CardContent className="p-4 flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg ${metric.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4.5 h-4.5 ${metric.color}`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">{metric.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{metric.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>{metric.description}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Setup Instructions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              How to activate Clarity
              <Badge variant="outline" className="text-[10px] font-normal">2 steps</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
              <div>
                <p className="text-sm font-medium">Create a Clarity project for CitiSignal</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Go to{" "}
                  <a
                    href="https://clarity.microsoft.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:no-underline"
                  >
                    clarity.microsoft.com
                  </a>
                  {" "}→ New Project → copy the tag ID (it looks like <code className="bg-muted px-1 py-0.5 rounded text-xs">abc1def23</code>).
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
              <div className="flex-1">
                <p className="text-sm font-medium">Paste this script into <code className="text-xs bg-muted px-1 py-0.5 rounded">index.html</code> inside <code className="text-xs bg-muted px-1 py-0.5 rounded">&lt;head&gt;</code></p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Replace <code className="bg-muted px-1 py-0.5 rounded text-xs">YOUR_CLARITY_TAG_ID</code> with the tag ID you copied above.
                </p>
                <div className="relative rounded-lg bg-muted/60 border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/80">
                    <span className="text-xs text-muted-foreground font-mono">index.html — inside &lt;head&gt;</span>
                    <Badge variant="secondary" className="text-[10px]">JavaScript</Badge>
                  </div>
                  <pre className="p-3 text-xs font-mono text-foreground overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                    {`<script type="text/javascript">\n${CLARITY_SCRIPT}\n</script>`}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Why Clarity */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Why Clarity?</span>{" "}
              It's completely free with no data limits or session caps. Session recordings are GDPR-compliant and automatically mask sensitive inputs.
              Once connected, data appears in the Clarity dashboard within ~2 hours of your first user session.
              This CitiSignal tag must be separate from any other app — each Clarity project tracks one domain.
            </p>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
