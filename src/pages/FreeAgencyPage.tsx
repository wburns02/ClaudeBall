import { useState, useEffect, useMemo } from 'react';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { cn } from '@/lib/cn.ts';
import type { FreeAgent } from '@/engine/gm/FreeAgency.ts';

type FilterPos = 'ALL' | 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH';
type SortMode = 'ovr' | 'salary' | 'age' | 'pos';

function OvrBadge({ val }: { val: number }) {
  const color =
    val >= 75 ? 'text-gold border-gold/40 bg-gold/10' :
    val >= 60 ? 'text-green-light border-green-light/40 bg-green-light/10' :
    val >= 45 ? 'text-cream border-cream/20 bg-cream/5' :
    'text-red border-red/40 bg-red/10';
  return (
    <span className={cn('font-mono text-xs font-bold border rounded px-1.5 py-0.5', color)}>
      {val}
    </span>
  );
}

function RatingPip({ label, val }: { label: string; val: number }) {
  return (
    <div className="text-center">
      <div className="text-gold-dim text-xs font-mono">{label}</div>
      <div className="text-cream text-sm font-mono font-bold">{val}</div>
    </div>
  );
}

function FACard({
  fa,
  onSign,
  signing,
}: {
  fa: FreeAgent;
  onSign: (fa: FreeAgent, years: number, salary: number) => void;
  signing: boolean;
}) {
  const [offerYears, setOfferYears] = useState(fa.yearsDesired);
  const [offerSalary, setOfferSalary] = useState(fa.askingSalary);
  const [expanded, setExpanded] = useState(false);

  const p = fa.player;
  const ovr = Math.round(evaluatePlayer(p));
  const isPitcher = p.position === 'P';

  return (
    <div className={cn(
      'border border-navy-lighter rounded-lg bg-navy-light overflow-hidden transition-all',
      signing && 'opacity-50 pointer-events-none',
    )}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-cream font-body text-sm font-semibold truncate">{getPlayerName(p)}</span>
            <span className="font-mono text-xs text-gold bg-navy-lighter px-1.5 py-0.5 rounded">{p.position}</span>
            <span className="font-mono text-xs text-cream-dim">{p.bats}/{p.throws}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="font-mono text-xs text-cream-dim">Age {p.age}</span>
            <span className="font-mono text-xs text-cream-dim">
              Ask: <span className="text-gold">${(fa.askingSalary / 1000).toFixed(1)}M</span>/yr · {fa.yearsDesired}yr
            </span>
          </div>
        </div>

        <OvrBadge val={ovr} />

        <div className="flex gap-1.5">
          <Button size="sm" onClick={() => setExpanded(true)} title="Open offer form to set terms">
            {expanded ? 'Offer Terms ▼' : 'Sign…'}
          </Button>
        </div>
      </div>

      {/* Ratings row (always visible) */}
      <div className="flex gap-4 px-4 pb-3">
        {isPitcher ? (
          <>
            <RatingPip label="STU" val={p.pitching.stuff} />
            <RatingPip label="MOV" val={p.pitching.movement} />
            <RatingPip label="CTL" val={p.pitching.control} />
            <RatingPip label="STA" val={p.pitching.stamina} />
            <div className="text-center">
              <div className="text-gold-dim text-xs font-mono">VEL</div>
              <div className="text-cream text-sm font-mono font-bold">{p.pitching.velocity}</div>
            </div>
          </>
        ) : (
          <>
            <RatingPip label="CON" val={Math.round((p.batting.contact_L + p.batting.contact_R) / 2)} />
            <RatingPip label="PWR" val={Math.round((p.batting.power_L + p.batting.power_R) / 2)} />
            <RatingPip label="EYE" val={p.batting.eye} />
            <RatingPip label="SPD" val={p.batting.speed} />
            <RatingPip label="GAP" val={p.batting.gap_power} />
          </>
        )}
      </div>

      {/* Expanded offer controls */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-navy-lighter pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xs text-cream-dim block mb-1">Years</label>
              <input
                type="number"
                min={1}
                max={7}
                value={offerYears}
                onChange={e => setOfferYears(Number(e.target.value))}
                className="w-full bg-navy-lighter border border-navy-lighter rounded px-2 py-1 font-mono text-sm text-cream focus:outline-none focus:border-gold/50"
              />
            </div>
            <div>
              <label className="font-mono text-xs text-cream-dim block mb-1">
                Salary/yr (asking ${(fa.askingSalary / 1000).toFixed(1)}M)
              </label>
              <input
                type="number"
                min={500}
                step={100}
                value={offerSalary}
                onChange={e => setOfferSalary(Number(e.target.value))}
                className="w-full bg-navy-lighter border border-navy-lighter rounded px-2 py-1 font-mono text-sm text-cream focus:outline-none focus:border-gold/50"
              />
            </div>
          </div>
          <Button onClick={() => onSign(fa, offerYears, offerSalary)}>
            Sign {getPlayerName(p)} — {offerYears}yr / ${(offerSalary / 1000).toFixed(1)}M
          </Button>
        </div>
      )}
    </div>
  );
}

