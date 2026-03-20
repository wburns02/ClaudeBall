import type { ReactNode } from 'react';
import { FranchiseSidebar } from './FranchiseSidebar.tsx';
import { PlayerQuickView } from '@/components/player/PlayerQuickView.tsx';

interface FranchiseLayoutProps {
  children: ReactNode;
}

export function FranchiseLayout({ children }: FranchiseLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0f1a]">
      <FranchiseSidebar />
      {/* Main scrollable content area */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
      {/* Global player quick-view modal — available from any franchise page */}
      <PlayerQuickView />
    </div>
  );
}
