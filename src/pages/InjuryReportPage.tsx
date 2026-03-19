import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { InjuryRecord } from '@/engine/season/InjuryEngine.ts';

const SEVERITY_COLOR: Record<string, string> = {
  minor: 'text-gold',
  moderate: 'text-orange-400',
  severe: 'text-red-400',
  'season-ending': 'text-red-600',
};

const SEVERITY_BG: Record<string, string> = {
  minor: 'bg-gold/10 border-gold/30',
  moderate: 'bg-orange-900/20 border-orange-500/30',
  severe: 'bg-red-900/20 border-red-500/30',
  'season-ending': 'bg-red-950/30 border-red-700/40',
};

function InjuryRow({ record, currentDay, showTeam, teamName }: { record: InjuryRecord; currentDay: number; showTeam?: boolean; teamName?: string }) {
  const daysRemaining = Math.max(0, record.injuredUntilDay - currentDay);
  const isSeasonEnding = record.severity === 'season-ending';
  const hasReturned = record.returned;

  return (
    <div className={cn(
      'flex items-start justify-between gap-4 px-3 py-2.5 rounded-md border',
      hasReturned ? 'opacity-40 bg-navy-lighter/10 border-navy-lighter/20' : SEVERITY_BG[record.severity],
    )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-body text-sm text-cream font-semibold">{record.playerName}</span>
          <span className={cn('font-mono text-xs font-bold uppercase', SEVERITY_COLOR[record.severity])}>
            {record.severity}
          </span>
          {hasReturned && <span className="font-mono text-xs text-green-light">RETURNED</span>}
        </div>
        <p className="font-mono text-xs text-cream-dim mt-0.5">{record.description}</p>
        {showTeam && teamName && (
          <p className="font-mono text-xs text-cream-dim/60 mt-0.5">{teamName}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        {hasReturned ? (
          <span className="font-mono text-xs text-green-light">Active</span>
        ) : isSeasonEnding ? (
          <span className="font-mono text-xs text-red-500">Season</span>
        ) : (
          <>
            <p className={cn('font-mono text-sm font-bold', daysRemaining <= 3 ? 'text-green-light' : 'text-cream')}>
              {daysRemaining}d
            </p>
            <p className="font-mono text-xs text-cream-dim">remaining</p>
          </>
        )}
      </div>
    </div>
  );
}

export function InjuryReportPage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId, injuryLog, getActiveInjuries, getTeamInjuries } = useFranchiseStore();

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-cream-dim">No franchise loaded.</p>
      </div>
    );
  }

  const currentDay = season.currentDay;
  const userTeam = engine.getTeam(userTeamId);
  const userActiveInjuries = getTeamInjuries(userTeamId).filter(r => !r.returned);
  const allActiveInjuries = getActiveInjuries();
  const leagueInjuries = allActiveInjuries.filter(r => r.teamId !== userTeamId);

  // Summary stats
  const totalInjured = allActiveInjuries.length;
  const severeCount = allActiveInjuries.filter(r => r.severity === 'severe' || r.severity === 'season-ending').length;
  const returningSoon = allActiveInjuries.filter(r => r.injuredUntilDay - currentDay <= 5).length;

  // Season total (from log)
  const seasonTotal = injuryLog.length;

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Injury Report</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">Day {currentDay} — {season.year} Season</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/roster')}>Roster</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'On IL', value: totalInjured, color: 'text-red-400' },
          { label: 'Severe/SE', value: severeCount, color: 'text-red-600' },
          { label: 'Returning Soon', value: returningSoon, color: 'text-green-light' },
          { label: 'Season Total', value: seasonTotal, color: 'text-cream' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-navy-light border border-navy-lighter rounded-lg px-4 py-3 text-center">
            <p className={cn('font-display text-2xl font-bold', color)}>{value}</p>
            <p className="font-mono text-xs text-cream-dim mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Your Team */}
        <Panel title={`${userTeam?.city ?? ''} ${userTeam?.name ?? ''} — Your Team`}>
          {userActiveInjuries.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-display text-4xl text-green-light mb-2">Clean Bill</p>
              <p className="font-mono text-sm text-cream-dim">No active injuries</p>
            </div>
          ) : (
            <div className="space-y-2">
              {userActiveInjuries.map(r => (
                <InjuryRow key={r.playerId + r.dayOccurred} record={r} currentDay={currentDay} />
              ))}
            </div>
          )}
        </Panel>

        {/* League-wide active injuries */}
        <Panel title={`League — Active (${leagueInjuries.length})`}>
          {leagueInjuries.length === 0 ? (
            <p className="font-mono text-cream-dim text-sm py-4 text-center">No active league injuries</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {leagueInjuries
                .sort((a, b) => b.injuredUntilDay - a.injuredUntilDay)
                .map(r => {
                  const t = engine.getTeam(r.teamId);
                  const teamName = t ? `${t.city} ${t.name}` : r.teamId;
                  return <InjuryRow key={r.playerId + r.dayOccurred} record={r} currentDay={currentDay} showTeam teamName={teamName} />;
                })}
            </div>
          )}
        </Panel>

        {/* Season injury history */}
        <Panel title={`Season History (${injuryLog.length} total)`}>
          {injuryLog.length === 0 ? (
            <p className="font-mono text-cream-dim text-sm py-4 text-center">No injuries recorded yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {[...injuryLog]
                .reverse()
                .map((r, i) => {
                  const t = engine.getTeam(r.teamId);
                  const teamName = t ? `${t.city} ${t.name}` : r.teamId;
                  return <InjuryRow key={i} record={r} currentDay={currentDay} showTeam teamName={teamName} />;
                })}
            </div>
          )}
        </Panel>

        {/* Injury breakdown */}
        <Panel title="Season Breakdown">
          {(() => {
            const minor = injuryLog.filter(r => r.severity === 'minor').length;
            const moderate = injuryLog.filter(r => r.severity === 'moderate').length;
            const severe = injuryLog.filter(r => r.severity === 'severe').length;
            const ending = injuryLog.filter(r => r.severity === 'season-ending').length;

            return (
              <div className="space-y-4">
                {[
                  { label: 'Minor (1–3 days)', count: minor, color: 'bg-gold', textColor: 'text-gold' },
                  { label: 'Moderate (7–21 days)', count: moderate, color: 'bg-orange-500', textColor: 'text-orange-400' },
                  { label: 'Severe (30–90 days)', count: severe, color: 'bg-red-500', textColor: 'text-red-400' },
                  { label: 'Season-Ending', count: ending, color: 'bg-red-800', textColor: 'text-red-600' },
                ].map(({ label, count, color, textColor }) => {
                  const pct = seasonTotal === 0 ? 0 : (count / seasonTotal) * 100;
                  return (
                    <div key={label}>
                      <div className="flex justify-between font-mono text-xs mb-1">
                        <span className="text-cream-dim">{label}</span>
                        <span className={cn('font-bold', textColor)}>{count}</span>
                      </div>
                      <div className="h-2 bg-navy-lighter rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Panel>
      </div>
    </div>
  );
}
