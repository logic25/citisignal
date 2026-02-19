import { useEffect, useState } from "react";
import { Clock, Circle, BarChart3, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RoadmapItem {
  id: string;
  phase: string;
  title: string;
  sort_order: number;
}

const phaseConfig: Record<string, { label: string; icon: typeof Clock; bg: string; text: string; border: string; dot: string }> = {
  live: { label: "Live", icon: CheckCircle2, bg: "bg-success/10", text: "text-success", border: "border-success/20", dot: "bg-success" },
  in_progress: { label: "In Progress", icon: Clock, bg: "bg-warning/10", text: "text-warning", border: "border-warning/20", dot: "bg-warning" },
  next_up: { label: "Next Up", icon: ArrowRight, bg: "bg-primary/10", text: "text-primary", border: "border-primary/20", dot: "bg-primary" },
  future: { label: "Future", icon: Circle, bg: "bg-muted", text: "text-muted-foreground", border: "border-border", dot: "bg-muted-foreground" },
};

const phaseOrder = ["live", "in_progress", "next_up", "future"];

const stats = [
  { value: "9", label: "NYC Agencies Monitored" },
  { value: "3", label: "Messaging Channels" },
  { value: "A–F", label: "Compliance Grading" },
  { value: "24/7", label: "Automated Sync" },
];

const Roadmap = () => {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoadmap = async () => {
      const { data, error } = await supabase
        .from("roadmap_items" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      
      if (!error && data) {
        setItems(data as any[]);
      }
      setLoading(false);
    };
    fetchRoadmap();
  }, []);

  // Group by phase
  const grouped = phaseOrder
    .map(phase => ({
      phase,
      config: phaseConfig[phase],
      items: items.filter(i => i.phase === phase),
    }))
    .filter(g => g.items.length > 0);

  return (
    <section id="roadmap" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            Platform Status
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            What's next for CitiSignal
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The core platform is live and actively used. Here's what we're building next.
          </p>
        </div>

        {/* Stats bar */}
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {stats.map((stat, i) => (
            <div key={i} className="text-center p-4 rounded-xl border border-border bg-card">
              <div className="font-display text-2xl font-bold text-foreground mb-1">{stat.value}</div>
              <div className="text-xs text-muted-foreground font-medium">{stat.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading roadmap...</div>
        ) : (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {grouped.map(({ phase, config, items: phaseItems }) => {
              const Icon = config.icon;
              return (
                <div key={phase} className={`rounded-xl border ${config.border} bg-card p-6`}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${config.text}`} />
                    </div>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${config.text}`}>
                      {config.label}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {phaseItems.map((item) => (
                      <li key={item.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot} mt-1.5 shrink-0`} />
                        {item.title}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default Roadmap;
