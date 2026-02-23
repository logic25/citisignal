import { Building2, Shield, Bell, TrendingUp } from "lucide-react";

const stats = [
  { value: "9", label: "NYC Agency Integrations", icon: Shield },
  { value: "20+", label: "Live Features", icon: TrendingUp },
  { value: "A–F", label: "Compliance Grading", icon: Building2 },
  { value: "3", label: "Alert Channels", icon: Bell },
];

const testimonials = [
  {
    quote: "We used to find out about violations from our tenants complaining. Now we know before they do.",
    name: "Property Manager",
    role: "12-building portfolio, Bronx",
  },
  {
    quote: "The Telegram alerts alone saved us from a $15K ECB penalty. We caught an expired sprinkler cert in time.",
    name: "Building Owner",
    role: "Mixed-use, Manhattan",
  },
  {
    quote: "I dispatch vendors from my phone now. No more back-and-forth emails. The work order is already there.",
    name: "Expeditor",
    role: "50+ properties under management",
  },
];

const SocialProof = () => {
  return (
    <section className="py-24 bg-secondary/30">
      <div className="container mx-auto px-6">
        {/* Stats bar */}
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
          {stats.map((stat, i) => (
            <div key={i} className="text-center p-6 rounded-xl border border-border bg-card">
              <stat.icon className="w-6 h-6 text-accent mx-auto mb-3" />
              <div className="font-display text-3xl font-bold text-foreground mb-1">{stat.value}</div>
              <div className="text-xs text-muted-foreground font-medium">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Trusted by NYC property professionals
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From single-building owners to portfolio managers handling 50+ properties.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="p-6 rounded-xl border border-border bg-card">
              <div className="text-accent text-2xl mb-4">"</div>
              <p className="text-foreground text-sm leading-relaxed mb-6">{t.quote}</p>
              <div className="border-t border-border pt-4">
                <p className="font-medium text-foreground text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
