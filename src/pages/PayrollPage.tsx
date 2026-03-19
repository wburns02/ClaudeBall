import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { estimateMarketSalary, estimateDesiredYears } from '@/engine/gm/ContractEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import type { PlayerContract } from '@/engine/gm/ContractEngine.ts';

// Luxury tax threshold & competitive budget (in thousands = $M * 1000)
const LUXURY_TAX = 220_000;   // $220M
const SOFT_CAP   = 195_000;   // $195M — competitive budget
const MIN_PAYROLL =  80_000;   // $80M  — floor

function fmt(thousands: number): string {
  return `$${(thousands / 1000).toFixed(1)}M`;
}

function pct(val: number, max: number): number {
  return Math.min(100, (val / max) * 100);
}

// Color for contract years remaining
function yrsColor(yrs: number): string {
  if (yrs >= 4) return 'text-green-light';
  if (yrs >= 2) return 'text-gold';
  return 'text-red-400';
}

// Salary bar width relative to max possible ($30M)
function SalaryBar({ salary, max = 30_000 }: { salary: number; max?: number }) {
  const pctW = pct(salary, max);
  const color = salary >= 15_000 ? 'bg-gold' : salary >= 8_000 ? 'bg-green-light' : 'bg-cream-dim/40';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-navy-lighter rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pctW}%` }} />
      </div>
      <span className="font-mono text-xs text-gold">{fmt(salary)}</span>
    </div>
  );
}

// Extension negotiation modal
function ExtensionModal({
  player,
  contract,
  teamId,
  onClose,
  onSign,
}: {
  player: Player;
  contract: PlayerContract;
  teamId: string;
  onClose: () => void;
  onSign: (years: number, salary: number) => void;
}) {
  const marketSalary = estimateMarketSalary(player);
  const desiredYears = estimateDesiredYears(player);
  const [offerYears, setOfferYears] = useState(Math.max(1, desiredYears - 1));
  const [offerSalary, setOfferSalary] = useState(Math.round(marketSalary * 0.95 / 500) * 500);
  const [result, setResult] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  const minSalary = Math.round(marketSalary * 0.80);
  const isValid = offerSalary >= minSalary && offerYears >= 1 && offerYears <= desiredYears + 1;

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-navy-light border border-navy-lighter rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-xl text-gold tracking-wide">{getPlayerName(player)}</h2>
            <p className="font-mono text-xs text-cream-dim">{player.position} · Age {player.age} · OVR {Math.round(evaluatePlayer(player))}</p>
          </div>
          <button onClick={onClose} className="text-cream-dim/40 hover:text-cream-dim text-lg">✕</button>
        </div>

        {/* Current contract */}
        <div className="mb-4 p-3 bg-navy-lighter/30 rounded-lg">
          <p className="font-mono text-xs text-cream-dim/50 uppercase mb-1">Current Contract</p>
          <p className="font-mono text-sm text-cream">{fmt(contract.salaryPerYear)}/yr · {contract.yearsRemaining} yr remaining</p>
        </div>

        {/* Player demands */}
        <div className="mb-5 p-3 bg-gold/5 border border-gold/20 rounded-lg">
          <p className="font-mono text-xs text-gold/60 uppercase mb-1">Player Looking For</p>
          <p className="font-mono text-sm text-gold">{fmt(marketSalary)}/yr · up to {desiredYears} years</p>
          <p className="font-mono text-xs text-cream-dim/50 mt-1">Min acceptable: {fmt(minSalary)}/yr</p>
        </div>

        {signed ? (
          <div className="p-4 bg-green-900/20 border border-green-light/30 rounded-lg text-center">
            <p className="font-mono text-green-light font-bold">Extension Signed! ✓</p>
            <p className="font-mono text-xs text-cream-dim mt-1">{result}</p>
            <Button className="mt-3 w-full" variant="secondary" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <>
            {/* Offer form */}
            <div className="space-y-4 mb-5">
              <div>
                <label className="font-mono text-xs text-cream-dim/50 uppercase block mb-2">Your Offer — Years</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map(y => (
                    <button
                      key={y}
                      onClick={() => setOfferYears(y)}
                      className={cn(
                        'flex-1 py-1.5 font-mono text-xs rounded-lg border transition-all',
                        offerYears === y
                          ? 'bg-gold/15 border-gold/50 text-gold'
                          : 'bg-navy-lighter/20 border-transparent text-cream-dim/50 hover:text-cream-dim',
                        y > desiredYears + 1 && 'opacity-30 cursor-not-allowed',
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-mono text-xs text-cream-dim/50 uppercase block mb-2">
                  Salary/Year — {fmt(offerSalary)}
                </label>
                <input
                  type="range"
                  min={Math.round(minSalary * 0.7)}
                  max={Math.round(marketSalary * 1.5)}
                  step={250}
                  value={offerSalary}
                  onChange={e => setOfferSalary(Number(e.target.value))}
                  className="w-full accent-gold"
                />
                <div className="flex justify-between font-mono text-[10px] text-cream-dim/30 mt-1">
                  <span>{fmt(Math.round(minSalary * 0.7))}</span>
                  <span className={cn('font-bold', isValid ? 'text-green-light' : 'text-red-400')}>
                    {isValid ? '✓ Acceptable' : '✗ Too low'}
                  </span>
                  <span>{fmt(Math.round(marketSalary * 1.5))}</span>
                </div>
              </div>
            </div>

            {/* Total cost */}
            <div className="flex items-center justify-between mb-4 px-3 py-2 bg-navy-lighter/20 rounded-lg">
              <span className="font-mono text-xs text-cream-dim/50">Total commitment</span>
              <span className="font-mono text-sm font-bold text-cream">{fmt(offerSalary * offerYears)} over {offerYears} yr</span>
            </div>

            {result && (
              <div className="mb-4 p-3 bg-red/10 border border-red/30 rounded-lg">
                <p className="font-mono text-xs text-red-400">{result}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button
                className="flex-1"
                disabled={!isValid}
                onClick={() => {
                  onSign(offerYears, offerSalary);
                  setSigned(true);
                  setResult(`${getPlayerName(player)} signed a ${offerYears}-year, ${fmt(offerSalary)}/yr extension.`);
                }}
              >
                Offer Extension
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Contract row component
function ContractRow({
  player,
  contract,
  isUser,
  onExtend,
}: {
  player: Player;
  contract: PlayerContract;
  isUser: boolean;
  onExtend?: () => void;
}) {
  const ovr = Math.round(evaluatePlayer(player));
  const isExpiring = contract.yearsRemaining <= 1;
  const isFA = contract.isFreeAgent;

  return (
    <tr className={cn(
      'border-b border-navy-lighter/30 transition-colors',
      isExpiring && !isFA && 'bg-gold/5',
      isFA && 'opacity-50',
    )}>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-body text-sm text-cream">{getPlayerName(player)}</span>
          {isExpiring && !isFA && (
            <span className="font-mono text-[9px] bg-gold/15 text-gold border border-gold/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
              Contract Year
            </span>
          )}
          {isFA && (
            <span className="font-mono text-[9px] bg-red/10 text-red-400 border border-red/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
              FA
            </span>
          )}
        </div>
        <p className="font-mono text-[10px] text-cream-dim/50">{player.position} · Age {player.age}</p>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className={cn(
          'font-mono text-xs font-bold',
          ovr >= 75 ? 'text-gold' : ovr >= 60 ? 'text-green-light' : ovr >= 45 ? 'text-cream' : 'text-red-400',
        )}>
          {ovr}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <SalaryBar salary={contract.salaryPerYear} />
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className={cn('font-mono text-xs font-bold', yrsColor(contract.yearsRemaining))}>
          {isFA ? '—' : `${contract.yearsRemaining}yr`}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center font-mono text-xs text-cream-dim/50">
        {isFA ? '—' : fmt(contract.salaryPerYear * contract.yearsRemaining)}
      </td>
      {isUser && (
        <td className="px-3 py-2.5">
          {!isFA && contract.yearsRemaining <= 2 && onExtend && (
            <Button size="sm" variant="secondary" onClick={onExtend}>
              Extend
            </Button>
          )}
        </td>
      )}
    </tr>
  );
}

export function PayrollPage() {
  const navigate = useNavigate();
  const {
    season, engine, userTeamId,
    getAllTeamContracts, getTeamPayroll, signExtension,
    teamBudgets, requestBudgetIncrease,
  } = useFranchiseStore();

  const [extendPlayer, setExtendPlayer] = useState<{ player: Player; contract: PlayerContract } | null>(null);
  const [sortMode, setSortMode] = useState<'salary' | 'ovr' | 'years' | 'name'>('salary');
  const [viewMode, setViewMode] = useState<'roster' | 'league'>('roster');
  const [signResult, setSignResult] = useState<string | null>(null);
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetRequestAmt, setBudgetRequestAmt] = useState(10_000);
  const [budgetResult, setBudgetResult] = useState<{ approved: boolean; reason: string } | null>(null);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => navigate('/')}>Back to Menu</Button>
      </div>
    );
  }

  const userTeam = engine.getTeam(userTeamId);
  const userContracts = getAllTeamContracts(userTeamId);
  const totalPayrollRaw = getTeamPayroll(userTeamId);
  const totalPayroll = isNaN(totalPayrollRaw) ? 0 : (totalPayrollRaw || 0);
  const teamBudget = teamBudgets[userTeamId] ?? 150_000;
  const budgetRoom = teamBudget - totalPayroll;
  const budgetPct = Math.min(100, (totalPayroll / teamBudget) * 100);
  const overBudget = totalPayroll > teamBudget;

  // Sorted contracts
  const sortedContracts = useMemo(() => {
    return [...userContracts].sort((a, b) => {
      switch (sortMode) {
        case 'salary': return b.contract.salaryPerYear - a.contract.salaryPerYear;
        case 'ovr': return evaluatePlayer(b.player) - evaluatePlayer(a.player);
        case 'years': return b.contract.yearsRemaining - a.contract.yearsRemaining;
        case 'name': return getPlayerName(a.player).localeCompare(getPlayerName(b.player));
        default: return 0;
      }
    });
  }, [userContracts, sortMode]);

  // League-wide payrolls
  const leaguePayrolls = useMemo(() => {
    return engine.getAllTeams()
      .map(team => ({
        team,
        payroll: getTeamPayroll(team.id),
        isUser: team.id === userTeamId,
      }))
      .sort((a, b) => b.payroll - a.payroll);
  }, [engine, userTeamId]);

  // Future commitment analysis
  const futureCommitments = useMemo(() => {
    const byYear: Record<number, number> = {};
    for (const { contract } of userContracts) {
      if (contract.isFreeAgent) continue;
      for (let y = 1; y <= contract.yearsRemaining; y++) {
        byYear[y] = (byYear[y] ?? 0) + contract.salaryPerYear;
      }
    }
    return Object.entries(byYear)
      .map(([yr, amt]) => ({ yr: Number(yr), amt }))
      .sort((a, b) => a.yr - b.yr)
      .slice(0, 5);
  }, [userContracts]);

  // Expiring contracts (1 year or less, not FA)
  const expiring = userContracts.filter(c => c.contract.yearsRemaining <= 1 && !c.contract.isFreeAgent);
  const topEarners = [...userContracts].sort((a, b) => b.contract.salaryPerYear - a.contract.salaryPerYear).slice(0, 3);

  // Luxury tax status
  const aboveLuxury = totalPayroll > LUXURY_TAX;
  const aboveSoftCap = totalPayroll > SOFT_CAP;
  const capSpace = LUXURY_TAX - totalPayroll;
  const softCapSpace = SOFT_CAP - totalPayroll;

  const handleSignExtension = (years: number, salary: number) => {
    if (!extendPlayer) return;
    const result = signExtension(extendPlayer.player.id, userTeamId, years, salary);
    if (result.success) {
      setSignResult(`✓ ${getPlayerName(extendPlayer.player)} signed a ${years}-year, ${fmt(salary)}/yr extension.`);
    } else {
      setSignResult(`✗ ${result.reason}`);
    }
    setExtendPlayer(null);
  };

  const handleBudgetRequest = () => {
    const result = requestBudgetIncrease(budgetRequestAmt);
    setBudgetResult({ approved: result.approved, reason: result.reason });
    setBudgetModal(false);
  };

  const SortBtn = ({ mode, label }: { mode: typeof sortMode; label: string }) => (
    <button
      onClick={() => setSortMode(mode)}
      className={cn(
        'text-xs font-mono uppercase tracking-wider transition-colors',
        sortMode === mode ? 'text-gold' : 'text-cream-dim/40 hover:text-cream-dim',
      )}
    >
      {label} {sortMode === mode ? '▼' : ''}
    </button>
  );

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Payroll & Contracts</h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          {userTeam?.city} {userTeam?.name} · {season.year} Season
        </p>
      </div>

      {/* Owner Budget Panel */}
      <Panel className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-lg text-cream uppercase tracking-wide">Owner Budget</h2>
            <p className="font-mono text-xs text-cream-dim/50 mt-0.5">
              Ownership-approved annual spending limit
            </p>
          </div>
          <button
            onClick={() => { setBudgetResult(null); setBudgetModal(true); }}
            className="shrink-0 px-3 py-1.5 rounded-lg border font-mono text-xs transition-all cursor-pointer border-gold/30 bg-gold/5 text-gold hover:bg-gold/15 hover:border-gold/50"
          >
            Request Increase
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider mb-1">Annual Budget</p>
            <p className="font-display text-2xl text-gold font-bold">{fmt(teamBudget)}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider mb-1">Current Payroll</p>
            <p className={cn('font-display text-2xl font-bold', overBudget ? 'text-red-400' : 'text-cream')}>{fmt(totalPayroll)}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider mb-1">
              {budgetRoom >= 0 ? 'Budget Room' : 'Over Budget'}
            </p>
            <p className={cn('font-display text-2xl font-bold', budgetRoom >= 0 ? 'text-green-light' : 'text-red-400')}>
              {budgetRoom >= 0 ? fmt(budgetRoom) : `+${fmt(-budgetRoom)}`}
            </p>
          </div>
        </div>

        {/* Budget bar */}
        <div>
          <div className="w-full h-3 bg-navy-lighter rounded-full overflow-hidden relative">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                overBudget ? 'bg-red-500' : budgetPct > 85 ? 'bg-gold' : 'bg-green-light/70',
              )}
              style={{ width: `${budgetPct}%` }}
            />
            {/* Budget line */}
            <div className="absolute inset-y-0 right-0 w-0.5 bg-white/20" />
          </div>
          <div className="flex justify-between font-mono text-[10px] text-cream-dim/40 mt-1">
            <span>$0</span>
            <span className={cn('font-bold', overBudget ? 'text-red-400' : 'text-cream-dim/60')}>
              {budgetPct.toFixed(0)}% used
            </span>
            <span>{fmt(teamBudget)}</span>
          </div>
        </div>

        {overBudget && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-red-900/20 border border-red-500/30">
            <p className="font-mono text-xs text-red-400">
              ⚠ You are ${((totalPayroll - teamBudget) / 1000).toFixed(1)}M over your owner-approved budget. You cannot sign free agents until you are back under budget.
            </p>
          </div>
        )}
      </Panel>

      {/* Budget request modal */}
      {budgetModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setBudgetModal(false)}>
          <div className="bg-navy-light border border-navy-lighter rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="font-display text-xl text-gold mb-1">Request Budget Increase</h2>
            <p className="font-mono text-xs text-cream-dim/50 mb-4">
              Your current budget: {fmt(teamBudget)}. Ownership approves based on team performance.
            </p>
            <p className="font-mono text-xs text-cream-dim/50 uppercase tracking-wider mb-2">How much to request?</p>
            <div className="flex gap-2 mb-4 flex-wrap">
              {[5_000, 10_000, 15_000, 20_000, 30_000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setBudgetRequestAmt(amt)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border font-mono text-xs transition-all cursor-pointer',
                    budgetRequestAmt === amt
                      ? 'bg-gold/15 border-gold/50 text-gold'
                      : 'border-navy-lighter/50 text-cream-dim hover:border-navy-lighter',
                  )}
                >
                  +{fmt(amt)}
                </button>
              ))}
            </div>
            <p className="font-mono text-xs text-cream-dim/40 mb-4">
              New budget if approved: <span className="text-cream">{fmt(teamBudget + budgetRequestAmt)}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setBudgetModal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleBudgetRequest}>Submit Request</Button>
            </div>
          </div>
        </div>
      )}

      {/* Budget result notification */}
      {budgetResult && (
        <div className={cn(
          'mb-4 px-4 py-3 rounded-lg border font-mono text-sm flex items-center justify-between',
          budgetResult.approved
            ? 'bg-green-900/20 border-green-light/30 text-green-light'
            : 'bg-red-900/10 border-red-500/30 text-red-400',
        )}>
          <span>{budgetResult.reason}</span>
          <button onClick={() => setBudgetResult(null)} className="text-cream-dim/40 hover:text-cream-dim ml-3">✕</button>
        </div>
      )}

      {/* Sign result toast */}
      {signResult && (
        <div className={cn(
          'mb-4 px-4 py-3 rounded-lg border font-mono text-sm flex items-center justify-between',
          signResult.startsWith('✓')
            ? 'bg-green-900/20 border-green-light/30 text-green-light'
            : 'bg-red/10 border-red/30 text-red-400',
        )}>
          <span>{signResult}</span>
          <button onClick={() => setSignResult(null)} className="text-cream-dim/40 hover:text-cream-dim ml-3">✕</button>
        </div>
      )}

      {/* Payroll Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-6">
        {[
          {
            label: 'Total Payroll',
            value: fmt(totalPayroll),
            sub: aboveLuxury ? 'Above lux tax' : aboveSoftCap ? 'Above soft cap' : 'Under soft cap',
            color: aboveLuxury ? 'text-red-400' : aboveSoftCap ? 'text-gold' : 'text-green-light',
          },
          {
            label: aboveLuxury ? 'Lux Tax' : 'Cap Space',
            value: aboveLuxury ? `+${fmt(totalPayroll - LUXURY_TAX)}` : fmt(Math.max(0, capSpace)),
            sub: `vs ${fmt(LUXURY_TAX)}`,
            color: aboveLuxury ? 'text-red-400' : 'text-cream',
          },
          {
            label: 'Expiring',
            value: `${expiring.length}`,
            sub: expiring.length > 0 ? expiring.map(c => c.player.lastName).join(', ').slice(0, 18) : 'None',
            color: expiring.length > 0 ? 'text-gold' : 'text-cream-dim',
          },
          {
            label: 'Contracts',
            value: `${userContracts.filter(c => !c.contract.isFreeAgent).length}`,
            sub: `${userContracts.length} rostered`,
            color: 'text-cream',
          },
        ].map(({ label, value, sub, color }) => (
          <div
            key={label}
            className={cn(
              'bg-navy-light border border-navy-lighter rounded-lg p-2 sm:p-4',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.3)]',
            )}
          >
            <div className="text-center overflow-hidden">
              <p className="font-mono text-[9px] sm:text-[10px] text-cream-dim/50 uppercase tracking-wide mb-1 truncate">{label}</p>
              <p className={cn('font-display text-sm sm:text-2xl font-bold leading-tight', color)}>{value}</p>
              <p className="font-mono text-[9px] sm:text-[10px] text-cream-dim/40 mt-1 truncate">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Payroll Bar */}
      <Panel className="mb-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between font-mono text-xs gap-2">
            <span className="text-cream-dim/50 uppercase tracking-wider shrink-0">Payroll</span>
            <span className={cn('font-bold truncate', aboveLuxury ? 'text-red-400' : 'text-gold')}>
              {fmt(totalPayroll)} / {fmt(LUXURY_TAX)} lux threshold
            </span>
          </div>
          <div className="relative h-8 bg-navy-lighter rounded-full overflow-hidden">
            {/* Floor */}
            <div
              className="absolute top-0 bottom-0 border-r-2 border-cream-dim/20"
              style={{ left: `${pct(MIN_PAYROLL, LUXURY_TAX)}%` }}
              title="Payroll floor"
            />
            {/* Soft cap marker */}
            <div
              className="absolute top-0 bottom-0 border-r-2 border-gold/50"
              style={{ left: `${pct(SOFT_CAP, LUXURY_TAX)}%` }}
              title="Soft cap"
            />
            {/* Fill */}
            <div
              className={cn(
                'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                aboveLuxury ? 'bg-gradient-to-r from-red-800/60 to-red-500/80' :
                aboveSoftCap ? 'bg-gradient-to-r from-gold/40 to-gold/70' :
                'bg-gradient-to-r from-green-900/50 to-green-light/60',
              )}
              style={{ width: `${Math.min(100, pct(totalPayroll, LUXURY_TAX * 1.1))}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-[10px] text-cream-dim/30">
            <span>Floor {fmt(MIN_PAYROLL)}</span>
            <span className="hidden sm:block text-gold/50">Soft cap {fmt(SOFT_CAP)}</span>
            <span className={cn(aboveLuxury ? 'text-red-400/70' : 'text-cream-dim/40')}>
              Lux {fmt(LUXURY_TAX)}
            </span>
          </div>

          {/* Top 3 earners inline */}
          <div className="flex flex-wrap gap-3 pt-1">
            {topEarners.map(({ player, contract }) => (
              <div key={player.id} className="flex items-center gap-2 px-3 py-1.5 bg-navy-lighter/20 rounded-full border border-navy-lighter/40">
                <span className="font-body text-xs text-cream">{getPlayerName(player)}</span>
                <span className="font-mono text-xs text-gold">{fmt(contract.salaryPerYear)}/yr</span>
                <span className="font-mono text-[10px] text-cream-dim/40">{contract.yearsRemaining}yr</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* View tabs */}
      <div className="flex items-center gap-1 bg-navy-lighter/30 rounded-xl p-1 mb-4 w-fit">
        {(['roster', 'league'] as const).map(v => (
          <button
            key={v}
            onClick={() => setViewMode(v)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all',
              viewMode === v ? 'bg-gold text-navy shadow-[0_1px_3px_rgba(0,0,0,0.3)]' : 'text-cream-dim hover:text-cream',
            )}
          >
            {v === 'roster' ? 'My Roster' : 'League Comparison'}
          </button>
        ))}
      </div>

      {viewMode === 'roster' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
          {/* Contracts Table */}
          <Panel title={`Contracts (${sortedContracts.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-navy-lighter">
                    <th className="px-3 py-2 text-left">
                      <SortBtn mode="name" label="Player" />
                    </th>
                    <th className="px-3 py-2 text-center">
                      <SortBtn mode="ovr" label="OVR" />
                    </th>
                    <th className="px-3 py-2 text-left">
                      <SortBtn mode="salary" label="Salary/yr" />
                    </th>
                    <th className="px-3 py-2 text-center">
                      <SortBtn mode="years" label="Years" />
                    </th>
                    <th className="px-3 py-2 text-center text-gold-dim text-xs font-semibold uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-3 py-2 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {sortedContracts.map(({ player, contract }) => (
                    <ContractRow
                      key={player.id}
                      player={player}
                      contract={contract}
                      isUser
                      onExtend={() => setExtendPlayer({ player, contract })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Right column */}
          <div className="space-y-4">
            {/* Future Commitments */}
            <Panel title="Future Commitments">
              {futureCommitments.length === 0 ? (
                <p className="font-mono text-cream-dim text-sm text-center py-4">No multi-year contracts</p>
              ) : (
                <div className="space-y-2">
                  {futureCommitments.map(({ yr, amt }) => (
                    <div key={yr} className="flex items-center gap-3">
                      <span className="font-mono text-xs text-cream-dim/50 w-16">
                        {season.year + yr - 1}
                      </span>
                      <div className="flex-1 h-2 bg-navy-lighter rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gold/50 rounded-full transition-all"
                          style={{ width: `${pct(amt, LUXURY_TAX)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-gold">{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Expiring Contracts */}
            <Panel title={`Contract Year (${expiring.length})`}>
              {expiring.length === 0 ? (
                <p className="font-mono text-cream-dim text-sm text-center py-4">
                  No players in contract year
                </p>
              ) : (
                <div className="space-y-1.5">
                  {expiring.map(({ player, contract }) => (
                    <div key={player.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-gold/5 border border-gold/20">
                      <div>
                        <p className="font-body text-sm text-cream">{getPlayerName(player)}</p>
                        <p className="font-mono text-[10px] text-cream-dim/50">{player.position} · OVR {Math.round(evaluatePlayer(player))}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xs text-gold">{fmt(contract.salaryPerYear)}</p>
                        <p className="font-mono text-[10px] text-cream-dim/50">expires</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {expiring.length > 0 && (
                <p className="font-mono text-[10px] text-cream-dim/30 mt-3 text-center">
                  Offer extensions before they hit free agency
                </p>
              )}
            </Panel>

            {/* Value Watch — big contracts vs OVR */}
            <Panel title="Value Watch">
              <p className="font-mono text-xs text-cream-dim/50 mb-3">Best & worst contract value</p>
              {(() => {
                const withValue = userContracts
                  .filter(c => !c.contract.isFreeAgent)
                  .map(({ player, contract }) => ({
                    player, contract,
                    ovr: Math.round(evaluatePlayer(player)),
                    marketVal: estimateMarketSalary(player),
                    ratio: estimateMarketSalary(player) / Math.max(1, contract.salaryPerYear),
                  }))
                  .sort((a, b) => b.ratio - a.ratio);
                const best = withValue.slice(0, 2);
                const worst = withValue.slice(-2).reverse();
                return (
                  <div className="space-y-3">
                    <div>
                      <p className="font-mono text-[10px] text-green-light/60 uppercase mb-1">Best Value</p>
                      {best.map(({ player, contract, ovr, ratio }) => (
                        <div key={player.id} className="flex items-center justify-between py-1">
                          <span className="font-body text-xs text-cream">{getPlayerName(player)}</span>
                          <div className="text-right">
                            <span className="font-mono text-xs text-green-light">{fmt(contract.salaryPerYear)}</span>
                            <span className="font-mono text-[10px] text-cream-dim/30 ml-1">({ratio.toFixed(1)}x value)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="w-full h-px bg-navy-lighter/50" />
                    <div>
                      <p className="font-mono text-[10px] text-red-400/60 uppercase mb-1">Overpaid</p>
                      {worst.map(({ player, contract, ratio }) => (
                        <div key={player.id} className="flex items-center justify-between py-1">
                          <span className="font-body text-xs text-cream">{getPlayerName(player)}</span>
                          <div className="text-right">
                            <span className="font-mono text-xs text-red-400">{fmt(contract.salaryPerYear)}</span>
                            <span className="font-mono text-[10px] text-cream-dim/30 ml-1">({ratio.toFixed(1)}x)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </Panel>
          </div>
        </div>
      )}

      {viewMode === 'league' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* League payroll bar chart */}
          <Panel title="League Payrolls">
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {leaguePayrolls.map(({ team, payroll, isUser }, i) => (
                <div key={team.id} className={cn(
                  'flex items-center gap-3',
                  isUser && 'bg-gold/5 rounded-lg px-2 py-1 border border-gold/20',
                )}>
                  <span className="font-mono text-[10px] text-cream-dim/40 w-4 text-right">{i + 1}</span>
                  <span className={cn('font-body text-xs w-20 truncate', isUser ? 'text-gold font-semibold' : 'text-cream')}>
                    {team.abbreviation}
                  </span>
                  <div className="flex-1 h-2 bg-navy-lighter rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        isUser ? 'bg-gold/80' :
                        payroll > LUXURY_TAX ? 'bg-red-500/50' :
                        payroll > SOFT_CAP ? 'bg-gold/30' : 'bg-cream-dim/20',
                      )}
                      style={{ width: `${pct(payroll, leaguePayrolls[0].payroll * 1.1)}%` }}
                    />
                  </div>
                  <span className={cn('font-mono text-xs', isUser ? 'text-gold' : 'text-cream-dim/60')}>
                    {fmt(payroll)}
                  </span>
                  {payroll > LUXURY_TAX && (
                    <span className="font-mono text-[9px] text-red-400">LUX</span>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          {/* League stats */}
          <div className="space-y-4">
            <Panel title="League Payroll Stats">
              {(() => {
                const payrolls = leaguePayrolls.map(l => l.payroll);
                const avg = payrolls.reduce((s, v) => s + v, 0) / payrolls.length;
                const max = Math.max(...payrolls);
                const min = Math.min(...payrolls);
                const rank = leaguePayrolls.findIndex(l => l.isUser) + 1;
                const aboveLuxCount = leaguePayrolls.filter(l => l.payroll > LUXURY_TAX).length;
                return (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Your Rank', val: `#${rank} / ${leaguePayrolls.length}`, color: rank <= 10 ? 'text-gold' : 'text-cream' },
                      { label: 'League Avg', val: fmt(avg), color: 'text-cream' },
                      { label: 'Highest', val: fmt(max), color: 'text-red-400' },
                      { label: 'Lowest', val: fmt(min), color: 'text-green-light' },
                      { label: 'Above Lux Tax', val: `${aboveLuxCount} teams`, color: aboveLuxCount > 0 ? 'text-red-400' : 'text-cream-dim' },
                      { label: 'Vs. Avg', val: totalPayroll >= avg ? `+${fmt(totalPayroll - avg)}` : `-${fmt(avg - totalPayroll)}`, color: totalPayroll >= avg ? 'text-gold' : 'text-cream-dim' },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="p-3 bg-navy-lighter/20 rounded-lg">
                        <p className="font-mono text-[10px] text-cream-dim/40 uppercase">{label}</p>
                        <p className={cn('font-mono text-sm font-bold', color)}>{val}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Panel>

            <Panel title="Luxury Tax Summary">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-cream-dim/50">Your payroll</span>
                  <span className={cn('font-mono text-sm font-bold', aboveLuxury ? 'text-red-400' : 'text-gold')}>
                    {fmt(totalPayroll)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-cream-dim/50">Luxury threshold</span>
                  <span className="font-mono text-sm text-cream-dim">{fmt(LUXURY_TAX)}</span>
                </div>
                <div className="w-full h-px bg-navy-lighter/50" />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-cream-dim/50">
                    {aboveLuxury ? 'Tax bill (50% of overage)' : 'Cap space remaining'}
                  </span>
                  <span className={cn('font-mono text-sm font-bold', aboveLuxury ? 'text-red-400' : 'text-green-light')}>
                    {aboveLuxury
                      ? fmt(Math.round((totalPayroll - LUXURY_TAX) * 0.5))
                      : fmt(capSpace)}
                  </span>
                </div>
                {aboveLuxury && (
                  <p className="font-mono text-[10px] text-red-400/60 mt-2">
                    ⚠ You are {fmt(totalPayroll - LUXURY_TAX)} over the luxury tax threshold.
                    Consider trading high-salary veterans to avoid the tax penalty.
                  </p>
                )}
                {!aboveLuxury && capSpace < 20_000 && (
                  <p className="font-mono text-[10px] text-gold/60 mt-2">
                    You have {fmt(capSpace)} before hitting the luxury tax. Room for 1-2 more signings.
                  </p>
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* Extension modal */}
      {extendPlayer && (
        <ExtensionModal
          player={extendPlayer.player}
          contract={extendPlayer.contract}
          teamId={userTeamId}
          onClose={() => setExtendPlayer(null)}
          onSign={handleSignExtension}
        />
      )}
    </div>
  );
}
