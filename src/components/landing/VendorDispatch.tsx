import { MessageSquare, ClipboardList, Send, CheckCircle, Phone } from "lucide-react";

const VendorDispatch = () => {
  return (
    <section id="vendor-dispatch" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card text-foreground text-sm font-medium mb-4 border border-border">
            <Send className="w-4 h-4" />
            Vendor Dispatch
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Violation comes in. Vendor goes out.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get a sprinkler violation? Text your fire safety contractor directly from the alert. A trackable work order is created automatically.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left: Flow steps */}
            <div className="space-y-6">
              {[
                {
                  icon: MessageSquare,
                  title: "Violation alert hits your phone",
                  description: "FDNY sprinkler violation detected at 708 E Tremont. You get an instant Telegram alert.",
                  color: "destructive",
                },
                {
                  icon: ClipboardList,
                  title: "Work order auto-created",
                  description: "A work order is generated with violation details, severity, and deadline pre-filled.",
                  color: "warning",
                },
                {
                  icon: Send,
                  title: "Dispatch vendor in one tap",
                  description: "Select your contractor, hit send. They get the job details via Telegram. SMS & WhatsApp coming soon.",
                  color: "accent",
                },
                {
                  icon: CheckCircle,
                  title: "Track to resolution",
                  description: "Vendor updates, certificate uploads, and compliance score changes — all in one thread.",
                  color: "success",
                },
              ].map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className={`w-10 h-10 rounded-xl bg-${step.color}/10 flex items-center justify-center shrink-0`}>
                    <step.icon className={`w-5 h-5 text-${step.color}`} />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-foreground mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Phone mockup with chat */}
            <div className="relative">
              <div className="absolute inset-0 bg-accent/5 rounded-2xl blur-xl" />
              <div className="relative bg-card rounded-xl border border-border shadow-card overflow-hidden max-w-sm mx-auto">
                {/* Phone header */}
                <div className="px-4 py-3 border-b border-border bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-success" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground">NYC Fire Safety Inc.</span>
                      <p className="text-xs text-muted-foreground">Fire Safety • COI Active</p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="p-4 space-y-3">
                  {/* System alert */}
                  <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                    ⚠️ FDNY Violation — Sprinkler inspection overdue at 708 E Tremont Ave. Due Mar 1.
                  </div>

                  {/* Outgoing */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] px-4 py-2 rounded-2xl rounded-tr-none bg-primary text-primary-foreground text-sm">
                      Hi Mike, sprinkler inspection needed at 708 E Tremont. FDNY violation, due Mar 1. Can you handle this week?
                    </div>
                  </div>

                  {/* Incoming */}
                  <div className="flex justify-start">
                    <div className="max-w-[85%] px-4 py-2 rounded-2xl rounded-tl-none bg-secondary text-secondary-foreground text-sm">
                      Got it. I can be there Thursday. I'll bring the inspection cert.
                    </div>
                  </div>

                  {/* System update */}
                  <div className="px-3 py-2 rounded-lg bg-success/10 border border-success/20 text-xs text-success">
                    ✅ Work Order #1234 updated: Vendor confirmed for Thursday. Status → In Progress.
                  </div>
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-border">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Reply to vendor...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VendorDispatch;
