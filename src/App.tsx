import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from '@/components/ui/Toast.tsx';
import { SplashScreen } from '@/components/ui/SplashScreen.tsx';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner.tsx';
import { TEAMS as ALL_TEAMS, LEAGUE_STRUCTURE } from '@/engine/data/teams30.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { FranchiseLayout } from '@/components/layout/FranchiseLayout.tsx';
import { MainLayout } from '@/components/layout/MainLayout.tsx';
import { GameLayout } from '@/components/layout/GameLayout.tsx';
import { CareerLayout } from '@/components/layout/CareerLayout.tsx';

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
const IdeasPage = lazy(() => import('@/pages/IdeasPage.tsx').then(m => ({ default: m.IdeasPage })));
const SaveLoadPage = lazy(() => import('@/pages/SaveLoadPage.tsx').then(m => ({ default: m.SaveLoadPage })));
const CreatePlayerPage = lazy(() => import('@/pages/CreatePlayerPage.tsx').then(m => ({ default: m.CreatePlayerPage })));
const CreatePlayerPage2 = lazy(() => import('@/pages/CreatePlayerPage2.tsx').then(m => ({ default: m.CreatePlayerPage2 })));
const PlayerEditorPage = lazy(() => import('@/pages/PlayerEditorPage.tsx').then(m => ({ default: m.PlayerEditorPage })));
const TeamEditorPage = lazy(() => import('@/pages/TeamEditorPage.tsx').then(m => ({ default: m.TeamEditorPage })));
const RosterManagerPage = lazy(() => import('@/pages/RosterManagerPage.tsx').then(m => ({ default: m.RosterManagerPage })));
const CustomLeaguePage = lazy(() => import('@/pages/CustomLeaguePage.tsx').then(m => ({ default: m.CustomLeaguePage })));
const CareerDashboardPage = lazy(() => import('@/pages/CareerDashboardPage.tsx').then(m => ({ default: m.CareerDashboardPage })));
const CareerStatsPage = lazy(() => import('@/pages/CareerStatsPage.tsx').then(m => ({ default: m.CareerStatsPage })));
const CareerTrainingPage = lazy(() => import('@/pages/CareerTrainingPage.tsx').then(m => ({ default: m.CareerTrainingPage })));
const CareerContractPage = lazy(() => import('@/pages/CareerContractPage.tsx').then(m => ({ default: m.CareerContractPage })));
const CareerHofPage = lazy(() => import('@/pages/CareerHofPage.tsx').then(m => ({ default: m.CareerHofPage })));
const CareerGamePage = lazy(() => import('@/pages/CareerGamePage.tsx').then(m => ({ default: m.CareerGamePage })));
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
const SchedulePage = lazy(() => import('@/pages/SchedulePage.tsx').then(m => ({ default: m.SchedulePage })));
const GameLogPage = lazy(() => import('@/pages/GameLogPage.tsx').then(m => ({ default: m.GameLogPage })));
const BoxScoreHistoryPage = lazy(() => import('@/pages/BoxScoreHistoryPage.tsx').then(m => ({ default: m.BoxScoreHistoryPage })));
const AllStarPage = lazy(() => import('@/pages/AllStarPage.tsx').then(m => ({ default: m.AllStarPage })));
const AwardsPage = lazy(() => import('@/pages/AwardsPage.tsx').then(m => ({ default: m.AwardsPage })));
const TradeProposalPage = lazy(() => import('@/pages/TradeProposalPage.tsx').then(m => ({ default: m.TradeProposalPage })));
const FranchiseHistoryPage = lazy(() => import('@/pages/FranchiseHistoryPage.tsx').then(m => ({ default: m.FranchiseHistoryPage })));
const ScoutingPage = lazy(() => import('@/pages/ScoutingPage.tsx').then(m => ({ default: m.ScoutingPage })));
const PayrollPage = lazy(() => import('@/pages/PayrollPage.tsx').then(m => ({ default: m.PayrollPage })));
const LineupEditorPage = lazy(() => import('@/pages/LineupEditorPage.tsx').then(m => ({ default: m.LineupEditorPage })));
const DevelopmentHubPage = lazy(() => import('@/pages/DevelopmentHubPage.tsx').then(m => ({ default: m.DevelopmentHubPage })));
const TrainingCenterPage = lazy(() => import('@/pages/TrainingCenterPage.tsx').then(m => ({ default: m.TrainingCenterPage })));
const NewsPage = lazy(() => import('@/pages/NewsPage.tsx').then(m => ({ default: m.NewsPage })));
const HotColdPage = lazy(() => import('@/pages/HotColdPage.tsx').then(m => ({ default: m.HotColdPage })));
const FinancesPage = lazy(() => import('@/pages/FinancesPage.tsx').then(m => ({ default: m.FinancesPage })));
const InboxPage = lazy(() => import('@/pages/InboxPage.tsx').then(m => ({ default: m.InboxPage })));
const PowerRankingsPage = lazy(() => import('@/pages/PowerRankingsPage.tsx').then(m => ({ default: m.PowerRankingsPage })));
const PlayerComparisonPage = lazy(() => import('@/pages/PlayerComparisonPage.tsx').then(m => ({ default: m.PlayerComparisonPage })));
const TeamAnalyticsPage = lazy(() => import('@/pages/TeamAnalyticsPage.tsx').then(m => ({ default: m.TeamAnalyticsPage })));
const DepthChartPage = lazy(() => import('@/pages/DepthChartPage.tsx').then(m => ({ default: m.DepthChartPage })));
const GMWarRoomPage = lazy(() => import('@/pages/GMWarRoomPage.tsx').then(m => ({ default: m.GMWarRoomPage })));

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


