import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { StatsTable } from '@/components/ui/StatsTable.tsx';
import { useCareerStore } from '@/stores/careerStore.ts';
import type { CareerLevel } from '@/engine/player/CareerEngine.ts';
import { cn } from '@/lib/cn.ts';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface RatingBarProps { label: string; value: number; max?: number; color?: string }
function RatingBar({ label, value, max = 99, color = '#d4a843' }: RatingBarProps) {
  const pct = Math.round((value / max) * 100);
  const shade = value >= 75 ? '#22c55e' : value >= 55 ? '#d4a843' : value >= 35 ? '#f97316' : '#ef4444';
  const barColor = color !== '#d4a843' ? color : shade;

  return (
    <div className="flex items-center gap-3">
      <span className="text-cream-dim text-xs font-mono uppercase w-20 flex-shrink-0 tracking-wide">{label}</span>
      <div className="flex-1 h-2 bg-navy rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      <span className="text-cream text-xs font-mono w-6 text-right">{value}</span>
    </div>
  );
}

const LEVEL_ORDER: CareerLevel[] = ['A', 'AA', 'AAA', 'MLB'];
const LEVEL_LABELS: Record<CareerLevel, string> = {
  'A': 'Single-A', 'AA': 'Double-A', 'AAA': 'Triple-A', 'MLB': 'The Majors',
};

