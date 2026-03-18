import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import { Panel } from '@/components/ui/Panel.tsx';

export function MainMenuPage() {
  const navigate = useNavigate();

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
            </div>

            {/* Other modes */}
            <div className="space-y-2 pt-4">
              <p className="text-cream-dim/40 text-[10px] font-mono tracking-widest uppercase">Modes</p>
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
              <Button variant="secondary" size="md" className="w-64" onClick={() => navigate('/franchise/new')}>
                New Franchise
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
              Sprints 1-8 + Historical
            </p>
          </div>
        </Panel>

        <p className="text-center text-cream-dim/30 text-xs font-mono">
          v0.1.0 — Inspired by Front Page Sports: Baseball Pro '98
        </p>
      </div>
    </div>
  );
}
