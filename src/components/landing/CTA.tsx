import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Shield, MessageSquare } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-4 mb-8">
            {[Building2, Shield, MessageSquare].map((Icon, i) => (
              <div
                key={i}
                className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center animate-float"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                <Icon className="w-6 h-6 text-info" />
              </div>
            ))}
          </div>

          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Stop finding out about violations
            <br />
            <span className="text-gradient">from your tenants.</span>
          </h2>

          <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto">
            Join property owners and expeditors who protect their bottom line from their phone — not a dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link to="/auth">
              <Button variant="hero" size="xl">
                Claim My Spot
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="heroDark" size="xl">
                View Features
              </Button>
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/60">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-info" />
              Telegram alerts live
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-info" />
              9 NYC agency integrations
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-info" />
              AI-powered property intelligence
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
