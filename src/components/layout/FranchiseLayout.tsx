import type { ReactNode } from 'react';
import { FranchiseSidebar } from './FranchiseSidebar.tsx';

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
    </div>
  );
}
