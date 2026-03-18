import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainMenuPage } from '@/pages/MainMenuPage.tsx';
import { TestHarnessPage } from '@/pages/TestHarnessPage.tsx';
import { LiveGamePage } from '@/pages/LiveGamePage.tsx';
import { FranchiseDashboard } from '@/pages/FranchiseDashboard.tsx';
import { StandingsPage } from '@/pages/StandingsPage.tsx';
import { NewFranchisePage } from '@/pages/NewFranchisePage.tsx';
import { RosterPage } from '@/pages/RosterPage.tsx';
import { TradePage } from '@/pages/TradePage.tsx';
import { FreeAgencyPage } from '@/pages/FreeAgencyPage.tsx';
import { ALL_TEAMS, LEAGUE_STRUCTURE } from '@/engine/data/teams30.ts';

// Build team options for the new franchise screen (deduplicated — some teams appear in multiple divisions)
const TEAM_OPTIONS = (() => {
  const seen = new Set<string>();
  const opts: { id: string; city: string; name: string; abbreviation: string; primaryColor: string; league: string; division: string }[] = [];
  for (const [league, divisions] of Object.entries(LEAGUE_STRUCTURE)) {
    for (const [division, ids] of Object.entries(divisions)) {
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const t = ALL_TEAMS.find(tm => tm.id === id);
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
        <Route path="/game/live" element={<LiveGamePage />} />
        <Route path="/franchise/new" element={<NewFranchisePage teamOptions={TEAM_OPTIONS} allTeams={ALL_TEAMS} leagueStructure={LEAGUE_STRUCTURE} />} />
        <Route path="/franchise" element={<FranchiseDashboard />} />
        <Route path="/franchise/standings" element={<StandingsPage />} />
        <Route path="/franchise/roster" element={<RosterPage />} />
        <Route path="/franchise/trade" element={<TradePage />} />
        <Route path="/franchise/free-agency" element={<FreeAgencyPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
