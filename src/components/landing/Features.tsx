import {
  Bell,
  MessageSquare,
  FileCheck,
  BookOpen,
  Zap,
  Building2,
  Shield,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: Bell,
    title: "Multi-Agency Violation Monitoring",
    description: "Real-time alerts from DOB, ECB, FDNY, HPD, DEP, DOT, DSNY, LPC & DOF. Violations are auto-classified by severity with aging deadlines.",
    highlight: "9 Agencies",
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
  },
  {
    icon: MessageSquare,
    title: "Telegram, SMS & WhatsApp Alerts",
    description: "Instant violation alerts and vendor communication via Telegram, SMS, and WhatsApp. Every message saved to the record.",
    highlight: "3 Channels",
    iconBg: "bg-success/10",
    iconColor: "text-success",
  },
  {
    icon: Shield,
    title: "Compliance Scoring",
    description: "Letter-grade compliance scores per property. Track violation history, resolution rates, and local law requirements at a glance.",
    highlight: "A–F Grades",
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
  },
  {
    icon: FileCheck,
    title: "Permit & Application Tracking",
    description: "Full BIS and DOB NOW integration. Track Initial, Subsequent & Post-Approval filings with decoded statuses and CO detection.",
    highlight: "BIS + DOB NOW",
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
  },
  {
    icon: BookOpen,
    title: "Property Intelligence & Lease Q&A",
    description: "Ask any question about your properties or leases via web or Telegram. Get cited answers backed by your actual data — violations, deadlines, and documents.",
    highlight: "AI + Telegram",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    icon: Sparkles,
    title: "Team Property Chat",
    description: "Collaborative chat per property. Leave notes, tag the AI with @ai, and track Telegram messages — all in one thread with full audit trail.",
    highlight: "Collaboration",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            Platform Features
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Everything that protects your bottom line
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Purpose-built for landlords, property managers, and expeditors who need to stay ahead of violations across multiple agencies.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-6 rounded-xl border border-border bg-card hover:shadow-card-hover transition-all duration-300"
            >
              <div className="absolute top-4 right-4">
                <span className="px-2 py-1 rounded text-xs font-medium bg-secondary text-muted-foreground">
                  {feature.highlight}
                </span>
              </div>

              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.iconBg}`}>
                <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
              </div>

              <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed text-sm">
                {feature.description}
              </p>

              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
            <Building2 className="w-8 h-8 text-primary" />
            <div className="text-left">
              <p className="font-medium text-foreground">Multi-property portfolios</p>
              <p className="text-sm text-muted-foreground">Group properties, track violations across your entire portfolio, and generate roll-up reports.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
