import type { ReactNode } from 'react';
import { FranchiseSidebar } from './FranchiseSidebar.tsx';
import { PlayerQuickView } from '@/components/player/PlayerQuickView.tsx';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';

interface FranchiseLayoutProps {
  children: ReactNode;
}

export function FranchiseLayout({ children }: FranchiseLayoutProps) {
  const hydrated = useFranchiseStore(s => s._hasHydrated);

  // Block rendering until IndexedDB hydration completes.
  // Without this gate, pages see engine=null / isInitialized=false during the
  // async rehydration window and incorrectly show "No franchise loaded" states
  // or redirect to /franchise/new.
  if (!hydrated) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#0a0f1a]">
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading franchise..." />
        </div>
      </div>
    );
  }

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
