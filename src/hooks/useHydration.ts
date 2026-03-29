/**
 * Hook to check whether async IndexedDB stores have finished hydrating.
 *
 * Zustand `persist` with IndexedDB (async storage) means the store's initial
 * state is the *default* (empty) state. The real data arrives asynchronously
 * a few milliseconds later. Components that render before hydration see
 * `isInitialized=false`, `engine=null`, etc., and may incorrectly redirect
 * to `/franchise/new` or show "No franchise loaded" states.
 *
 * Usage:
 *   const hydrated = useFranchiseHydrated();
 *   if (!hydrated) return <LoadingSpinner text="Loading..." />;
 *   // ...now safe to check engine/season/isInitialized
 */
import { useFranchiseStore } from '@/stores/franchiseStore.ts';

/** Returns true once the franchise IndexedDB store has finished rehydration. */
export function useFranchiseHydrated(): boolean {
  return useFranchiseStore(s => s._hasHydrated);
}
