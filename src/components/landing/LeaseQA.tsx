import { Sparkles, MessageCircle, Quote, Building2, FileText, Shield } from "lucide-react";

const LeaseQA = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                Property Intelligence
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Ask your property anything
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Get instant answers about violations, lease terms, compliance deadlines, and more — all backed by your actual data. Upload leases and get cited answers with exact page references.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Shield, question: "Which violations are overdue at 708 E Tremont?" },
                  { icon: FileText, question: "Who's responsible for sprinkler inspections per the lease?" },
                  { icon: Building2, question: "What's the compliance score trend this quarter?" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-muted-foreground">
                    <item.icon className="w-5 h-5 text-accent shrink-0" />
                    <span className="text-sm">{item.question}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="px-2 py-1 rounded bg-secondary font-medium">Telegram</span>
                <span className="px-2 py-1 rounded bg-secondary font-medium">Web Dashboard</span>
                <span>Ask from either channel</span>
              </div>
            </div>

            {/* Chat Demo */}
            <div className="relative">
              <div className="absolute inset-0 bg-accent/5 rounded-2xl blur-xl" />
              <div className="relative bg-card rounded-xl border border-border shadow-card overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Property Assistant</span>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">AI-Powered</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="p-4 space-y-4">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="max-w-[80%] px-4 py-2 rounded-2xl rounded-tr-none bg-primary text-primary-foreground text-sm">
                      @ai Who's responsible for the sprinkler system at 708 E Tremont?
                    </div>
                  </div>

                  {/* AI response */}
                  <div className="flex justify-start">
                    <div className="max-w-[90%] space-y-3">
                      <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-secondary text-secondary-foreground text-sm">
                        <p className="mb-3">
                          Based on the lease and current violations, the <strong>tenant is responsible for sprinkler inspections</strong> within the demised premises. There's also an active FDNY violation for this — due Mar 1.
                        </p>
                        
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-card border border-border">
                          <Quote className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <p className="text-muted-foreground mb-1">Lease Section 7.2, Page 14</p>
                            <p className="italic">"Tenant shall maintain and inspect all fire suppression equipment..."</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
                        ⚠️ Active violation: FDNY sprinkler inspection overdue. Compliance impact: -12 pts.
                      </div>
                    </div>
                  </div>

                  {/* Team note */}
                  <div className="flex justify-end">
                    <div className="max-w-[80%] px-4 py-2 rounded-2xl rounded-tr-none bg-muted text-muted-foreground text-sm">
                      Called tenant about this — they'll schedule with vendor this week.
                    </div>
                  </div>
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-border">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Type @ai to ask the assistant, or leave a note...</span>
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

export default LeaseQA;
