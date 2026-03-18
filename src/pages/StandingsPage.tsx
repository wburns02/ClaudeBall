import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { StatsTable } from '@/components/ui/StatsTable.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { winPct, gamesBehind, runDifferential, streakStr, last10Str } from '@/engine/season/index.ts';
import type { TeamRecord } from '@/engine/season/index.ts';

const STANDINGS_COLS = [
  { key: 'team', label: 'Team', align: 'left' as const },
  { key: 'w', label: 'W', align: 'right' as const },
  { key: 'l', label: 'L', align: 'right' as const },
  { key: 'pct', label: 'PCT', align: 'right' as const },
  { key: 'gb', label: 'GB', align: 'right' as const },
  { key: 'diff', label: '+/-', align: 'right' as const },
  { key: 'streak', label: 'STRK', align: 'right' as const },
  { key: 'l10', label: 'L10', align: 'right' as const },
  { key: 'home', label: 'HOME', align: 'right' as const },
  { key: 'away', label: 'AWAY', align: 'right' as const },
];

export function StandingsPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId } = useFranchiseStore();

  if (!season || !engine) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => navigate('/')}>Back to Menu</Button>
      </div>
    );
  }

  const divisions = season.standings.getDivisionStandings();

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Standings</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">{season.year} Season — Day {season.currentDay}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise')}>
          Back to Dashboard
        </Button>
      </div>

      <div className="space-y-6">
        {divisions.map(div => (
          <Panel key={`${div.league}-${div.division}`} title={`${div.league} ${div.division}`}>
            <StatsTable
              columns={STANDINGS_COLS}
              rows={div.teams.map((t: TeamRecord, i: number) => {
                const team = engine.getTeam(t.teamId);
                const isUser = t.teamId === userTeamId;
                return {
                  team: (isUser ? '► ' : '') + `${team?.city ?? ''} ${team?.name ?? t.teamId}`,
                  w: t.wins,
                  l: t.losses,
                  pct: winPct(t),
                  gb: i === 0 ? '—' : gamesBehind(div.teams[0], t),
                  diff: runDifferential(t),
                  streak: streakStr(t),
                  l10: last10Str(t),
                  home: `${t.homeWins}-${t.homeLosses}`,
                  away: `${t.awayWins}-${t.awayLosses}`,
                };
              })}
              compact
            />
          </Panel>
        ))}
      </div>
    </div>
  );
}
