import { Button } from "@/components/ui/button";
import { ArrowRight, Radio, MessageSquare, Shield, Bell, Phone } from "lucide-react";
import { Link } from "react-router-dom";

const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute top-1/4 left-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse-soft" />
            <span className="text-sm font-medium text-primary-foreground/80">Built for NYC Property Owners & Expeditors</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 leading-tight animate-slide-up">
            One missed violation costs $25,000.
            <br />
            <span className="text-gradient">CitiSignal catches it first.</span>
          </h1>

          <p className="text-lg sm:text-xl text-primary-foreground/70 mb-10 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Real-time violation monitoring across 9 NYC agencies. Auto-alerts via Telegram — SMS & WhatsApp coming soon. The cheapest insurance your portfolio has.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Button variant="hero" size="xl">
              Schedule a Demo
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Link to="/auth">
              <Button variant="heroDark" size="xl">
                Sign In
              </Button>
            </Link>
          </div>

          {/* Channel pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            {[
              { icon: Shield, label: "9 NYC Agencies", soon: false },
              { icon: Bell, label: "Telegram", soon: false },
              { icon: Phone, label: "SMS", soon: true },
              { icon: MessageSquare, label: "WhatsApp", soon: true },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-foreground/5 border border-primary-foreground/10"
              >
                <item.icon className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-primary-foreground/80">{item.label}</span>
                {item.soon && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded">Soon</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="mt-20 relative animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
          <div className="max-w-5xl mx-auto">
            <div className="rounded-xl border border-primary-foreground/10 bg-card/5 backdrop-blur-sm p-2 shadow-elevated">
              <div className="rounded-lg bg-card overflow-hidden">
                <div className="p-6">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                        <Radio className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <span className="font-display font-semibold text-foreground">Portfolio Overview</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                        Compliance: A
                      </div>
                      <div className="px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium">
                        3 Active Violations
                      </div>
                    </div>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg border border-border bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-muted-foreground">VIOLATION ALERT</span>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">FDNY</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-2">Sprinkler inspection overdue</p>
                      <p className="text-xs text-muted-foreground">708 E Tremont Ave • Due Mar 1</p>
                    </div>

                    <div className="p-4 rounded-lg border border-border bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-muted-foreground">WORK ORDER</span>
                        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      </div>
                      <p className="text-sm font-medium text-foreground mb-2">Vendor dispatched via Telegram</p>
                      <p className="text-xs text-muted-foreground">NYC Fire Safety Inc. • In Progress</p>
                    </div>

                    <div className="p-4 rounded-lg border border-border bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-muted-foreground">PERMIT STATUS</span>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">Signed Off</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-2">Alt-1 Application #320456</p>
                      <p className="text-xs text-muted-foreground">DOB BIS • Completed</p>
                    </div>
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

export default Hero;
