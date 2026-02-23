import { Bell, ClipboardList, Users, CheckCircle } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Bell,
    title: "Violations detected automatically",
    description: "CitiSignal syncs with 9 NYC agencies every day. New violations trigger instant alerts via Telegram, SMS & WhatsApp.",
    sms: {
      type: "incoming",
      message: "⚠️ New FDNY violation at 708 E Tremont. Sprinkler inspection overdue. Due Mar 1. Reply \"details\" for more.",
    },
  },
  {
    number: "02",
    icon: ClipboardList,
    title: "Work order auto-created",
    description: "A work order is generated and linked to the violation. Severity, aging, and deadlines are calculated automatically.",
    sms: {
      type: "system",
      message: "📋 Work Order #1234 created: Resolve FDNY Violation. Priority: High. Compliance score impact: -12 pts.",
    },
  },
  {
    number: "03",
    icon: Users,
    title: "Dispatch vendors from any channel",
    description: "Message your vendors via Telegram, SMS or WhatsApp. The AI assistant can answer their questions with full property context.",
    sms: {
      type: "outgoing",
      message: "Hi Mike, sprinkler inspection needed at 708 E Tremont. FDNY violation, due Mar 1. Available this week?",
    },
  },
  {
    number: "04",
    icon: CheckCircle,
    title: "Resolve & close with audit trail",
    description: "Upload certificates, track progress, and close violations. Your compliance score updates in real time.",
    sms: {
      type: "success",
      message: "✅ Violation resolved. Certificate uploaded. Work Order #1234 closed. Compliance score: A → A+.",
    },
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card text-foreground text-sm font-medium mb-4 border border-border">
            <span className="w-2 h-2 rounded-full bg-success" />
            How It Works
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            From violation to resolution in 4 steps
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            No login required for day-to-day management. Handle everything from your phone via Telegram.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="relative flex gap-6 pb-12 last:pb-0">
              {index < steps.length - 1 && (
                <div className="absolute left-6 top-12 w-px h-[calc(100%-3rem)] bg-border" />
              )}

              <div className="relative z-10 w-12 h-12 rounded-full bg-info flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-info-foreground">{step.number}</span>
              </div>

              <div className="flex-1 pt-1">
                <div className="flex items-center gap-3 mb-2">
                  <step.icon className="w-5 h-5 text-info" />
                  <h3 className="font-display text-xl font-semibold text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  {step.description}
                </p>

                <div className={`
                  inline-block max-w-md p-3 rounded-2xl text-sm
                  ${step.sms.type === 'incoming' ? 'bg-card border border-border rounded-tl-none' : ''}
                  ${step.sms.type === 'outgoing' ? 'bg-primary text-primary-foreground rounded-tr-none ml-auto' : ''}
                  ${step.sms.type === 'system' ? 'bg-secondary text-secondary-foreground border border-border' : ''}
                  ${step.sms.type === 'success' ? 'bg-success/10 text-success border border-success/20' : ''}
                `}>
                  {step.sms.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