function LevelIndicator({ current }: { current: CareerLevel }) {
  return (
    <div className="flex items-center gap-1">
      {LEVEL_ORDER.map((lvl, i) => {
        const active = lvl === current;
        const passed = LEVEL_ORDER.indexOf(current) > i;
        return (
          <div key={lvl} className="flex items-center gap-1">
            <div className={cn(
              'px-2.5 py-1 rounded text-xs font-mono font-bold uppercase tracking-widest transition-all',
              active   ? 'bg-gold text-navy shadow-[0_0_10px_#d4a84366]' :
              passed   ? 'bg-green-700/50 text-green-300 border border-green-700/50' :
                         'bg-navy-lighter/40 text-cream-dim/40 border border-navy-lighter/30'
            )}>
              {lvl}
            </div>
            {i < LEVEL_ORDER.length - 1 && (
              <div className={cn('w-5 h-0.5', passed ? 'bg-green-600/50' : 'bg-navy-lighter/30')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function CareerDashboardPage() {
  const navigate    = useNavigate();
  const {
    careerState,
    isInitialized,
    advanceDay,
    simWeek,
    simToCallUp,
    advanceOffseason,
    dismissPromotion,
    resetCareer,
  } = useCareerStore();

  if (!isInitialized || !careerState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Panel className="text-center max-w-sm w-full">
          <div className="py-8 space-y-4">
            <p className="text-cream font-body text-lg">No career in progress.</p>
            <Button onClick={() => navigate('/career/new')} size="lg">
              Start a Career
            </Button>
            <div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>← Main Menu</Button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  const { player, currentTeam, year, level, seasonStats: ss, careerStats: cs, dayOfSeason, recentEvents, promotionPending, promotionMessage } = careerState;

  const isPitcher   = player.position === 'P';
  const isOffseason = dayOfSeason >= 140;

  // Batting season stat columns
  const batSeasonCols = [
    { key: 'g',  label: 'G',   align: 'right' as const },
    { key: 'ab', label: 'AB',  align: 'right' as const },
    { key: 'r',  label: 'R',   align: 'right' as const },
    { key: 'h',  label: 'H',   align: 'right' as const },
    { key: '2b', label: '2B',  align: 'right' as const },
    { key: '3b', label: '3B',  align: 'right' as const },
    { key: 'hr', label: 'HR',  align: 'right' as const },
    { key: 'rbi',label: 'RBI', align: 'right' as const },
    { key: 'bb', label: 'BB',  align: 'right' as const },
    { key: 'so', label: 'SO',  align: 'right' as const },
    { key: 'sb', label: 'SB',  align: 'right' as const },
    { key: 'avg',label: 'AVG', align: 'right' as const },
    { key: 'obp',label: 'OBP', align: 'right' as const },
    { key: 'slg',label: 'SLG', align: 'right' as const },
    { key: 'ops',label: 'OPS', align: 'right' as const },
  ];

  const pitchSeasonCols = [
    { key: 'gs',  label: 'GS',  align: 'right' as const },
    { key: 'w',   label: 'W',   align: 'right' as const },
    { key: 'l',   label: 'L',   align: 'right' as const },
    { key: 'sv',  label: 'SV',  align: 'right' as const },
    { key: 'ip',  label: 'IP',  align: 'right' as const },
    { key: 'h',   label: 'H',   align: 'right' as const },
    { key: 'er',  label: 'ER',  align: 'right' as const },
    { key: 'bb',  label: 'BB',  align: 'right' as const },
    { key: 'so',  label: 'SO',  align: 'right' as const },
    { key: 'era', label: 'ERA', align: 'right' as const },
    { key: 'whip',label: 'WHIP',align: 'right' as const },
  ];

  const fmt = (n: number) => n.toFixed(3).replace(/^0/, '');

  const batSeasonRow = [{
    g: ss.g, ab: ss.ab, r: ss.r, h: ss.h, '2b': ss.doubles, '3b': ss.triples,
    hr: ss.hr, rbi: ss.rbi, bb: ss.bb, so: ss.so, sb: ss.sb,
    avg: fmt(ss.avg), obp: fmt(ss.obp), slg: fmt(ss.slg), ops: fmt(ss.ops),
  }];

  const pitchSeasonRow = [{
    gs: ss.gs, w: ss.wins, l: ss.losses, sv: ss.saves,
    ip: ss.ip.toFixed(1), h: ss.hits_allowed, er: ss.er, bb: ss.bb_p, so: ss.so_p,
    era: ss.era.toFixed(2), whip: ss.whip.toFixed(3),
  }];

  // Career stats
  const careerAvg = cs.batting.ab > 0 ? cs.batting.h / cs.batting.ab : 0;
  const careerERA = cs.pitching.ip > 0 ? (cs.pitching.er / cs.pitching.ip) * 9 : 0;

  const batCareerRow = [{
    seasons: cs.seasons, g: cs.batting.g, ab: cs.batting.ab, r: cs.batting.r,
    h: cs.batting.h, hr: cs.batting.hr, rbi: cs.batting.rbi,
    bb: cs.batting.bb, so: cs.batting.so, sb: cs.batting.sb, avg: fmt(careerAvg),
  }];
  const batCareerCols = [
    { key: 'seasons',label: 'YRS', align: 'right' as const },
    { key: 'g',  label: 'G',  align: 'right' as const },
    { key: 'ab', label: 'AB', align: 'right' as const },
    { key: 'r',  label: 'R',  align: 'right' as const },
    { key: 'h',  label: 'H',  align: 'right' as const },
    { key: 'hr', label: 'HR', align: 'right' as const },
    { key: 'rbi',label: 'RBI',align: 'right' as const },
    { key: 'bb', label: 'BB', align: 'right' as const },
    { key: 'so', label: 'SO', align: 'right' as const },
    { key: 'sb', label: 'SB', align: 'right' as const },
    { key: 'avg',label: 'AVG',align: 'right' as const },
  ];

  const pitchCareerRow = [{
    seasons: cs.seasons, gs: cs.pitching.gs, w: cs.pitching.wins, l: cs.pitching.losses,
    sv: cs.pitching.saves, ip: cs.pitching.ip.toFixed(1),
    er: cs.pitching.er, bb: cs.pitching.bb_p, so: cs.pitching.so_p, era: careerERA.toFixed(2),
  }];
  const pitchCareerCols = [
    { key: 'seasons',label:'YRS', align:'right' as const },
    { key: 'gs', label:'GS',  align:'right' as const },
    { key: 'w',  label:'W',   align:'right' as const },
    { key: 'l',  label:'L',   align:'right' as const },
    { key: 'sv', label:'SV',  align:'right' as const },
    { key: 'ip', label:'IP',  align:'right' as const },
    { key: 'er', label:'ER',  align:'right' as const },
    { key: 'bb', label:'BB',  align:'right' as const },
    { key: 'so', label:'SO',  align:'right' as const },
    { key: 'era',label:'ERA', align:'right' as const },
  ];

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Promotion Banner */}
        {promotionPending && promotionMessage && (
          <div
            className="p-4 rounded-lg border-2 border-gold text-center space-y-2 animate-pulse"
            style={{ backgroundColor: '#d4a84322', boxShadow: '0 0 24px #d4a84355' }}
          >
            <p className="font-display text-2xl text-gold tracking-wide uppercase">{promotionMessage}</p>
            <Button size="sm" onClick={dismissPromotion} data-testid="dismiss-promotion-btn">
              Acknowledge
            </Button>
          </div>
        )}

        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-gold tracking-tight uppercase">
              {player.firstName} {player.lastName}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="font-mono text-cream-dim text-xs">
                {player.position} · Age {player.age} · {currentTeam}
              </span>
              <span className="font-mono text-cream-dim/50 text-xs">·</span>
              <span className="font-mono text-cream-dim text-xs">
                {year} Season · Day {dayOfSeason}/140
              </span>
              <LevelIndicator current={level} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>← Menu</Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { if (confirm('Reset career? This cannot be undone.')) { resetCareer(); navigate('/career/new'); } }}
              className="text-red-400 border-red-900/50 hover:border-red-700/50"
            >
              New Career
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left: Ratings */}
          <div className="space-y-4">
            <Panel title="Ratings">
              {isPitcher ? (
                <div className="space-y-2.5">
                  <RatingBar label="Stuff"    value={player.pitching.stuff} />
                  <RatingBar label="Control"  value={player.pitching.control} />
                  <RatingBar label="Movement" value={player.pitching.movement} />
                  <RatingBar label="Stamina"  value={player.pitching.stamina} />
                  <RatingBar label="Velo"
                    value={Math.round((player.pitching.velocity - 78) / 24 * 99)}
                  />
                  <div className="pt-1 border-t border-navy-lighter/40 text-center">
                    <p className="text-cream-dim text-xs font-mono">{player.pitching.velocity} mph</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <RatingBar label="Contact" value={Math.round((player.batting.contact_L + player.batting.contact_R) / 2)} />
                  <RatingBar label="Power"   value={Math.round((player.batting.power_L + player.batting.power_R) / 2)} />
                  <RatingBar label="Eye"     value={player.batting.eye} />
                  <RatingBar label="Avoid K" value={player.batting.avoid_k} />
                  <RatingBar label="Speed"   value={player.batting.speed} />
                  <RatingBar label="Steal"   value={player.batting.steal} />
                  <RatingBar label="Clutch"  value={player.batting.clutch} />
                </div>
              )}
            </Panel>

            <Panel title="Mental">
              <div className="space-y-2.5">
                <RatingBar label="Intel"    value={player.mental.intelligence} color="#a855f7" />
                <RatingBar label="Ethic"    value={player.mental.work_ethic}   color="#a855f7" />
                <RatingBar label="Durable"  value={player.mental.durability}   color="#a855f7" />
                <RatingBar label="Consist"  value={player.mental.consistency}  color="#a855f7" />
                <RatingBar label="Composure"value={player.mental.composure}    color="#a855f7" />
                <RatingBar label="Lead"     value={player.mental.leadership}   color="#a855f7" />
              </div>
            </Panel>
          </div>

          {/* Right: Stats + actions */}
          <div className="lg:col-span-2 space-y-4">

            {/* Simulation controls */}
            <Panel title="Simulation">
              {isOffseason ? (
                <div className="space-y-3">
                  <p className="text-cream-dim text-sm font-body">
                    Season complete. Develop your skills during the offseason, then begin Year {year + 1}.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={advanceOffseason} data-testid="advance-offseason-btn">
                      Advance Offseason →
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-mono text-cream-dim/60 mb-1">
                        <span>Day {dayOfSeason}</span>
                        <span>140</span>
                      </div>
                      <div className="h-2 bg-navy rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gold/70 transition-all duration-500"
                          style={{ width: `${(dayOfSeason / 140) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={advanceDay}
                      data-testid="advance-day-btn"
                    >
                      Advance Day
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={simWeek}
                      data-testid="sim-week-btn"
                    >
                      Sim Week
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={simToCallUp}
                      data-testid="sim-callup-btn"
                    >
                      Sim to Call-Up
                    </Button>
                  </div>
                </div>
              )}
            </Panel>

            {/* Level progress */}
            <Panel title="Level Progression">
              <div className="space-y-3">
                <div className="flex items-center justify-center py-1">
                  <LevelIndicator current={level} />
                </div>
                <p className="text-center text-cream-dim text-sm font-body">
                  {level === 'MLB'
                    ? `You've made it to The Show! Playing for the ${currentTeam}.`
                    : `Currently with ${currentTeam} (${LEVEL_LABELS[level]}). ${
                        isPitcher
                          ? `ERA ${ss.era.toFixed(2)} in ${ss.gs} starts. Need ERA < 3.00 over ${Math.max(0, 6 - ss.gs)} more starts for promotion.`
                          : `Batting ${ss.avg >= 1 ? ss.avg.toFixed(3) : ss.avg.toFixed(3).replace(/^0/,'')} in ${ss.g} games. Need .300+ over ${Math.max(0, 30 - ss.g)} more games for promotion.`
                      }`
                  }
                </p>
              </div>
            </Panel>

            {/* Season Stats */}
            <Panel title={`${year} Season Stats`}>
              {isPitcher
                ? <StatsTable columns={pitchSeasonCols} rows={pitchSeasonRow} compact />
                : <StatsTable columns={batSeasonCols}   rows={batSeasonRow}   compact />
              }
            </Panel>

            {/* Career Stats */}
            <Panel title="Career Stats">
              {isPitcher
                ? <StatsTable columns={pitchCareerCols} rows={pitchCareerRow} compact />
                : <StatsTable columns={batCareerCols}   rows={batCareerRow}   compact />
              }
            </Panel>

            {/* Recent events */}
            {recentEvents.length > 0 && (
              <Panel title="Recent Activity">
                <ul className="space-y-1">
                  {recentEvents.map((ev, i) => (
                    <li key={i} className="text-cream-dim text-xs font-mono leading-relaxed">
                      {ev}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
