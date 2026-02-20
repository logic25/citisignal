import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  message: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: 'sidebar-nav',
    title: 'Your Command Center',
    message: 'Everything lives here. Navigate between properties, violations, work orders, and more from this sidebar.',
    position: 'right',
  },
  {
    target: 'properties-nav',
    title: 'Properties',
    message: 'Start by adding your NYC buildings. CitiSignal will monitor each one across 9 city agencies automatically.',
    position: 'right',
  },
  {
    target: 'violations-nav',
    title: 'Violations',
    message: 'Live violations from DOB, FDNY, HPD, and 6 more agencies — synced and surfaced here in real time.',
    position: 'right',
  },
  {
    target: 'work-orders-nav',
    title: 'Work Orders',
    message: 'Create work orders and dispatch vendors directly from a violation. Close the loop without leaving the app.',
    position: 'right',
  },
  {
    target: 'notification-bell',
    title: 'Alerts & Notifications',
    message: "This is where your alerts land. New violations, hearing deadlines, and status changes — you'll know instantly.",
    position: 'bottom',
  },
  {
    target: 'ai-chat-button',
    title: 'CitiSignal AI',
    message: 'Ask CitiSignal anything about your portfolio in plain English. "What violations are due this week?" — just ask.',
    position: 'bottom',
  },
  {
    target: 'help-center-nav',
    title: 'Help Center',
    message: "Need help? Step-by-step guides, bug reports, and feature requests all live here. You're never on your own.",
    position: 'right',
  },
];

const TOUR_STORAGE_KEY = 'citisignal_tour_completed';

interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentStepData: TourStep | null;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  restartTour: () => void;
  hasCompletedTour: boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

export const TourProvider = ({ children }: { children: ReactNode }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(
    () => localStorage.getItem(TOUR_STORAGE_KEY) === 'true'
  );

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const completeTour = useCallback(() => {
    setIsActive(false);
    setHasCompletedTour(true);
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep >= TOUR_STEPS.length - 1) {
      completeTour();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, completeTour]);

  const prevStep = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const skipTour = useCallback(() => {
    completeTour();
  }, [completeTour]);

  const restartTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setHasCompletedTour(false);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps: TOUR_STEPS.length,
        currentStepData: isActive ? TOUR_STEPS[currentStep] : null,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        restartTour,
        hasCompletedTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
};
