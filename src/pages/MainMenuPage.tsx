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
            <Button
              size="lg"
              className="w-64"
              onClick={() => navigate('/test')}
              data-testid="quick-test-btn"
            >
              Quick Test Game
            </Button>

            <Button
              size="lg"
              className="w-64"
              onClick={() => navigate('/game/live')}
            >
              Quick Game
            </Button>

            <div className="space-y-2 pt-4">
              <Button
                variant="secondary"
                size="md"
                className="w-64 border-gold/30 hover:border-gold/60"
                onClick={() => navigate('/career/new')}
                data-testid="be-a-player-btn"
              >
                ⚾ Be A Player
              </Button>
              <Button variant="secondary" size="md" className="w-64" onClick={() => navigate('/franchise/new')}>
                New Franchise
              </Button>
              <Button variant="secondary" size="md" className="w-64" onClick={() => navigate('/saves')}>
                Save / Load
              </Button>
              <Button variant="secondary" size="md" className="w-64" onClick={() => navigate('/settings')}>
                Settings
              </Button>
            </div>

            <p className="text-cream-dim/50 text-xs font-mono mt-4">
              Sprints 1-8
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
