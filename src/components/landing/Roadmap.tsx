import { Clock, Circle, BarChart3, Zap } from "lucide-react";

const phases = [
  {
    status: "in_progress",
    label: "In Progress",
    title: "Messaging & Data Expansion",
    items: [
      "WhatsApp bot integration",
      "OATH hearing & penalty sync",
      "Stop Work Order / Vacate Order detection refinement",
      "TCO expiration critical alerts",
      "Enhanced violation suppression thresholds",
    ],
  },
  {
    status: "planned",
    label: "Planned",
    title: "Intelligence & Scale",
    items: [
      "Google Calendar sync for deadlines",
      "Portfolio-level analytics dashboards",
      "OER tracking (E-designations, Phase I/II ESA)",
      "White-label / multi-tenant support",
      "Enhanced RAG for document Q&A",
      "Vendor COI auto-renewal reminders",
    ],
  },
];

const stats = [
  { value: "9", label: "NYC Agencies Monitored" },
  { value: "3", label: "Messaging Channels" },
  { value: "A–F", label: "Compliance Grading" },
  { value: "24/7", label: "Automated Sync" },
];

const statusConfig = {
  in_progress: { icon: Clock, bg: "bg-warning/10", text: "text-warning", border: "border-warning/20", dot: "bg-warning" },
  planned: { icon: Circle, bg: "bg-muted", text: "text-muted-foreground", border: "border-border", dot: "bg-muted-foreground" },
};

const Roadmap = () => {
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

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {phases.map((phase, i) => {
            const config = statusConfig[phase.status as keyof typeof statusConfig];
            const Icon = config.icon;
            return (
              <div key={i} className={`rounded-xl border ${config.border} bg-card p-6`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${config.text}`} />
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${config.text}`}>
                    {phase.label}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-4">
                  {phase.title}
                </h3>
                <ul className="space-y-2">
                  {phase.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} mt-1.5 shrink-0`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Roadmap;
