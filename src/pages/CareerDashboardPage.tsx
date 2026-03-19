import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { StatsTable } from '@/components/ui/StatsTable.tsx';
import { Modal } from '@/components/ui/Modal.tsx';
import { useCareerStore } from '@/stores/careerStore.ts';
import type { CareerLevel, Milestone } from '@/engine/player/CareerEngine.ts';
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

function DynamicsBar({ label, value, color = '#d4a843' }: { label: string; value: number; color?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-cream-dim">{label}</span>
        <span className="text-cream">{value}</span>
      </div>
      <div className="h-1.5 bg-navy rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function MilestoneToast({ milestone, onDismiss }: { milestone: Milestone; onDismiss: () => void }) {
  return (
    <div
      className="p-4 rounded-lg border-2 border-yellow-400 text-center space-y-2"
      style={{ backgroundColor: '#d4a84322', boxShadow: '0 0 24px #d4a84355' }}
    >
      <p className="font-display text-xl text-gold tracking-wide uppercase">Milestone Achieved!</p>
      <p className="text-cream text-sm font-body">{milestone.label}</p>
      <p className="text-cream-dim text-xs">{milestone.description}</p>
      <Button size="sm" onClick={onDismiss}>Awesome!</Button>
    </div>
  );
}

// ─── Contract Negotiation Modal ────────────────────────────────────────────────

function ContractNegotiationModal() {
  const { contractOffers, showContractNegotiation, signContract, dismissContractNegotiation } = useCareerStore();

  return (
    <Modal
      isOpen={showContractNegotiation}
      onClose={dismissContractNegotiation}
      title="Contract Negotiation"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-cream-dim text-sm font-body">
          Your contract has expired. Choose an offer or decline all (stay unsigned).
        </p>
        <div className="space-y-2">
          {contractOffers.map((offer, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg border border-navy-lighter bg-navy/50"
            >
              <div>
                <p className="text-cream font-mono text-sm font-bold">{offer.teamName}</p>
                <p className="text-cream-dim text-xs">
                  {offer.years} yr{offer.years > 1 ? 's' : ''} · ${(offer.salary / 1000).toFixed(1)}M/yr
                  {' '}· Total: ${((offer.salary * offer.years) / 1000).toFixed(1)}M
                </p>
              </div>
              <Button size="sm" onClick={() => signContract(offer)}>Sign</Button>
            </div>
          ))}
        </div>
        <div className="text-right">
          <Button variant="ghost" size="sm" onClick={dismissContractNegotiation}>
            Test Free Agency Later
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

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
    dismissPendingMilestone,
    resetCareer,
    retirePlayer,
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

  const {
    player, currentTeam, year, level, seasonStats: ss, careerStats: cs,
    dayOfSeason, recentEvents, promotionPending, promotionMessage,
    pendingMilestones, teamDynamics: dyn, contract, retired, hofStatus,
    currentSeasonAwards,
  } = careerState;

  const isPitcher   = player.position === 'P';
  const isOffseason = dayOfSeason >= 140;

  // Show first pending milestone
  const topMilestone = pendingMilestones[0] ?? null;

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

        {/* Milestone Toast */}
        {topMilestone && (
          <MilestoneToast
            milestone={topMilestone}
            onDismiss={() => dismissPendingMilestone(topMilestone.id)}
          />
        )}

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

        {/* Retirement Banner */}
        {retired && (
          <div
            className="p-4 rounded-lg border-2 border-purple-400 text-center space-y-2"
            style={{ backgroundColor: '#a855f722' }}
          >
            <p className="font-display text-2xl text-purple-300 tracking-wide uppercase">Retired</p>
            {hofStatus.inducted && (
              <p className="text-gold font-display text-lg">Hall of Fame Inductee — {hofStatus.inductionYear}</p>
            )}
            {!hofStatus.inducted && (
              <p className="text-cream-dim text-sm">HOF Score: {hofStatus.hofScore}/100 (need 75 to be inducted)</p>
            )}
            <Button size="sm" onClick={() => navigate('/career/hof')}>View HOF Status</Button>
          </div>
        )}

        {/* Season Awards */}
        {currentSeasonAwards.length > 0 && (
          <div className="p-3 rounded-lg border border-gold/40 bg-gold/5 flex flex-wrap gap-2">
            {currentSeasonAwards.map(award => (
              <span key={award} className="px-2 py-1 rounded bg-gold/20 text-gold text-xs font-mono uppercase tracking-wide">
                {award}
              </span>
            ))}
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/career/stats')}>Stats</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/career/training')}>Training</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/career/contract')}>Contract</Button>
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

          {/* Left column */}
          <div className="space-y-4">
            <Panel title="Ratings">
              {isPitcher && player.pitching ? (
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
              ) : player.batting ? (
                <div className="space-y-2.5">
                  <RatingBar label="Contact" value={Math.round((player.batting.contact_L + player.batting.contact_R) / 2)} />
                  <RatingBar label="Power"   value={Math.round((player.batting.power_L + player.batting.power_R) / 2)} />
                  <RatingBar label="Eye"     value={player.batting.eye} />
                  <RatingBar label="Avoid K" value={player.batting.avoid_k} />
                  <RatingBar label="Speed"   value={player.batting.speed} />
                  <RatingBar label="Steal"   value={player.batting.steal} />
                  <RatingBar label="Clutch"  value={player.batting.clutch} />
                </div>
              ) : (
                <p className="text-cream-dim text-xs font-mono">No batting ratings available.</p>
              )}
            </Panel>

            {/* Team Dynamics */}
            <Panel title="Team Dynamics">
              <div className="space-y-3">
                <DynamicsBar label="Manager Relationship" value={dyn.managerRelationship} color="#3b82f6" />
                <DynamicsBar label="Team Chemistry"       value={dyn.teamChemistry}       color="#22c55e" />
                <DynamicsBar label="Media Attention"      value={dyn.mediaAttention}       color="#f59e0b" />
                <DynamicsBar label="Morale"               value={dyn.morale}               color="#a855f7" />
                {dyn.fanFavorite && (
                  <p className="text-xs text-gold font-mono text-center pt-1">Fan Favorite</p>
                )}
              </div>
            </Panel>

            {/* Contract */}
            <Panel title="Contract">
              <div className="space-y-1 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-cream-dim">Team</span>
                  <span className="text-cream">{contract.teamName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cream-dim">Salary</span>
                  <span className="text-cream">${(contract.annualSalary / 1000).toFixed(1)}M/yr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cream-dim">Yrs Left</span>
                  <span className={cn('font-bold', contract.yearsRemaining === 0 ? 'text-red-400' : 'text-cream')}>
                    {contract.yearsRemaining}
                  </span>
                </div>
                {contract.yearsRemaining === 0 && (
                  <Button size="sm" className="w-full mt-2" onClick={() => navigate('/career/contract')}>
                    Negotiate New Deal
                  </Button>
                )}
              </div>
            </Panel>

            {/* Mental */}
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
              {retired ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-cream-dim font-body">Your career has ended.</p>
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" onClick={() => navigate('/career/hof')}>View HOF</Button>
                    <Button size="sm" onClick={() => navigate('/career/stats')}>Career Stats</Button>
                  </div>
                </div>
              ) : isOffseason ? (
                <div className="space-y-3">
                  <p className="text-cream-dim text-sm font-body">
                    Season complete. Develop your skills during the offseason, then begin Year {year + 1}.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={advanceOffseason} data-testid="advance-offseason-btn">
                      Advance Offseason
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate('/career/training')}
                    >
                      Set Training Plan
                    </Button>
                    {player.age >= 38 && !retired && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400"
                        onClick={() => { if (confirm('Retire your player? This cannot be undone.')) retirePlayer(); }}
                      >
                        Retire
                      </Button>
                    )}
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate('/career/game')}
                    >
                      Play Game
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
                          ? `ERA ${ss.era.toFixed(2)} in ${ss.gs} starts.`
                          : `Batting ${ss.avg.toFixed(3).replace(/^0/, '')} in ${ss.g} games.`
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
              <div className="mt-2 text-right">
                <Button variant="ghost" size="sm" onClick={() => navigate('/career/stats')}>
                  Full Stats →
                </Button>
              </div>
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

      {/* Contract Negotiation Modal */}
      <ContractNegotiationModal />
    </div>
  );
}