export function FreeAgencyPage() {
  const { freeAgentPool, initFreeAgency, signFreeAgent, season, teamBudgets, getTeamPayroll, userTeamId } = useFranchiseStore();
  const teamBudget = (userTeamId && teamBudgets[userTeamId]) ? teamBudgets[userTeamId] : null;
  const currentPayrollRaw = userTeamId ? getTeamPayroll(userTeamId) : 0;
  const currentPayroll = isNaN(currentPayrollRaw) ? 0 : (currentPayrollRaw || 0);
  const budgetRoom = teamBudget !== null ? teamBudget - currentPayroll : null;

  const [posFilter, setPosFilter] = useState<FilterPos>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('ovr');
  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);
  const [signing, setSigning] = useState<string | null>(null);

  const isOffseason = season?.phase === 'offseason';

  useEffect(() => {
    if (!freeAgentPool) initFreeAgency();
  }, [freeAgentPool, initFreeAgency]);

  const agents = useMemo(() => {
    let list: FreeAgent[] = freeAgentPool ? freeAgentPool.getAll() : [];
    if (posFilter !== 'ALL') list = list.filter(fa => fa.player.position === posFilter);
    switch (sortMode) {
      case 'ovr': list = [...list].sort((a, b) => evaluatePlayer(b.player) - evaluatePlayer(a.player)); break;
      case 'salary': list = [...list].sort((a, b) => a.askingSalary - b.askingSalary); break;
      case 'age': list = [...list].sort((a, b) => a.player.age - b.player.age); break;
      case 'pos': list = [...list].sort((a, b) => a.player.position.localeCompare(b.player.position)); break;
    }
    return list;
  }, [freeAgentPool, posFilter, sortMode]);

  const handleSign = (fa: FreeAgent, years: number, salary: number) => {
    setSigning(fa.player.id);
    const result = signFreeAgent(fa.player.id, years, salary);
    setNotice({ msg: result.reason ?? `Signed ${getPlayerName(fa.player)}!`, ok: result.success });
    setSigning(null);
    setTimeout(() => setNotice(null), 3500);
  };

  const POS_FILTERS: FilterPos[] = ['ALL', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Free Agency</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {agents.length} players available
          </p>
        </div>
        {budgetRoom !== null && (
          <div className="shrink-0 text-right">
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider">Budget Room</p>
            <p className={cn(
              'font-display text-xl font-bold',
              budgetRoom < 0 ? 'text-red-400' : budgetRoom < 10_000 ? 'text-gold' : 'text-green-light',
            )}>
              {budgetRoom >= 0 ? `$${(budgetRoom / 1000).toFixed(1)}M` : `-$${(-budgetRoom / 1000).toFixed(1)}M`}
            </p>
            {budgetRoom < 0 && (
              <p className="font-mono text-[10px] text-red-400/70">Over budget — no signings</p>
            )}
          </div>
        )}
      </div>

      {/* In-season notice */}
      {!isOffseason && (
        <div className="mb-4 px-4 py-3 rounded-md font-mono text-sm border border-gold/30 bg-gold/5 text-gold/80">
          In-season free agency — fringe players available now. Full FA market opens after the season.
        </div>
      )}

      {/* Notice banner */}
      {notice && (
        <div className={cn(
          'mb-4 px-4 py-3 rounded-md font-mono text-sm border',
          notice.ok
            ? 'bg-green-900/30 border-green-light/30 text-green-light'
            : 'bg-red-900/30 border-red-500/30 text-red-400',
        )}>
          {notice.msg}
        </div>
      )}

      {/* Filters */}
      <Panel className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Position filter */}
          <div className="flex flex-wrap gap-1">
            {POS_FILTERS.map(pos => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                className={cn(
                  'px-2.5 py-1 rounded font-mono text-xs cursor-pointer transition-colors',
                  posFilter === pos
                    ? 'bg-gold text-navy font-bold'
                    : 'bg-navy-lighter text-cream-dim hover:text-cream',
                )}
              >
                {pos}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-navy-lighter mx-1" />

          {/* Sort */}
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs text-cream-dim">Sort:</span>
            {(['ovr', 'salary', 'age', 'pos'] as SortMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={cn(
                  'px-2.5 py-1 rounded font-mono text-xs cursor-pointer transition-colors',
                  sortMode === mode
                    ? 'bg-gold text-navy font-bold'
                    : 'bg-navy-lighter text-cream-dim hover:text-cream',
                )}
              >
                {mode === 'ovr' ? 'OVR' : mode === 'salary' ? 'Salary' : mode === 'age' ? 'Age' : 'Pos'}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {/* Free Agent List */}
      {agents.length === 0 ? (
        <Panel>
          <p className="font-mono text-cream-dim text-center py-8">
            No free agents match your filter.
          </p>
        </Panel>
      ) : (
        <div className="space-y-2">
          {agents.map(fa => (
            <FACard
              key={fa.player.id}
              fa={fa}
              onSign={handleSign}
              signing={signing === fa.player.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
