import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import DashboardSidebar from './DashboardSidebar';
import { NotificationBell } from './NotificationBell';
import { GlobalAIChatButton } from './GlobalAIChatButton';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { TourProvider } from '@/components/tour/TourContext';
import { TourSpotlight } from '@/components/tour/TourSpotlight';

const DashboardLayout = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) {
        setShowOnboarding(false);
        setOnboardingChecked(true);
        return;
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('has_completed_onboarding')
          .eq('user_id', user.id)
          .maybeSingle();

        // Show wizard if no profile or hasn't completed onboarding
        setShowOnboarding(!data || !(data as any).has_completed_onboarding);
      } finally {
        setOnboardingChecked(true);
      }
    };

    checkOnboarding();
  }, [user]);

  if (!onboardingChecked) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <TourProvider>
      <TourSpotlight />
      <div className="flex min-h-screen bg-background">
        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - hidden on mobile, shown via overlay */}
        <div className={cn(
          "fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto transition-transform duration-300",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <DashboardSidebar onNavigate={() => setMobileMenuOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col overflow-auto min-w-0">
          {/* Top bar */}
          <header className="flex items-center justify-between gap-2 px-4 sm:px-8 py-3 border-b border-border/50 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <GlobalAIChatButton />
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </TourProvider>
  );
};

export default DashboardLayout;
