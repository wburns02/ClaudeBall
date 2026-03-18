import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SprintCTestPage } from '@/SprintCTestPage.tsx';
import { MainMenuPage } from '@/pages/MainMenuPage.tsx';
import { TestHarnessPage } from '@/pages/TestHarnessPage.tsx';
import { LiveGamePage } from '@/pages/LiveGamePage.tsx';
import { FranchiseDashboard } from '@/pages/FranchiseDashboard.tsx';
import { StandingsPage } from '@/pages/StandingsPage.tsx';
import { NewFranchisePage } from '@/pages/NewFranchisePage.tsx';
import { RosterPage } from '@/pages/RosterPage.tsx';
import { TradePage } from '@/pages/TradePage.tsx';
import { FreeAgencyPage } from '@/pages/FreeAgencyPage.tsx';
import { PlayoffsPage } from '@/pages/PlayoffsPage.tsx';
import { OffseasonPage } from '@/pages/OffseasonPage.tsx';
import { DraftPage } from '@/pages/DraftPage.tsx';
import { SettingsPage } from '@/pages/SettingsPage.tsx';
import { SaveLoadPage } from '@/pages/SaveLoadPage.tsx';
import { CreatePlayerPage } from '@/pages/CreatePlayerPage.tsx';
import { CreatePlayerPage2 } from '@/pages/CreatePlayerPage2.tsx';
import { PlayerEditorPage } from '@/pages/PlayerEditorPage.tsx';
import { TeamEditorPage } from '@/pages/TeamEditorPage.tsx';
import { RosterManagerPage } from '@/pages/RosterManagerPage.tsx';
import { CustomLeaguePage } from '@/pages/CustomLeaguePage.tsx';
import { CareerDashboardPage } from '@/pages/CareerDashboardPage.tsx';
import { HistoricalPage } from '@/pages/HistoricalPage.tsx';
import { FantasyDraftPage } from '@/pages/FantasyDraftPage.tsx';
import { LeagueLeadersPage } from '@/pages/LeagueLeadersPage.tsx';
import { PlayerStatsPage } from '@/pages/PlayerStatsPage.tsx';
import { TeamStatsPage } from '@/pages/TeamStatsPage.tsx';
import { RecordsPage } from '@/pages/RecordsPage.tsx';
import { InjuryReportPage } from '@/pages/InjuryReportPage.tsx';
import { MinorLeaguePage } from '@/pages/MinorLeaguePage.tsx';
import { TradeHistoryPage } from '@/pages/TradeHistoryPage.tsx';
import { WaiverWirePage } from '@/pages/WaiverWirePage.tsx';
import { TEAMS as ALL_TEAMS, LEAGUE_STRUCTURE } from '@/engine/data/teams30.ts';

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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenuPage />} />
        <Route path="/test" element={<TestHarnessPage />} />
        <Route path="/sprint-c" element={<SprintCTestPage />} />
        <Route path="/game/live" element={<LiveGamePage />} />
        <Route path="/franchise/new" element={<NewFranchisePage teamOptions={TEAM_OPTIONS} allTeams={ALL_TEAMS} leagueStructure={LEAGUE_STRUCTURE} />} />
        <Route path="/franchise" element={<FranchiseDashboard />} />
        <Route path="/franchise/standings" element={<StandingsPage />} />
        <Route path="/franchise/roster" element={<RosterPage />} />
        <Route path="/franchise/trade" element={<TradePage />} />
        <Route path="/franchise/free-agency" element={<FreeAgencyPage />} />
        <Route path="/franchise/playoffs" element={<PlayoffsPage />} />
        <Route path="/franchise/offseason" element={<OffseasonPage />} />
        <Route path="/franchise/draft" element={<DraftPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/saves" element={<SaveLoadPage />} />
        <Route path="/career/new" element={<CreatePlayerPage />} />
        <Route path="/career" element={<CareerDashboardPage />} />
        <Route path="/historical" element={<HistoricalPage />} />
        <Route path="/historical/draft" element={<FantasyDraftPage />} />
        {/* Player & team customization */}
        <Route path="/franchise/player/:playerId" element={<PlayerEditorPage />} />
        <Route path="/franchise/create-player" element={<CreatePlayerPage2 />} />
        <Route path="/franchise/team/:teamId" element={<TeamEditorPage />} />
        <Route path="/franchise/roster-manager" element={<RosterManagerPage />} />
        <Route path="/franchise/custom-league" element={<CustomLeaguePage />} />
        {/* Deep Season Features */}
        <Route path="/franchise/injuries" element={<InjuryReportPage />} />
        <Route path="/franchise/minors" element={<MinorLeaguePage />} />
        <Route path="/franchise/trade-history" element={<TradeHistoryPage />} />
        <Route path="/franchise/waivers" element={<WaiverWirePage />} />
        {/* Stats & Analytics */}
        <Route path="/franchise/leaders" element={<LeagueLeadersPage />} />
        <Route path="/franchise/player-stats/:playerId" element={<PlayerStatsPage />} />
        <Route path="/franchise/team-stats/:teamId" element={<TeamStatsPage />} />
        <Route path="/franchise/records" element={<RecordsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
