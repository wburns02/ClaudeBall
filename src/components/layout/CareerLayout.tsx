import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn.ts';
import { useCareerStore } from '@/stores/careerStore.ts';

const NAV_LINKS = [
  { label: 'Dashboard', path: '/career' },
  { label: 'Stats',     path: '/career/stats' },
  { label: 'Training',  path: '/career/training' },
  { label: 'Contract',  path: '/career/contract' },
  { label: 'HOF',       path: '/career/hof' },
];

interface CareerLayoutProps {
  children: ReactNode;
}

export function CareerLayout({ children }: CareerLayoutProps) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const careerState = useCareerStore(s => s.careerState);
  const pendingMilestones = careerState?.pendingMilestones ?? [];

  const isActive = (path: string) => {
    if (path === '/career') return location.pathname === '/career';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0f1a]">
      {/* Top navbar */}
      <header className="border-b border-navy-lighter/60 bg-[#060b14] shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <button
            onClick={() => navigate('/')}
            className="font-display text-xl text-gold tracking-widest uppercase cursor-pointer hover:text-gold/80 transition-colors shrink-0"
          >
            Claude Ball
          </button>
          <button
            onClick={() => navigate('/')}
            className="font-mono text-xs text-cream-dim hover:text-cream cursor-pointer"
          >
            ← Menu
          </button>

          {/* Career sub-nav */}
          <nav className="flex items-center gap-1 flex-1">
            {NAV_LINKS.map(link => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={cn(
                  'relative px-3 py-1.5 rounded font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer',
                  isActive(link.path)
                    ? 'text-gold bg-gold/10'
                    : 'text-cream-dim hover:text-cream hover:bg-navy-lighter/30',
                )}
              >
                {link.label}
                {link.label === 'Dashboard' && pendingMilestones.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                    {pendingMilestones.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Player info chip */}
          {careerState && (
            <div className="font-mono text-xs text-cream-dim/60 shrink-0 hidden md:block">
              {careerState.player.firstName} {careerState.player.lastName} ·{' '}
              <span className="text-gold">{careerState.level}</span> ·{' '}
              Yr {careerState.year}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
