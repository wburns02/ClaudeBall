import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn.ts';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useLivingDynastyStore } from '@/stores/livingDynastyStore.ts';
import { CareerTimeline } from '@/components/dynasty/CareerTimeline.tsx';
import { DecisionEventModal } from '@/components/dynasty/DecisionEventModal.tsx';
import { BigGameMomentModal } from '@/components/dynasty/BigGameMomentModal.tsx';
import { FamilyPanel } from '@/components/dynasty/FamilyPanel.tsx';

const STAGE_FLAVOR: Record<string, string> = {
  little_league: 'The world is small. The diamond is everything.',
  high_school: 'Under the lights. Scouts in the stands. This is getting real.',
  college: 'The competition is tougher. The stakes are higher. The dream is closer.',
  minor_leagues: 'Bus rides. $25 meal money. The grind. Is it worth it?',
  mlb: 'The Show. Everything you worked for. Don\'t blink.',
  post_career: 'The game goes on without you. But you\'re not done yet.',
  retired: 'The story is written. The legacy remains.',
};

function BalanceBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-cream-dim/60">{label}</span>
        <span className="text-cream/80">{value}</span>
      </div>
      <div className="h-1.5 bg-navy-lighter/40 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export function LivingDynastyPage() {
  const navigate = useNavigate();
  const store = useLivingDynastyStore();

  const [showEvent, setShowEvent] = useState(false);
  const [showMoment, setShowMoment] = useState(false);

  const currentEvent = store.pendingEvents[0] ?? null;
  const currentMoment = store.pendingMoments[0] ?? null;

  // Hydration gate: redirect if no active dynasty
  useEffect(() => {
    if (store._hasHydrated && (!store.isActive || !store.careerStage)) {
      navigate('/dynasty/new', { replace: true });
    }
  }, [store._hasHydrated, store.isActive, store.careerStage, navigate]);

  // Auto-show next event or moment when neither modal is open
  useEffect(() => {
    if (showEvent || showMoment) return;
    if (store.pendingMoments.length > 0) {
      setShowMoment(true);
    } else if (store.pendingEvents.length > 0) {
      setShowEvent(true);
    }
  }, [store.pendingEvents.length, store.pendingMoments.length, showEvent, showMoment]);

  // Loading state
  if (!store._hasHydrated || !store.isActive || !store.careerStage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-cream-dim/50 font-mono text-sm">Loading dynasty...</p>
      </div>
    );
  }

  const career = store.careerStage;
  const flavorText = STAGE_FLAVOR[career.currentStage] ?? '';
  const stageLabel = career.currentStage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const hasPending = store.pendingMoments.length > 0 || store.pendingEvents.length > 0;

  const handleAdvanceSeason = () => {
    store.advanceSeason();
  };

  const handleResolveEvent = (choiceIndex: number) => {
    if (currentEvent) {
      store.resolveEvent(currentEvent.id, choiceIndex);
    }
    setShowEvent(false);
  };

  const handlePlayMoment = () => {
    if (currentMoment) {
      // 65% success bias for playing
      const outcome = Math.random() < 0.65 ? 'success' : 'failure';
      store.resolveMoment(currentMoment.id, outcome);
    }
    setShowMoment(false);
  };

  const handleSimMoment = () => {
    if (currentMoment) {
      // 50/50 for sim
      const outcome = Math.random() < 0.5 ? 'success' : 'failure';
      store.resolveMoment(currentMoment.id, outcome);
    }
    setShowMoment(false);
  };

  const handleSkipMoment = () => {
    if (currentMoment) {
      store.resolveMoment(currentMoment.id, 'neutral');
    }
    setShowMoment(false);
  };

  // Last 10 narrative entries, reversed (newest first)
  const recentNarrative = [...store.narrativeLog].reverse().slice(0, 10);

  return (
    <div className="min-h-screen">
      {/* Decision Event Modal */}
      {showEvent && currentEvent && (
        <DecisionEventModal event={currentEvent} onChoose={handleResolveEvent} />
      )}

      {/* Big Game Moment Modal */}
      {showMoment && currentMoment && (
        <BigGameMomentModal
          moment={currentMoment}
          onPlay={handlePlayMoment}
          onSim={handleSimMoment}
          onSkip={handleSkipMoment}
        />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-navy-lighter/50 bg-navy-dark/60">
        <button
          onClick={() => navigate('/')}
          className="font-display text-gold text-lg tracking-wide hover:text-gold-dim transition-colors cursor-pointer"
        >
          Claude Ball
        </button>
        <p className="font-mono text-cream-dim/60 text-sm">
          Living Dynasty &middot; Season {store.seasonNumber}
        </p>
      </div>

      {/* Career Timeline */}
      <div className="px-6 py-3 overflow-x-auto border-b border-navy-lighter/30 bg-navy-dark/30">
        <CareerTimeline careerStage={career} />
      </div>

      {/* Main content — 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Player Status Panel */}
          <Panel>
            <div className="space-y-4">
              {/* Name + info */}
              <div>
                <h2 className="font-display text-gold text-2xl tracking-wide">{store.playerName}</h2>
                <p className="text-cream-dim/60 text-xs font-mono mt-1">
                  Age {career.age} &middot; {stageLabel} &middot; Year {career.totalSeasons} &middot; {store.region ? store.region.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown Region'}
                </p>
                {flavorText && (
                  <p className="text-cream/60 text-sm italic mt-2">{flavorText}</p>
                )}
              </div>

              {/* Balance bars */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <BalanceBar label="Physical" value={career.physicalBalance} color="bg-green-light/70" />
                <BalanceBar label="Professional" value={career.professionalBalance} color="bg-blue-400/70" />
                <BalanceBar label="Relationships" value={career.relationshipBalance} color="bg-pink-400/70" />
                <BalanceBar label="Mental" value={career.mentalBalance} color="bg-purple-400/70" />
              </div>

              {/* Energy + Burnout */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2 border-t border-navy-lighter/30">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-cream-dim/60">Energy</span>
                    <span className="text-cream/80">{career.energy}/{career.maxEnergy}</span>
                  </div>
                  <div className="h-1.5 bg-navy-lighter/40 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all bg-gold/70"
                      style={{ width: `${(career.energy / career.maxEnergy) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-cream-dim/60">Burnout</span>
                    <span className={cn(
                      'text-xs',
                      career.burnoutMeter > 80 ? 'text-red-400' : career.burnoutMeter > 50 ? 'text-orange-400' : 'text-cream/80'
                    )}>
                      {career.burnoutMeter}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-navy-lighter/40 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        career.burnoutMeter > 80 ? 'bg-red-400/70' : career.burnoutMeter > 50 ? 'bg-orange-400/70' : 'bg-cream-dim/30'
                      )}
                      style={{ width: `${career.burnoutMeter}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* Season Stats Panel */}
          {store.seasonStats && store.seasonStats.gamesPlayed > 0 && (
            <Panel title="Season Stats">
              <div className="grid grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-gold font-display text-xl">{store.seasonStats.gamesPlayed}</p>
                  <p className="text-cream-dim/50 text-xs font-mono uppercase">G</p>
                </div>
                <div>
                  <p className="text-gold font-display text-xl">
                    .{String(Math.round(store.seasonStats.battingAverage * 1000)).padStart(3, '0')}
                  </p>
                  <p className="text-cream-dim/50 text-xs font-mono uppercase">AVG</p>
                </div>
                <div>
                  <p className="text-gold font-display text-xl">{store.seasonStats.homeRuns}</p>
                  <p className="text-cream-dim/50 text-xs font-mono uppercase">HR</p>
                </div>
                <div>
                  <p className="text-gold font-display text-xl">{store.seasonStats.rbi}</p>
                  <p className="text-cream-dim/50 text-xs font-mono uppercase">RBI</p>
                </div>
                <div>
                  <p className="text-gold font-display text-xl">{store.seasonStats.stolenBases}</p>
                  <p className="text-cream-dim/50 text-xs font-mono uppercase">SB</p>
                </div>
              </div>
            </Panel>
          )}

          {/* Action area */}
          <div className="flex justify-center">
            {hasPending ? (
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  if (store.pendingMoments.length > 0) {
                    setShowMoment(true);
                  } else if (store.pendingEvents.length > 0) {
                    setShowEvent(true);
                  }
                }}
              >
                Continue Story ({store.pendingMoments.length + store.pendingEvents.length} remaining)
              </Button>
            ) : (
              <Button
                size="lg"
                disabled={store.isAdvancing}
                onClick={handleAdvanceSeason}
                className="bg-gradient-to-r from-gold to-gold-dim text-navy font-bold"
              >
                {store.isAdvancing ? 'Advancing...' : 'Advance to Next Season \u2192'}
              </Button>
            )}
          </div>

          {/* Narrative Log Panel */}
          <Panel title="My Story">
            {recentNarrative.length === 0 ? (
              <p className="text-cream-dim/40 text-sm italic">Your story has just begun...</p>
            ) : (
              <div className="space-y-3">
                {recentNarrative.map(entry => (
                  <div key={entry.id} className="border-l-2 border-navy-lighter/40 pl-3 py-1">
                    <div className="flex items-center gap-2 text-xs font-mono text-cream-dim/50 mb-0.5">
                      <span>Age {entry.age}</span>
                      <span>&middot;</span>
                      <span className="text-gold/70">{entry.title}</span>
                    </div>
                    <p className="text-cream/70 text-sm leading-relaxed">{entry.text}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-4">
          {store.family && <FamilyPanel family={store.family} />}
        </div>
      </div>
    </div>
  );
}
