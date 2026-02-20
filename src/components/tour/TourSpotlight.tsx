import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTour } from './TourContext';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const r = el.getBoundingClientRect();
  return {
    top: r.top - PADDING,
    left: r.left - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

function TooltipCard({
  rect,
  title,
  message,
  step,
  total,
  onNext,
  onPrev,
  onSkip,
  isLast,
}: {
  rect: Rect | null;
  title: string;
  message: string;
  step: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isLast: boolean;
}) {
  const CARD_WIDTH = 320;
  const CARD_HEIGHT = 200; // estimate
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;

  if (rect) {
    // Try right first, then left, then below, then above
    if (rect.left + rect.width + CARD_WIDTH + 16 < vw) {
      // right
      left = rect.left + rect.width + 12;
      top = rect.top + rect.height / 2 - CARD_HEIGHT / 2;
    } else if (rect.left - CARD_WIDTH - 12 > 0) {
      // left
      left = rect.left - CARD_WIDTH - 12;
      top = rect.top + rect.height / 2 - CARD_HEIGHT / 2;
    } else if (rect.top + rect.height + CARD_HEIGHT + 12 < vh) {
      // below
      top = rect.top + rect.height + 12;
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
    } else {
      // above
      top = rect.top - CARD_HEIGHT - 12;
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
    }

    // Clamp to viewport
    top = Math.max(12, Math.min(top, vh - CARD_HEIGHT - 12));
    left = Math.max(12, Math.min(left, vw - CARD_WIDTH - 12));
  } else {
    // Center fallback
    top = vh / 2 - CARD_HEIGHT / 2;
    left = vw / 2 - CARD_WIDTH / 2;
  }

  return (
    <div
      className="fixed z-[10002] bg-card border border-border rounded-xl shadow-2xl p-5 flex flex-col gap-3 transition-all duration-300"
      style={{ top, left, width: CARD_WIDTH }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-display font-bold text-sm text-foreground">{title}</h3>
        </div>
        <button
          onClick={onSkip}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message */}
      <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground font-medium">
          {step + 1} of {total}
        </span>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onPrev}>
              <ChevronLeft className="w-3 h-3" />
              Back
            </Button>
          )}
          <Button variant="hero" size="sm" className="h-7 text-xs gap-1" onClick={onNext}>
            {isLast ? "You're ready!" : 'Next'}
            {!isLast && <ChevronRight className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-1 justify-center">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`rounded-full transition-all duration-200 ${
              i === step
                ? 'w-4 h-1.5 bg-primary'
                : 'w-1.5 h-1.5 bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export const TourSpotlight = () => {
  const { isActive, currentStep, currentStepData, totalSteps, nextStep, prevStep, skipTour } =
    useTour();
  const [rect, setRect] = useState<Rect | null>(null);

  const updateRect = useCallback(() => {
    if (!currentStepData) return;
    // small delay to let DOM settle after navigation
    setTimeout(() => {
      setRect(getTargetRect(currentStepData.target));
    }, 120);
  }, [currentStepData]);

  useEffect(() => {
    if (!isActive) return;
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [isActive, updateRect]);

  if (!isActive || !currentStepData) return null;

  const overlay = (
    <>
      {/* Dark backdrop using clip-path hole */}
      {rect ? (
        <svg
          className="fixed inset-0 z-[10000] pointer-events-none"
          style={{ width: '100vw', height: '100vh' }}
        >
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx={10}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.65)"
            mask="url(#tour-mask)"
          />
        </svg>
      ) : (
        <div className="fixed inset-0 z-[10000] bg-black/65 pointer-events-none" />
      )}

      {/* Highlight ring */}
      {rect && (
        <div
          className="fixed z-[10001] pointer-events-none rounded-xl ring-2 ring-primary ring-offset-0 transition-all duration-300"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}

      {/* Clickable backdrop to skip */}
      <div
        className="fixed inset-0 z-[10001]"
        onClick={skipTour}
        aria-label="Skip tour"
      />

      {/* Tooltip card — above the clickable backdrop */}
      <TooltipCard
        rect={rect}
        title={currentStepData.title}
        message={currentStepData.message}
        step={currentStep}
        total={totalSteps}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTour}
        isLast={currentStep === totalSteps - 1}
      />
    </>
  );

  return createPortal(overlay, document.body);
};
