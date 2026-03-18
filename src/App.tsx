import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ToastContainer } from '@/components/ui/Toast.tsx';
import { SplashScreen } from '@/components/ui/SplashScreen.tsx';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner.tsx';
import { TEAMS as ALL_TEAMS, LEAGUE_STRUCTURE } from '@/engine/data/teams30.ts';
import { FranchiseLayout } from '@/components/layout/FranchiseLayout.tsx';
import { MainLayout } from '@/components/layout/MainLayout.tsx';
import { GameLayout } from '@/components/layout/GameLayout.tsx';

// Eager-load critical path pages
import { MainMenuPage } from '@/pages/MainMenuPage.tsx';
import { TestHarnessPage } from '@/pages/TestHarnessPage.tsx';
import { LiveGamePage } from '@/pages/LiveGamePage.tsx';
import { NewFranchisePage } from '@/pages/NewFranchisePage.tsx';
import { ExhibitionSetupPage } from '@/pages/ExhibitionSetupPage.tsx';
import { QuickPlayPage } from '@/pages/QuickPlayPage.tsx';

// Lazy-load heavier pages
const SprintCTestPage = lazy(() => import('@/SprintCTestPage.tsx').then(m => ({ default: m.SprintCTestPage })));
const FranchiseDashboard = lazy(() => import('@/pages/FranchiseDashboard.tsx').then(m => ({ default: m.FranchiseDashboard })));
const StandingsPage = lazy(() => import('@/pages/StandingsPage.tsx').then(m => ({ default: m.StandingsPage })));
const RosterPage = lazy(() => import('@/pages/RosterPage.tsx').then(m => ({ default: m.RosterPage })));
const TradePage = lazy(() => import('@/pages/TradePage.tsx').then(m => ({ default: m.TradePage })));
const FreeAgencyPage = lazy(() => import('@/pages/FreeAgencyPage.tsx').then(m => ({ default: m.FreeAgencyPage })));
const PlayoffsPage = lazy(() => import('@/pages/PlayoffsPage.tsx').then(m => ({ default: m.PlayoffsPage })));
const OffseasonPage = lazy(() => import('@/pages/OffseasonPage.tsx').then(m => ({ default: m.OffseasonPage })));
const DraftPage = lazy(() => import('@/pages/DraftPage.tsx').then(m => ({ default: m.DraftPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage.tsx').then(m => ({ default: m.SettingsPage })));
const SaveLoadPage = lazy(() => import('@/pages/SaveLoadPage.tsx').then(m => ({ default: m.SaveLoadPage })));
const CreatePlayerPage = lazy(() => import('@/pages/CreatePlayerPage.tsx').then(m => ({ default: m.CreatePlayerPage })));
const CreatePlayerPage2 = lazy(() => import('@/pages/CreatePlayerPage2.tsx').then(m => ({ default: m.CreatePlayerPage2 })));
const PlayerEditorPage = lazy(() => import('@/pages/PlayerEditorPage.tsx').then(m => ({ default: m.PlayerEditorPage })));
const TeamEditorPage = lazy(() => import('@/pages/TeamEditorPage.tsx').then(m => ({ default: m.TeamEditorPage })));
const RosterManagerPage = lazy(() => import('@/pages/RosterManagerPage.tsx').then(m => ({ default: m.RosterManagerPage })));
const CustomLeaguePage = lazy(() => import('@/pages/CustomLeaguePage.tsx').then(m => ({ default: m.CustomLeaguePage })));
const CareerDashboardPage = lazy(() => import('@/pages/CareerDashboardPage.tsx').then(m => ({ default: m.CareerDashboardPage })));
const HistoricalPage = lazy(() => import('@/pages/HistoricalPage.tsx').then(m => ({ default: m.HistoricalPage })));
const FantasyDraftPage = lazy(() => import('@/pages/FantasyDraftPage.tsx').then(m => ({ default: m.FantasyDraftPage })));
const LeagueLeadersPage = lazy(() => import('@/pages/LeagueLeadersPage.tsx').then(m => ({ default: m.LeagueLeadersPage })));
const PlayerStatsPage = lazy(() => import('@/pages/PlayerStatsPage.tsx').then(m => ({ default: m.PlayerStatsPage })));
const TeamStatsPage = lazy(() => import('@/pages/TeamStatsPage.tsx').then(m => ({ default: m.TeamStatsPage })));
const RecordsPage = lazy(() => import('@/pages/RecordsPage.tsx').then(m => ({ default: m.RecordsPage })));
const InjuryReportPage = lazy(() => import('@/pages/InjuryReportPage.tsx').then(m => ({ default: m.InjuryReportPage })));
const MinorLeaguePage = lazy(() => import('@/pages/MinorLeaguePage.tsx').then(m => ({ default: m.MinorLeaguePage })));
const TradeHistoryPage = lazy(() => import('@/pages/TradeHistoryPage.tsx').then(m => ({ default: m.TradeHistoryPage })));
const WaiverWirePage = lazy(() => import('@/pages/WaiverWirePage.tsx').then(m => ({ default: m.WaiverWirePage })));

// Build team options for the new franchise screen (deduplicated — some teams appear in multiple divisions)
const TEAM_OPTIONS = (() => {
  const seen = new Set<string>();
  const opts: { id: string; city: string; name: string; abbreviation: string; primaryColor: string; league: string; division: string }[] = [];
  for (const [league, divisions] of Object.entries(LEAGUE_STRUCTURE)) {
    for (const [division, ids] of Object.entries(divisions)) {
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const t = ALL_TEAMS.find((tm: typeof ALL_TEAMS[number]) => tm.id === id);
        if (t) opts.push({ id: t.id, city: t.city, name: t.name, abbreviation: t.abbreviation, primaryColor: t.primaryColor, league, division });
      }
    }
  }
  return opts;
})();

/** Fade wrapper — re-mounts on location change, triggering CSS animation */
function FadeWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div
      key={location.pathname}
      style={{ animation: 'routeFadeIn 0.2s ease-out' }}
    >
      {children}
    </div>
  );
}

/** Page-level loading fallback */
function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading..." />
    </div>
  );
}

