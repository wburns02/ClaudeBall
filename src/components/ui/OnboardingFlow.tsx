/**
 * OnboardingFlow — first-time user guided tour.
 * Shows 5 steps introducing the key features of ClaudeBall.
 * Only appears once (persisted to localStorage).
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';

const ONBOARDING_KEY = 'claudeball-onboarding-done';

interface Step {
  title: string;
  description: string;
  detail: string;
  action?: { label: string; path: string };
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Claude Ball',
    description: 'A deep baseball franchise simulator with pixel-art live games, 30 teams, and dozens of management tools.',
    detail: 'Build a dynasty, manage your roster, scout prospects, and compete for the World Series.',
  },
  {
    title: 'Start a Franchise',
    description: 'Pick a team from 30 original franchises and take control as GM.',
    detail: 'Manage the roster, set lineups, hire coaching staff, and make trades to build a winner.',
    action: { label: 'New Franchise', path: '/franchise/new' },
  },
  {
    title: 'Play Live Games',
    description: 'Watch your team in action with gorgeous 16-bit pixel art stadiums.',
    detail: 'Day games, sunset games, and night games — each with dynamic crowd and atmosphere. Control pitch-by-pitch or let the AI manage.',
    action: { label: 'Quick Play', path: '/game/quick' },
  },
  {
    title: 'Deep Management',
    description: 'Trade Machine, Free Agency, Draft, Minor Leagues, Coaching Staff, Team Compare, and more.',
    detail: 'Every tool a real GM needs: scouting reports with 20-80 grades, contract extensions, waiver wire claims, and a full trade deadline experience.',
  },
  {
    title: 'Build a Dynasty',
    description: 'Play endless seasons with Dynasty Mode. Season Story, Awards Ceremony, Hall of Records, and 23 Achievements.',
    detail: 'Advance through offseasons with player aging, contract expiration, drafts, and free agency. Build a multi-year legacy. Press ? anytime for help.',
    action: { label: 'Get Started', path: '/' },
  },
];

export function OnboardingFlow() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShow(false);
  };

  const nextStep = () => {
    if (step >= STEPS.length - 1) {
      dismiss();
      return;
    }
    setAnimating(true);
    setTimeout(() => { setStep(s => s + 1); setAnimating(false); }, 200);
  };

  const goToAction = (path: string) => {
    dismiss();
    navigate(path);
  };

  if (!show) return null;

  const s = STEPS[step]!;
  const isLast = step === STEPS.length - 1;
  const pct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 bg-black/90 z-[150] flex items-center justify-center p-4">
      <div className={cn(
        'max-w-md w-full rounded-2xl border-2 border-gold/40 bg-navy-light overflow-hidden shadow-2xl transition-opacity duration-200',
        animating ? 'opacity-0' : 'opacity-100',
      )}>
        {/* Progress bar */}
        <div className="h-1 bg-navy-lighter/30">
          <div className="h-full bg-gold transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Step counter */}
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] text-gold/50 uppercase tracking-widest">Step {step + 1} of {STEPS.length}</p>
            <button onClick={dismiss} className="font-mono text-[10px] text-cream-dim/40 hover:text-cream-dim transition-colors cursor-pointer">
              Skip Tour
            </button>
          </div>

          {/* Title */}
          <h2 className="font-display text-2xl text-gold uppercase tracking-wide">{s.title}</h2>

          {/* Description */}
          <p className="font-body text-sm text-cream leading-relaxed">{s.description}</p>
          <p className="font-mono text-xs text-cream-dim/60 leading-relaxed">{s.detail}</p>

          {/* Dots */}
          <div className="flex justify-center gap-2 py-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-300',
                  i === step ? 'bg-gold w-6' : i < step ? 'bg-gold/40' : 'bg-navy-lighter/40',
                )}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {s.action && !isLast && (
              <Button variant="secondary" className="flex-1" onClick={() => goToAction(s.action!.path)}>
                {s.action.label}
              </Button>
            )}
            <Button className="flex-1" onClick={isLast && s.action ? () => goToAction(s.action!.path) : nextStep}>
              {isLast ? (s.action?.label ?? 'Get Started') : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
