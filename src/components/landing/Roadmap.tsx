import { Check, Clock, Circle } from "lucide-react";

const phases = [
  {
    status: "done",
    label: "Live",
    title: "Core Platform",
    items: [
      "Multi-agency violation sync (DOB, ECB, FDNY, HPD, DEP, DOT, DSNY, LPC, DOF)",
      "BIS & DOB NOW application tracking with status decoding",
      "SMS & Telegram bot with AI property intelligence",
      "Compliance scoring (A–F grades per property)",
      "Work order management linked to violations",
      "Lease Q&A with AI-cited answers",
      "Due diligence report generation (PDF export)",
      "Portfolio management with violation roll-ups",
      "Local law compliance engine (LL84, LL87, LL97, etc.)",
      "Email & Telegram notifications with digests",
      "Admin panel with user management & API logs",
    ],
  },
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

const statusConfig = {
  done: { icon: Check, bg: "bg-success/10", text: "text-success", border: "border-success/20", dot: "bg-success" },
  in_progress: { icon: Clock, bg: "bg-warning/10", text: "text-warning", border: "border-warning/20", dot: "bg-warning" },
  planned: { icon: Circle, bg: "bg-muted", text: "text-muted-foreground", border: "border-border", dot: "bg-muted-foreground" },
};

const Roadmap = () => {
  return (
    <section id="roadmap" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-4">
            <Clock className="w-4 h-4" />
            Roadmap
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            What we've built & what's next
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Property Guard is actively developed. Here's the current state of the platform.
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
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
