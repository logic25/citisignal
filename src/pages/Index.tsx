import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import VendorDispatch from "@/components/landing/VendorDispatch";
import LeaseQA from "@/components/landing/LeaseQA";
import SocialProof from "@/components/landing/SocialProof";
import Pricing from "@/components/landing/Pricing";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  // Also listen for OAuth sessions that arrive after page load
  // (e.g. after Google OAuth redirects back to the root URL)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        navigate("/dashboard");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // If OAuth callback hash is present, show spinner immediately —
  // the auth system is processing the tokens and will redirect to /dashboard.
  if (window.location.hash.includes('access_token')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // While auth is loading, show spinner so logged-in users
  // never see the landing page flash before being redirected
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is logged in, we're navigating — avoid flash of landing page
  if (user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <VendorDispatch />
      <LeaseQA />
      <SocialProof />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
