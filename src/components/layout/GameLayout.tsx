import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';

interface GameLayoutProps {
  children: ReactNode;
}

export function GameLayout({ children }: GameLayoutProps) {
  const navigate = useNavigate();
  const { isInitialized, _hasHydrated } = useFranchiseStore();

  return (
    <div className="relative min-h-screen bg-[#0a0f1a]">
      {/* Small top-right overlay menu */}
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
        {_hasHydrated && isInitialized && (
          <button
            onClick={() => navigate('/franchise')}
            className="px-3 py-1.5 rounded bg-navy-light/80 border border-navy-lighter/50 font-mono text-xs text-cream-dim hover:text-cream hover:border-gold/30 transition-colors cursor-pointer backdrop-blur-sm"
          >
            ← Franchise
          </button>
        )}
        <button
          onClick={() => navigate('/')}
          className="px-3 py-1.5 rounded bg-navy-light/80 border border-navy-lighter/50 font-mono text-xs text-cream-dim hover:text-cream hover:border-gold/30 transition-colors cursor-pointer backdrop-blur-sm"
        >
          Menu
        </button>
      </div>

      {children}
    </div>
  );
}
