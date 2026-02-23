import { Check, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const tiers = [
  {
    name: "Starter",
    price: "$29",
    period: "/mo",
    description: "For individual owners with 1–5 properties",
    highlight: false,
    features: [
      "Up to 5 properties",
      "9 NYC agency monitoring",
      "Telegram & SMS alerts",
      "Compliance scoring (A–F)",
      "Violation aging & deadlines",
      "Basic reporting",
    ],
  },
  {
    name: "Professional",
    price: "$79",
    period: "/mo",
    description: "For managers and expeditors with growing portfolios",
    highlight: true,
    features: [
      "Up to 25 properties",
      "Everything in Starter",
      "WhatsApp alerts",
      "AI Property Intelligence",
      "Lease Q&A with citations",
      "Vendor dispatch & work orders",
      "Portfolio reports & DD exports",
      "Team collaboration chat",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large portfolios and expediting firms",
    highlight: false,
    features: [
      "Unlimited properties",
      "Everything in Professional",
      "Dedicated onboarding",
      "Custom integrations",
      "Priority support",
      "SLA guarantees",
    ],
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            Beta Pricing
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            A single ECB fine runs $2K–$25K.
            <br />
            <span className="text-gradient">CitiSignal pays for itself with one catch.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Lock in beta pricing now — rates increase at general availability.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier, i) => (
            <div
              key={i}
              className={`relative p-6 rounded-xl border ${
                tier.highlight
                  ? "border-accent bg-card shadow-glow"
                  : "border-border bg-card"
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-bold">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-display text-4xl font-bold text-foreground">{tier.price}</span>
                  {tier.period && <span className="text-muted-foreground text-sm">{tier.period}</span>}
                </div>
                <p className="text-sm text-muted-foreground">{tier.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link to="/auth" className="block">
                <Button
                  variant={tier.highlight ? "hero" : "outline"}
                  className="w-full"
                  size="lg"
                >
                  {tier.price === "Custom" ? "Contact Us" : "Request Invite"}
                  {tier.price !== "Custom" && <ArrowRight className="w-4 h-4" />}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include a 14-day free trial. No credit card required during beta.
        </p>
      </div>
    </section>
  );
};

export default Pricing;