function AppRoutes() {
  return (
    <FadeWrapper>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* ── Main / non-franchise routes ─────────────────────────── */}
          <Route path="/" element={<MainLayout><MainMenuPage /></MainLayout>} />
          <Route path="/test" element={<MainLayout><TestHarnessPage /></MainLayout>} />
          <Route path="/sprint-c" element={<MainLayout><SprintCTestPage /></MainLayout>} />
          <Route path="/career" element={<MainLayout><CareerDashboardPage /></MainLayout>} />
          <Route path="/career/new" element={<MainLayout><CreatePlayerPage /></MainLayout>} />
          <Route path="/historical" element={<MainLayout><HistoricalPage /></MainLayout>} />
          <Route path="/historical/draft" element={<MainLayout><FantasyDraftPage /></MainLayout>} />
          <Route path="/settings" element={<MainLayout><SettingsPage /></MainLayout>} />
          <Route path="/saves" element={<MainLayout><SaveLoadPage /></MainLayout>} />

          {/* ── Live game routes (minimal GameLayout) ───────────────── */}
          <Route path="/game/live" element={<GameLayout><LiveGamePage /></GameLayout>} />
          <Route path="/game/setup" element={<MainLayout><ExhibitionSetupPage /></MainLayout>} />
          <Route path="/game/quick" element={<MainLayout><QuickPlayPage /></MainLayout>} />

          {/* ── New franchise setup (no sidebar yet) ────────────────── */}
          <Route
            path="/franchise/new"
            element={
              <MainLayout>
                <NewFranchisePage teamOptions={TEAM_OPTIONS} allTeams={ALL_TEAMS} leagueStructure={LEAGUE_STRUCTURE} />
              </MainLayout>
            }
          />

          {/* ── Franchise routes (with sidebar) ─────────────────────── */}
          <Route path="/franchise" element={<FranchiseLayout><FranchiseDashboard /></FranchiseLayout>} />
          <Route path="/franchise/standings" element={<FranchiseLayout><StandingsPage /></FranchiseLayout>} />
          <Route path="/franchise/roster" element={<FranchiseLayout><RosterPage /></FranchiseLayout>} />
          <Route path="/franchise/trade" element={<FranchiseLayout><TradePage /></FranchiseLayout>} />
          <Route path="/franchise/free-agency" element={<FranchiseLayout><FreeAgencyPage /></FranchiseLayout>} />
          <Route path="/franchise/playoffs" element={<FranchiseLayout><PlayoffsPage /></FranchiseLayout>} />
          <Route path="/franchise/offseason" element={<FranchiseLayout><OffseasonPage /></FranchiseLayout>} />
          <Route path="/franchise/draft" element={<FranchiseLayout><DraftPage /></FranchiseLayout>} />
          <Route path="/franchise/roster-manager" element={<FranchiseLayout><RosterManagerPage /></FranchiseLayout>} />
          <Route path="/franchise/custom-league" element={<FranchiseLayout><CustomLeaguePage /></FranchiseLayout>} />
          <Route path="/franchise/injuries" element={<FranchiseLayout><InjuryReportPage /></FranchiseLayout>} />
          <Route path="/franchise/minors" element={<FranchiseLayout><MinorLeaguePage /></FranchiseLayout>} />
          <Route path="/franchise/trade-history" element={<FranchiseLayout><TradeHistoryPage /></FranchiseLayout>} />
          <Route path="/franchise/waivers" element={<FranchiseLayout><WaiverWirePage /></FranchiseLayout>} />
          <Route path="/franchise/leaders" element={<FranchiseLayout><LeagueLeadersPage /></FranchiseLayout>} />
          <Route path="/franchise/records" element={<FranchiseLayout><RecordsPage /></FranchiseLayout>} />
          {/* Player & team detail pages */}
          <Route path="/franchise/player/:playerId" element={<FranchiseLayout><PlayerEditorPage /></FranchiseLayout>} />
          <Route path="/franchise/create-player" element={<FranchiseLayout><CreatePlayerPage2 /></FranchiseLayout>} />
          <Route path="/franchise/team/:teamId" element={<FranchiseLayout><TeamEditorPage /></FranchiseLayout>} />
          <Route path="/franchise/player-stats/:playerId" element={<FranchiseLayout><PlayerStatsPage /></FranchiseLayout>} />
          <Route path="/franchise/team-stats/:teamId" element={<FranchiseLayout><TeamStatsPage /></FranchiseLayout>} />
        </Routes>
      </Suspense>
    </FadeWrapper>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);

  // Preload has already started by the time we render; give splash 1.2s
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} durationMs={1200} />}
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer />
      </BrowserRouter>
    </>
  );
}

export default App;
