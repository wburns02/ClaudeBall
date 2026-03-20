import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import type { ILSlot } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { InjuryRecord } from '@/engine/season/InjuryEngine.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import type { Player } from '@/engine/types/player.ts';
import { getPlayerName } from '@/engine/types/player.ts';

// ── Severity styles ────────────────────────────────────────────────────────────

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

const IL_TYPE_DAYS = { '10-day': 10, '60-day': 60 };

// ── Call-up selector modal ────────────────────────────────────────────────────

function CallupModal({
  prospects,
  onSelect,
  onSkip,
}: {
  prospects: Player[];
  onSelect: (p: Player) => void;
  onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1625] border border-navy-lighter rounded-xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-navy-lighter">
          <h3 className="font-display text-gold text-lg uppercase tracking-wide">Call Up from AAA</h3>
          <p className="font-mono text-cream-dim/60 text-xs mt-0.5">Select a prospect to add to your active roster</p>
        </div>
        <div className="px-4 py-3 space-y-2 max-h-80 overflow-y-auto">
          {prospects.length === 0 ? (
            <p className="font-mono text-cream-dim text-sm text-center py-6">No AAA prospects available</p>
          ) : (
            prospects.map(p => {
              const ovr = Math.round(evaluatePlayer(p));
              return (
                <button
                  key={p.id}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-navy-lighter hover:border-gold/40 hover:bg-navy-lighter/30 transition-all cursor-pointer group"
                  onClick={() => onSelect(p)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-body text-sm text-cream font-medium truncate group-hover:text-gold transition-colors">
                        {getPlayerName(p)}
                      </p>
                      <p className="font-mono text-xs text-cream-dim">
                        {p.position} · Age {p.age}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        'font-mono text-sm font-bold',
                        ovr >= 70 ? 'text-gold' : ovr >= 55 ? 'text-green-light' : 'text-cream',
                      )}>
                        {ovr}
                      </p>
                      <p className="font-mono text-[10px] text-cream-dim">OVR</p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="px-5 py-3 border-t border-navy-lighter flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip}>Skip Call-Up</Button>
        </div>
      </div>
    </div>
  );
}

// ── IL Placement confirmation ──────────────────────────────────────────────────

function ILPlaceButton({
  record,
  isOnIL,
  onPlace,
}: {
  record: InjuryRecord;
  isOnIL: boolean;
  onPlace: (ilType: '10-day' | '60-day') => void;
}) {
  const [open, setOpen] = useState(false);
  if (isOnIL) return null;

  const durationSuggestion =
    record.severity === 'minor' ? '10-day' :
    record.severity === 'moderate' ? '10-day' :
    '60-day';

  if (!open) {
    return (
      <button
        className="font-mono text-[10px] uppercase tracking-wide text-red-400 border border-red-400/30 hover:border-red-400/60 hover:bg-red-900/20 rounded px-2 py-0.5 transition-all cursor-pointer"
        onClick={() => setOpen(true)}
      >
        + Place on IL
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="font-mono text-[10px] text-cream-dim uppercase">IL type:</span>
      {(['10-day', '60-day'] as const).map(t => (
        <button
          key={t}
          className={cn(
            'font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border transition-all cursor-pointer',
            t === durationSuggestion
              ? 'bg-red-900/30 border-red-500/50 text-red-400 hover:bg-red-900/50'
              : 'border-navy-lighter text-cream-dim hover:border-red-500/30 hover:text-red-400',
          )}
          onClick={() => { setOpen(false); onPlace(t); }}
        >
          {t}
        </button>
      ))}
      <button
        className="font-mono text-[10px] text-cream-dim/40 hover:text-cream-dim px-1 cursor-pointer"
        onClick={() => setOpen(false)}
      >
        ✕
      </button>
    </div>
  );
}

// ── Your Team injury row (with IL actions) ─────────────────────────────────────

function UserInjuryRow({
  record,
  currentDay,
  isOnIL,
  ilSlot,
  onPlaceOnIL,
  onActivate,
}: {
  record: InjuryRecord;
  currentDay: number;
  isOnIL: boolean;
  ilSlot?: ILSlot;
  onPlaceOnIL: (ilType: '10-day' | '60-day') => void;
  onActivate: () => void;
}) {
  const daysRemaining = Math.max(0, record.injuredUntilDay - currentDay);
  const hasReturned = record.returned;
  const isSeasonEnding = record.severity === 'season-ending';

  // Can activate from IL if: injury has healed OR min IL days served
  const ilMinServed = ilSlot
    ? currentDay - ilSlot.placedDay >= IL_TYPE_DAYS[ilSlot.ilType]
    : false;
  const canActivate = isOnIL && (hasReturned || ilMinServed);

  return (
    <div className={cn(
      'rounded-lg border transition-all',
      hasReturned && isOnIL
        ? 'border-green-light/20 bg-green-900/10'
        : isOnIL
          ? 'border-red-500/30 bg-red-950/20'
          : SEVERITY_BG[record.severity],
    )}>
      {/* Main info row */}
      <div className="px-3 py-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-sm text-cream font-semibold">{record.playerName}</span>
            {isOnIL && (
              <span className={cn(
                'font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border',
                hasReturned
                  ? 'text-green-light border-green-light/30 bg-green-900/20'
                  : 'text-red-400 border-red-500/30 bg-red-950/20',
              )}>
                {ilSlot?.ilType ?? '10-day'} IL
              </span>
            )}
            <span className={cn('font-mono text-[10px] font-bold uppercase', SEVERITY_COLOR[record.severity])}>
              {record.severity}
            </span>
            {hasReturned && !isOnIL && (
              <span className="font-mono text-xs text-green-light">CLEARED</span>
            )}
          </div>
          <p className="font-mono text-xs text-cream-dim mt-0.5">{record.description}</p>
          {isOnIL && ilSlot && (
            <p className="font-mono text-[10px] text-cream-dim/50 mt-0.5">
              On IL since Day {ilSlot.placedDay}
              {!canActivate && !hasReturned && (
                <> · eligible Day {ilSlot.placedDay + IL_TYPE_DAYS[ilSlot.ilType]}</>
              )}
            </p>
          )}
        </div>

        {/* Right side: timer or status */}
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          {hasReturned ? (
            <span className="font-mono text-xs text-green-light font-bold">Healthy</span>
          ) : isSeasonEnding ? (
            <span className="font-mono text-xs text-red-500">Season</span>
          ) : (
            <div className="text-right">
              <p className={cn('font-mono text-sm font-bold', daysRemaining <= 3 ? 'text-green-light' : 'text-cream')}>
                {daysRemaining}d
              </p>
              <p className="font-mono text-[10px] text-cream-dim">to return</p>
            </div>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="px-3 pb-2.5 flex items-center gap-2 flex-wrap">
        {isOnIL ? (
          <button
            disabled={!canActivate}
            className={cn(
              'font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border transition-all',
              canActivate
                ? 'text-green-light border-green-light/30 hover:border-green-light/60 hover:bg-green-900/20 cursor-pointer'
                : 'text-cream-dim/30 border-navy-lighter/30 cursor-not-allowed',
            )}
            onClick={canActivate ? onActivate : undefined}
          >
            {canActivate ? '✓ Activate from IL' : `Eligible Day ${ilSlot ? ilSlot.placedDay + IL_TYPE_DAYS[ilSlot.ilType] : '—'}`}
          </button>
        ) : (
          <ILPlaceButton record={record} isOnIL={isOnIL} onPlace={onPlaceOnIL} />
        )}
      </div>
    </div>
  );
}

// ── League injury row (read-only) ─────────────────────────────────────────────

function LeagueInjuryRow({ record, currentDay, teamName }: { record: InjuryRecord; currentDay: number; teamName?: string }) {
  const daysRemaining = Math.max(0, record.injuredUntilDay - currentDay);
  const hasReturned = record.returned;
  const isSeasonEnding = record.severity === 'season-ending';

  return (
    <div className={cn(
      'flex items-start justify-between gap-3 px-3 py-2 rounded-md border',
      hasReturned ? 'opacity-40 bg-navy-lighter/10 border-navy-lighter/20' : SEVERITY_BG[record.severity],
    )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-body text-sm text-cream font-medium">{record.playerName}</span>
          <span className={cn('font-mono text-[10px] font-bold uppercase', SEVERITY_COLOR[record.severity])}>
            {record.severity}
          </span>
        </div>
        {teamName && <p className="font-mono text-[10px] text-cream-dim/60 mt-0.5">{teamName}</p>}
        <p className="font-mono text-[10px] text-cream-dim/60 mt-0.5">{record.description}</p>
      </div>
      <div className="text-right shrink-0">
        {hasReturned ? (
          <span className="font-mono text-[10px] text-green-light">Back</span>
        ) : isSeasonEnding ? (
          <span className="font-mono text-[10px] text-red-500">Season</span>
        ) : (
          <p className={cn('font-mono text-xs font-bold', daysRemaining <= 3 ? 'text-green-light' : 'text-cream')}>
            {daysRemaining}d
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function InjuryReportPage() {
  const navigate = useNavigate();
  const {
    engine, season, userTeamId, injuryLog,
    getActiveInjuries, getTeamInjuries,
    ilRoster, placeOnIL, activateFromIL,
    callUpSpecificPlayer, getAAATeam,
  } = useFranchiseStore();

  const [callupContext, setCallupContext] = useState<{
    playerId: string;
    ilType: '10-day' | '60-day';
  } | null>(null);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Injury Report</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">Monitor player injuries, return-to-play timelines, and roster health across your organization.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const currentDay = season.currentDay;
  const userTeam = engine.getTeam(userTeamId);
  const userActiveInjuries = getTeamInjuries(userTeamId).filter(r => !r.returned || ilRoster.some(s => s.playerId === r.playerId));
  const allActiveInjuries = getActiveInjuries();
  const leagueInjuries = allActiveInjuries.filter(r => r.teamId !== userTeamId);

  // Players on IL (user team)
  const myILSlots = ilRoster;
  const myILPlayerIds = new Set(myILSlots.map(s => s.playerId));

  // Summary
  const totalInjured = allActiveInjuries.length;
  const ilCount = myILSlots.length;
  const returningSoon = allActiveInjuries.filter(r => !r.returned && r.injuredUntilDay - currentDay <= 5).length;
  const seasonTotal = injuryLog.length;

  // All uninjured IL players (healed but not activated)
  const healedOnIL = myILSlots.filter(slot => {
    const rec = injuryLog.find(r => r.playerId === slot.playerId && !r.returned);
    return !rec; // injury log shows returned or no active injury
  });

  // AAA prospects for callup
  const aaaTeam = getAAATeam(userTeamId);
  const prospects = (aaaTeam?.players ?? [])
    .sort((a, b) => evaluatePlayer(b) - evaluatePlayer(a))
    .slice(0, 8);

  const handlePlaceOnIL = (record: InjuryRecord, ilType: '10-day' | '60-day') => {
    placeOnIL(record.playerId, record.playerName, 'UTIL', ilType);
    // Trigger callup modal
    setCallupContext({ playerId: record.playerId, ilType });
  };

  const handleCallupSelect = (prospect: Player) => {
    callUpSpecificPlayer(userTeamId, prospect.id);
    setCallupContext(null);
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
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
          { label: 'Your IL', value: ilCount, color: 'text-red-400', sub: 'active slots' },
          { label: 'League Injured', value: totalInjured, color: 'text-orange-400', sub: 'league-wide' },
          { label: 'Returning Soon', value: returningSoon, color: 'text-green-light', sub: 'within 5 days' },
          { label: 'Season Total', value: seasonTotal, color: 'text-cream', sub: 'this season' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-navy-light border border-navy-lighter rounded-lg px-4 py-3 text-center">
            <p className={cn('font-display text-2xl font-bold', color)}>{value}</p>
            <p className="font-mono text-xs text-cream-dim mt-0.5">{label}</p>
            <p className="font-mono text-[10px] text-cream-dim/40">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* === YOUR TEAM IL MANAGEMENT === */}
        <div className="lg:col-span-2 space-y-4">

          {/* Active IL roster */}
          {myILSlots.length > 0 && (
            <Panel title={`Your IL Roster (${myILSlots.length} slots)`}>
              <div className="space-y-2">
                {myILSlots.map(slot => {
                  const injuryRec = injuryLog.find(r => r.playerId === slot.playerId);
                  const daysOnIL = currentDay - slot.placedDay;
                  const minDays = IL_TYPE_DAYS[slot.ilType];
                  const canActivate = daysOnIL >= minDays || (injuryRec?.returned ?? false) || (injuryRec ? (injuryRec.injuredUntilDay <= currentDay) : true);

                  return (
                    <div key={slot.playerId} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-red-500/20 bg-red-950/10">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-body text-sm text-cream font-medium">{slot.playerName}</span>
                          <span className="font-mono text-[10px] font-bold uppercase text-red-400 border border-red-500/30 bg-red-950/20 px-1.5 py-0.5 rounded">
                            {slot.ilType} IL
                          </span>
                          {injuryRec && !injuryRec.returned && injuryRec.injuredUntilDay > currentDay && (
                            <span className={cn('font-mono text-[10px] uppercase', SEVERITY_COLOR[injuryRec.severity])}>
                              {injuryRec.severity}
                            </span>
                          )}
                          {canActivate && (
                            <span className="font-mono text-[10px] text-green-light uppercase">Eligible</span>
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-cream-dim/50 mt-0.5">
                          Day {slot.placedDay} → {canActivate ? 'Can activate now' : `eligible Day ${slot.placedDay + minDays}`}
                          {injuryRec && !injuryRec.returned && (
                            <> · injury heals Day {injuryRec.injuredUntilDay}</>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {canActivate ? (
                          <button
                            className="font-mono text-[10px] uppercase tracking-wide text-green-light border border-green-light/30 hover:border-green-light/60 hover:bg-green-900/20 px-2 py-0.5 rounded transition-all cursor-pointer"
                            onClick={() => activateFromIL(slot.playerId)}
                          >
                            Activate
                          </button>
                        ) : (
                          <span className="font-mono text-[10px] text-cream-dim/30 px-2 py-0.5">
                            {Math.max(0, minDays - daysOnIL)}d left
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {/* Your injured players (to place on IL) */}
          <Panel title={`${userTeam?.city ?? ''} ${userTeam?.name ?? ''} — Injured Players`}>
            {userActiveInjuries.filter(r => !r.returned).length === 0 ? (
              <div className="text-center py-8">
                <p className="font-display text-3xl text-green-light mb-2">Clean Bill of Health</p>
                <p className="font-mono text-sm text-cream-dim">No active injuries on your roster</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userActiveInjuries
                  .filter(r => !r.returned)
                  .map(r => (
                    <UserInjuryRow
                      key={r.playerId + r.dayOccurred}
                      record={r}
                      currentDay={currentDay}
                      isOnIL={myILPlayerIds.has(r.playerId)}
                      ilSlot={myILSlots.find(s => s.playerId === r.playerId)}
                      onPlaceOnIL={(ilType) => handlePlaceOnIL(r, ilType)}
                      onActivate={() => activateFromIL(r.playerId)}
                    />
                  ))}
              </div>
            )}
          </Panel>

          {/* Healed on IL (returned from injury but not activated) */}
          {healedOnIL.length > 0 && (
            <Panel title="Ready to Activate">
              <p className="font-mono text-xs text-cream-dim mb-3">These players have healed but are still on the IL. Activate them to return to your active roster.</p>
              <div className="space-y-2">
                {healedOnIL.map(slot => (
                  <div key={slot.playerId} className="flex items-center justify-between px-3 py-2 rounded-lg border border-green-light/20 bg-green-900/10">
                    <div>
                      <span className="font-body text-sm text-cream font-medium">{slot.playerName}</span>
                      <p className="font-mono text-[10px] text-green-light mt-0.5">Healthy · {slot.ilType} IL</p>
                    </div>
                    <button
                      className="font-mono text-xs text-green-light border border-green-light/30 hover:border-green-light/60 hover:bg-green-900/20 px-3 py-1 rounded transition-all cursor-pointer font-bold"
                      onClick={() => activateFromIL(slot.playerId)}
                    >
                      Activate
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* === RIGHT COLUMN === */}
        <div className="space-y-4">
          {/* League injuries */}
          <Panel title={`League Injuries (${leagueInjuries.length})`}>
            {leagueInjuries.length === 0 ? (
              <p className="font-mono text-cream-dim text-sm py-4 text-center">No league injuries</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {leagueInjuries
                  .sort((a, b) => b.injuredUntilDay - a.injuredUntilDay)
                  .slice(0, 20)
                  .map(r => {
                    const t = engine.getTeam(r.teamId);
                    const teamName = t ? `${t.city} ${t.name}` : r.teamId;
                    return <LeagueInjuryRow key={r.playerId + r.dayOccurred} record={r} currentDay={currentDay} teamName={teamName} />;
                  })}
              </div>
            )}
          </Panel>

          {/* Season breakdown */}
          <Panel title="Season Breakdown">
            {seasonTotal === 0 ? (
              <p className="font-mono text-cream-dim text-xs py-2 text-center">No injuries yet</p>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Minor (1–3d)', count: injuryLog.filter(r => r.severity === 'minor').length, color: 'bg-gold', textColor: 'text-gold' },
                  { label: 'Moderate (7–21d)', count: injuryLog.filter(r => r.severity === 'moderate').length, color: 'bg-orange-500', textColor: 'text-orange-400' },
                  { label: 'Severe (30–90d)', count: injuryLog.filter(r => r.severity === 'severe').length, color: 'bg-red-500', textColor: 'text-red-400' },
                  { label: 'Season-Ending', count: injuryLog.filter(r => r.severity === 'season-ending').length, color: 'bg-red-800', textColor: 'text-red-600' },
                ].map(({ label, count, color, textColor }) => {
                  const pct = (count / seasonTotal) * 100;
                  return (
                    <div key={label}>
                      <div className="flex justify-between font-mono text-xs mb-1">
                        <span className="text-cream-dim">{label}</span>
                        <span className={cn('font-bold', textColor)}>{count}</span>
                      </div>
                      <div className="h-1.5 bg-navy-lighter rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Quick actions */}
          <div className="p-4 rounded-lg border border-navy-lighter bg-navy-light/40">
            <p className="font-mono text-[10px] uppercase tracking-widest text-cream-dim/50 mb-3">Quick Actions</p>
            <div className="space-y-2">
              <button
                className="w-full text-left px-3 py-2 rounded-md border border-navy-lighter hover:border-gold/40 hover:bg-navy-lighter/30 transition-all cursor-pointer font-mono text-xs text-cream-dim hover:text-cream"
                onClick={() => navigate('/franchise/minors')}
              >
                ↑ View Minor League Roster
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded-md border border-navy-lighter hover:border-gold/40 hover:bg-navy-lighter/30 transition-all cursor-pointer font-mono text-xs text-cream-dim hover:text-cream"
                onClick={() => navigate('/franchise/roster')}
              >
                → Active Roster
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Call-up modal */}
      {callupContext && (
        <CallupModal
          prospects={prospects}
          onSelect={handleCallupSelect}
          onSkip={() => setCallupContext(null)}
        />
      )}
    </div>
  );
}
