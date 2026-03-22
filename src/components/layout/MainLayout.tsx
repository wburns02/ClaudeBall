import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Quick Game', path: '/game/quick' },
  { label: 'Franchise', path: '/franchise', altPath: '/franchise/new' },
  { label: 'Career', path: '/career' },
  { label: 'Historical', path: '/historical' },
  { label: 'Settings', path: '/settings' },
];

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isInitialized = useFranchiseStore(s => s.isInitialized);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const getNavPath = (link: typeof NAV_LINKS[number]) => {
    if (link.altPath && !isInitialized) return link.altPath;
    return link.path;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0f1a]">
      {/* Top navbar */}
      <header className="border-b border-navy-lighter/60 bg-[#060b14] shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="font-display text-xl text-gold tracking-widest uppercase cursor-pointer hover:text-gold/80 transition-colors shrink-0"
          >
            Claude Ball
          </button>

          {/* Nav links */}
          <nav className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
            {NAV_LINKS.map(link => (
              <button
                key={link.path}
                onClick={() => navigate(getNavPath(link))}
                className={cn(
                  'px-2.5 py-1.5 rounded font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0',
                  isActive(link.path)
                    ? 'text-gold bg-gold/10'
                    : 'text-cream-dim hover:text-cream hover:bg-navy-lighter/30',
                )}
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
