import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import { Panel } from '@/components/ui/Panel.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';

export function MainMenuPage() {
  const navigate = useNavigate();
  const { season, userTeamId, teams, _hasHydrated } = useFranchiseStore();

  // Wait for IDB hydration before evaluating franchise state so "Continue" button isn't hidden during hydration
  const hasFranchise = _hasHydrated && !!season && !!userTeamId;
  const userTeam = hasFranchise ? teams?.find(t => t.id === userTeamId) : null;
  const record = hasFranchise && season && userTeamId ? (() => {
    const standing = season.standings?.getRecord?.(userTeamId);
    if (standing) return `${standing.wins}-${standing.losses}`;
    return null;
  })() : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-8">
        {/* Logo / Title */}
        <div className="text-center space-y-3">
          <h1 className="font-display text-6xl text-gold tracking-tight uppercase">
            Claude Ball
          </h1>
          <p className="font-mono text-cream-dim text-sm tracking-widest uppercase">
            Baseball Simulator
          </p>
          <div className="w-24 h-0.5 bg-gold/30 mx-auto mt-4" />
        </div>

        {/* Continue Franchise */}
        {hasFranchise && (
          <Panel className="text-center">
            <div className="py-4 space-y-3">
              <p className="text-cream-dim/40 text-[10px] font-mono tracking-widest uppercase">Continue</p>
              <button
                onClick={() => navigate('/franchise')}
                className="w-72 mx-auto block rounded-lg border-2 border-gold/50 bg-gold/10 px-6 py-4 transition-all duration-200 hover:bg-gold/20 hover:border-gold hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                data-testid="continue-franchise-btn"
              >
                <p className="font-display text-gold text-lg tracking-wide uppercase">
                  {userTeam ? `${userTeam.city} ${userTeam.name}` : 'Continue Franchise'}
                </p>
                {record && (
                  <p className="font-mono text-cream-dim text-xs mt-1">
                    {record} &middot; Season {season!.year} &middot; Day {season!.currentDay}
                  </p>
                )}
              </button>
            </div>
          </Panel>
        )}

        {/* Menu */}
        <Panel className="text-center">
          <div className="space-y-3 py-4">

            {/* Exhibition / Play Now section */}
            <div className="space-y-2">
              <p className="text-cream-dim/40 text-[10px] font-mono tracking-widest uppercase">Play Now</p>
              <Button
                size="lg"
                className="w-64"
                onClick={() => navigate('/game/setup')}
                data-testid="exhibition-setup-btn"
              >
                Exhibition Game
              </Button>
              <Button
                size="lg"
                className="w-64"
                onClick={() => navigate('/game/quick')}
                data-testid="quick-play-btn"
              >
                Quick Play
              </Button>
              <Button
                size="lg"
                className="w-64 bg-gradient-to-r from-gold/80 to-gold border-gold"
                onClick={() => navigate('/game/derby')}
                data-testid="hr-derby-btn"
              >
                Home Run Derby
              </Button>
            </div>

            {/* Dynasty Mode — flagship feature, top of modes */}
            <div className="pt-4">
              <p className="text-cream-dim/40 text-[10px] font-mono tracking-widest uppercase">Dynasty</p>
              <button
                onClick={() => navigate('/dynasty/new')}
                data-testid="dynasty-mode-btn"
                className="w-72 mx-auto block rounded-lg border-2 border-gold/50 bg-gradient-to-r from-gold/15 to-amber-500/15 px-6 py-4 transition-all duration-200 hover:from-gold/25 hover:to-amber-500/25 hover:border-gold hover:scale-[1.02] active:scale-[0.98] cursor-pointer mt-2"
              >
                <p className="font-display text-gold text-lg tracking-wide uppercase">Dynasty Mode</p>
                <p className="font-mono text-cream-dim text-xs mt-1">Classic GM or Full RPG Career</p>
              </button>
            </div>

            {/* Other modes */}
            <div className="space-y-2 pt-4">
              <p className="text-cream-dim/40 text-[10px] font-mono tracking-widest uppercase">More Modes</p>
              <Button variant="secondary" size="md" className="w-64" onClick={() => navigate('/franchise/new')}>
                New Franchise
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="w-64 border-gold/30 hover:border-gold/60"
                onClick={() => navigate('/historical')}
                data-testid="historical-mode-btn"
              >
                Historical Mode
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="w-64 border-gold/30 hover:border-gold/60"
                onClick={() => navigate('/career/new')}
                data-testid="be-a-player-btn"
              >
                Be A Player
              </Button>
            </div>

            {/* System */}
            <div className="space-y-2 pt-2">
              <Button variant="secondary" size="md" className="w-64" onClick={() => navigate('/saves')}>
                Save / Load
              </Button>
              <Button variant="secondary" size="md" className="w-64" onClick={() => navigate('/settings')}>
                Settings
              </Button>
              <Button variant="secondary" size="md" className="w-64" onClick={() => navigate('/achievements')}>
                Achievements
              </Button>
              <Button variant="secondary" size="md" className="w-64" onClick={() => navigate('/ideas')}>
                Ideas & Feedback
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-64"
                onClick={() => navigate('/test')}
                data-testid="quick-test-btn"
              >
                Test Harness
              </Button>
            </div>

            <p className="text-cream-dim/50 text-xs font-mono mt-4">
              65 pages · 20 features · Dynasty Mode
            </p>
          </div>
        </Panel>

        <p className="text-center text-cream-dim/30 text-xs font-mono">
          v1.0.0 — Inspired by Front Page Sports: Baseball Pro '98
        </p>
      </div>
    </div>
  );
}
