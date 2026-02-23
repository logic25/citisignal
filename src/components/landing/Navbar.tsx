import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Radio, Menu, X } from "lucide-react";
import { useState } from "react";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Radio className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">CitiSignal</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="hero" size="sm">
                Request Invite
              </Button>
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5 text-foreground" /> : <Menu className="w-5 h-5 text-foreground" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-border/50 mt-2 pt-4 space-y-3">
            <a href="#features" className="block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileOpen(false)}>
              Features
            </a>
            <a href="#how-it-works" className="block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileOpen(false)}>
              How It Works
            </a>
            <a href="#pricing" className="block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileOpen(false)}>
              Pricing
            </a>
            <div className="flex gap-3 pt-2">
              <Link to="/auth">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link to="/auth">
                <Button variant="hero" size="sm">Request Invite</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