/** Redirects /franchise/team-stats → /franchise/team-stats/:userTeamId */
function TeamStatsRedirect() {
  const userTeamId = useFranchiseStore(s => s.userTeamId);
  return <Navigate to={`/franchise/team-stats/${userTeamId ?? 'unknown'}`} replace />;
}

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
          <Route path="/career" element={<CareerLayout><CareerDashboardPage /></CareerLayout>} />
          <Route path="/career/new" element={<MainLayout><CreatePlayerPage /></MainLayout>} />
          <Route path="/career/stats" element={<CareerLayout><CareerStatsPage /></CareerLayout>} />
          <Route path="/career/training" element={<CareerLayout><CareerTrainingPage /></CareerLayout>} />
          <Route path="/career/contract" element={<CareerLayout><CareerContractPage /></CareerLayout>} />
          <Route path="/career/hof" element={<CareerLayout><CareerHofPage /></CareerLayout>} />
          <Route path="/career/game" element={<CareerLayout><CareerGamePage /></CareerLayout>} />
          <Route path="/historical" element={<MainLayout><HistoricalPage /></MainLayout>} />
          <Route path="/historical/draft" element={<MainLayout><FantasyDraftPage /></MainLayout>} />
          <Route path="/settings" element={<MainLayout><SettingsPage /></MainLayout>} />
          <Route path="/saves" element={<MainLayout><SaveLoadPage /></MainLayout>} />
          <Route path="/ideas" element={<MainLayout><IdeasPage /></MainLayout>} />

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
          <Route path="/franchise/power-rankings" element={<FranchiseLayout><PowerRankingsPage /></FranchiseLayout>} />
          <Route path="/franchise/team-analytics" element={<FranchiseLayout><TeamAnalyticsPage /></FranchiseLayout>} />
          <Route path="/franchise/depth-chart" element={<FranchiseLayout><DepthChartPage /></FranchiseLayout>} />
          <Route path="/franchise/war-room" element={<FranchiseLayout><GMWarRoomPage /></FranchiseLayout>} />
          {/* Player & team detail pages */}
          <Route path="/franchise/player/:playerId" element={<FranchiseLayout><PlayerEditorPage /></FranchiseLayout>} />
          <Route path="/franchise/create-player" element={<FranchiseLayout><CreatePlayerPage2 /></FranchiseLayout>} />
          <Route path="/franchise/team/:teamId" element={<FranchiseLayout><TeamEditorPage /></FranchiseLayout>} />
          <Route path="/franchise/player-stats/:playerId" element={<FranchiseLayout><PlayerStatsPage /></FranchiseLayout>} />
          <Route path="/franchise/compare" element={<FranchiseLayout><PlayerComparisonPage /></FranchiseLayout>} />
          <Route path="/franchise/team-stats/:teamId" element={<FranchiseLayout><TeamStatsPage /></FranchiseLayout>} />
          {/* New franchise features */}
          <Route path="/franchise/schedule" element={<FranchiseLayout><SchedulePage /></FranchiseLayout>} />
          <Route path="/franchise/game-log" element={<FranchiseLayout><GameLogPage /></FranchiseLayout>} />
          <Route path="/franchise/box-score/:gameId" element={<FranchiseLayout><BoxScoreHistoryPage /></FranchiseLayout>} />
          <Route path="/franchise/all-star" element={<FranchiseLayout><AllStarPage /></FranchiseLayout>} />
          <Route path="/franchise/awards" element={<FranchiseLayout><AwardsPage /></FranchiseLayout>} />
          <Route path="/franchise/trade-proposals" element={<FranchiseLayout><TradeProposalPage /></FranchiseLayout>} />
          <Route path="/franchise/history" element={<FranchiseLayout><FranchiseHistoryPage /></FranchiseLayout>} />
          <Route path="/franchise/scouting" element={<FranchiseLayout><ScoutingPage /></FranchiseLayout>} />
          <Route path="/franchise/payroll" element={<FranchiseLayout><PayrollPage /></FranchiseLayout>} />
          <Route path="/franchise/lineup-editor" element={<FranchiseLayout><LineupEditorPage /></FranchiseLayout>} />
          <Route path="/franchise/development" element={<FranchiseLayout><DevelopmentHubPage /></FranchiseLayout>} />
          <Route path="/franchise/training" element={<FranchiseLayout><TrainingCenterPage /></FranchiseLayout>} />
          <Route path="/franchise/news" element={<FranchiseLayout><NewsPage /></FranchiseLayout>} />
          <Route path="/franchise/hot-cold" element={<FranchiseLayout><HotColdPage /></FranchiseLayout>} />
          <Route path="/franchise/finances" element={<FranchiseLayout><FinancesPage /></FranchiseLayout>} />
          <Route path="/franchise/inbox" element={<FranchiseLayout><InboxPage /></FranchiseLayout>} />

          {/* ── URL alias redirects (common alternative paths) ──────── */}
          <Route path="/franchise/trades" element={<Navigate to="/franchise/trade" replace />} />
          <Route path="/franchise/lineup" element={<Navigate to="/franchise/lineup-editor" replace />} />
          <Route path="/franchise/minor-leagues" element={<Navigate to="/franchise/minors" replace />} />
          <Route path="/franchise/franchise-history" element={<Navigate to="/franchise/history" replace />} />
          <Route path="/franchise/league-news" element={<Navigate to="/franchise/news" replace />} />
          <Route path="/franchise/league-leaders" element={<Navigate to="/franchise/leaders" replace />} />
          <Route path="/franchise/career" element={<Navigate to="/career" replace />} />
          <Route path="/franchise/ideas" element={<Navigate to="/ideas" replace />} />
          <Route path="/franchise/team-stats" element={<TeamStatsRedirect />} />
          <Route path="/franchise/player-stats" element={<Navigate to="/franchise/roster" replace />} />
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
