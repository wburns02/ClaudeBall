import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';

const TRADE_DEADLINE_DAY = 120;
const CONTENDER_PCT = 0.52;
const SELLER_PCT = 0.45;

// ── Countdown ring ──────────────────────────────────────────────
function CountdownRing({ daysLeft, total }: { daysLeft: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (daysLeft / total) * 100));
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const color = daysLeft <= 3 ? '#ef4444' : daysLeft <= 10 ? '#f59e0b' : '#d4a843';

  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold" style={{ color }}>
          {daysLeft}
        </span>
        <span className="font-mono text-[9px] text-cream-dim/60 uppercase tracking-widest">
          {daysLeft === 1 ? 'day left' : 'days left'}
        </span>
      </div>
    </div>
  );
}

// ── Team tag ────────────────────────────────────────────────────
function TeamTag({ name, abbr, pct, type }: { name: string; abbr: string; pct: number; type: 'buyer' | 'seller' | 'neutral' }) {
  const colors = {
    buyer: { bg: 'bg-green-900/20', border: 'border-green-light/30', text: 'text-green-light' },
    seller: { bg: 'bg-red-900/20', border: 'border-red-400/30', text: 'text-red-400' },
    neutral: { bg: 'bg-navy-lighter/20', border: 'border-navy-lighter/40', text: 'text-cream-dim' },
  };
  const c = colors[type];
  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md border', c.bg, c.border)}>
      <span className={cn('font-mono text-xs font-bold', c.text)}>{abbr}</span>
      <span className="font-body text-xs text-cream truncate flex-1">{name}</span>
      <span className="font-mono text-[10px] text-cream-dim">.{Math.round(pct * 1000)}</span>
    </div>
  );
}

// ── Trade record card ───────────────────────────────────────────
function TradeCard({ trade, isNew }: { trade: { day: number; sellerTeamName: string; buyerTeamName: string; playersToBuyer: string[]; playersToSeller: string[]; description: string }; isNew?: boolean }) {
  return (
    <div className={cn(
      'rounded-lg border px-4 py-3 transition-all',
      isNew ? 'border-gold/40 bg-gold/5 animate-pulse' : 'border-navy-lighter/30 bg-navy-lighter/10',
    )}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-body text-sm text-cream font-medium">{trade.description}</p>
        <span className="font-mono text-[10px] text-cream-dim/50 shrink-0">Day {trade.day}</span>
      </div>
      <div className="flex gap-4 mt-2">
        <div className="flex-1">
          <p className="font-mono text-[9px] text-green-light/70 uppercase tracking-wider mb-0.5">To {trade.buyerTeamName}</p>
          {trade.playersToBuyer.map((p, i) => (
            <p key={i} className="font-mono text-xs text-cream">{p}</p>
          ))}
        </div>
        <div className="w-px bg-navy-lighter/30" />
        <div className="flex-1">
          <p className="font-mono text-[9px] text-red-400/70 uppercase tracking-wider mb-0.5">To {trade.sellerTeamName}</p>
          {trade.playersToSeller.map((p, i) => (
            <p key={i} className="font-mono text-xs text-cream">{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export function TradeDeadlinePage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId, tradeLog } = useFranchiseStore();

  const team = useMemo(() => {
    if (!engine || !userTeamId) return null;
    return engine.getTeam(userTeamId) ?? null;
  }, [engine, userTeamId]);

  if (!team || !season || !engine) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="font-display text-gold text-xl">Trade Deadline</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          Track the countdown to the trade deadline, analyze buyer and seller teams, and watch the hot stove heat up.
        </p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const currentDay = season.currentDay;
  const daysLeft = Math.max(0, TRADE_DEADLINE_DAY - currentDay);
  const deadlinePassed = currentDay > TRADE_DEADLINE_DAY;
  const isDeadlineWeek = daysLeft <= 7 && daysLeft > 0;
  const isDeadlineDay = daysLeft === 0 && currentDay === TRADE_DEADLINE_DAY;

  // Team analysis — classify as buyer, seller, or neutral
  const teamAnalysis = useMemo(() => {
    const allTeams = engine.getAllTeams();
    const standings = season.standings;
    const results: { id: string; name: string; city: string; abbr: string; pct: number; type: 'buyer' | 'seller' | 'neutral' }[] = [];

    for (const t of allTeams) {
      const record = standings.getRecord(t.id);
      const pct = record ? record.wins / Math.max(1, record.wins + record.losses) : 0.5;
      const type = pct >= CONTENDER_PCT ? 'buyer' : pct <= SELLER_PCT ? 'seller' : 'neutral';
      results.push({ id: t.id, name: t.name, city: t.city, abbr: t.abbreviation, pct, type });
    }

    return results.sort((a, b) => b.pct - a.pct);
  }, [engine, season.standings]);

  const buyers = teamAnalysis.filter(t => t.type === 'buyer');
  const sellers = teamAnalysis.filter(t => t.type === 'seller');
  const userAnalysis = teamAnalysis.find(t => t.id === userTeamId);

  // Available targets — high-OVR players on selling teams
  const availableTargets = useMemo(() => {
    const targets: { name: string; pos: string; ovr: number; team: string; teamAbbr: string }[] = [];
    const sellerIds = new Set(sellers.map(s => s.id));

    for (const t of engine.getAllTeams()) {
      if (!sellerIds.has(t.id) || t.id === userTeamId) continue;
      for (const p of t.roster.players) {
        const ovr = Math.round(evaluatePlayer(p));
        if (ovr >= 60) {
          targets.push({
            name: getPlayerName(p),
            pos: p.position,
            ovr,
            team: `${t.city} ${t.name}`,
            teamAbbr: t.abbreviation,
          });
        }
      }
    }

    return targets.sort((a, b) => b.ovr - a.ovr).slice(0, 15);
  }, [engine, sellers, userTeamId]);

  // Recent trades (last 14 days)
  const recentTrades = useMemo(() => {
    return tradeLog
      .filter(t => t.day >= currentDay - 14)
      .sort((a, b) => b.day - a.day)
      .slice(0, 10);
  }, [tradeLog, currentDay]);

  // Deadline urgency banner
  const urgencyMessage = deadlinePassed
    ? 'The trade deadline has passed. No more trades until the offseason.'
    : isDeadlineDay
    ? 'DEADLINE DAY! Trades are flying — make your move before midnight!'
    : isDeadlineWeek
    ? `Only ${daysLeft} day${daysLeft !== 1 ? 's' : ''} until the trade deadline. The hot stove is heating up!`
    : daysLeft <= 30
    ? `${daysLeft} days to make a move. Contenders are getting aggressive.`
    : `${daysLeft} days until the trade deadline. Season still young.`;

  const urgencyColor = deadlinePassed ? 'border-cream-dim/20' : isDeadlineDay ? 'border-red-500/60 bg-red-900/10' : isDeadlineWeek ? 'border-gold/50 bg-gold/5' : 'border-navy-lighter/40';

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Trade Deadline</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {team.city} {team.name} · Day {currentDay} of {season.totalDays} · Deadline: Day {TRADE_DEADLINE_DAY}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/trade')}>Trade Center</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      {/* Urgency Banner */}
      <div className={cn('rounded-xl border-2 px-6 py-4 text-center', urgencyColor)}>
        <p className="font-mono text-sm text-cream">{urgencyMessage}</p>
      </div>

      {/* Top Row: Countdown + Your Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Countdown */}
        <Panel title="Countdown">
          <div className="flex flex-col items-center py-2">
            {deadlinePassed ? (
              <div className="text-center py-4">
                <p className="font-display text-2xl text-cream-dim">Deadline Passed</p>
                <p className="font-mono text-xs text-cream-dim/50 mt-1">Day {TRADE_DEADLINE_DAY}</p>
              </div>
            ) : (
              <CountdownRing daysLeft={daysLeft} total={TRADE_DEADLINE_DAY} />
            )}
            <p className="font-mono text-[10px] text-cream-dim/40 mt-2">
              {deadlinePassed ? 'Trading window closed' : `Trade deadline: Day ${TRADE_DEADLINE_DAY}`}
            </p>
          </div>
        </Panel>

        {/* Your Team Status */}
        <Panel title="Your Status">
          <div className="space-y-3 py-1">
            <div className="text-center">
              <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider">Market Position</p>
              <p className={cn(
                'font-display text-2xl uppercase tracking-wide mt-1',
                userAnalysis?.type === 'buyer' ? 'text-green-light' :
                userAnalysis?.type === 'seller' ? 'text-red-400' : 'text-cream',
              )}>
                {userAnalysis?.type === 'buyer' ? 'Buyer' :
                 userAnalysis?.type === 'seller' ? 'Seller' : 'On the Fence'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-md bg-navy-lighter/20 py-2">
                <p className="font-mono text-lg font-bold text-cream">{season.standings.getRecord(userTeamId!)?.wins ?? 0}</p>
                <p className="font-mono text-[9px] text-cream-dim/50">Wins</p>
              </div>
              <div className="rounded-md bg-navy-lighter/20 py-2">
                <p className="font-mono text-lg font-bold text-cream">{season.standings.getRecord(userTeamId!)?.losses ?? 0}</p>
                <p className="font-mono text-[9px] text-cream-dim/50">Losses</p>
              </div>
            </div>
            {!deadlinePassed && userAnalysis?.type === 'seller' && (
              <p className="font-mono text-[10px] text-red-400/60 text-center mb-1">
                Consider shopping your high-OVR veterans for prospects
              </p>
            )}
            {!deadlinePassed && userAnalysis?.type === 'buyer' && (
              <p className="font-mono text-[10px] text-green-light/60 text-center mb-1">
                Target pitching or hitting upgrades from selling teams
              </p>
            )}
            {!deadlinePassed && userAnalysis?.type === 'neutral' && (
              <p className="font-mono text-[10px] text-cream-dim/50 text-center mb-1">
                Evaluate your roster — buy a piece to contend, or sell and rebuild?
              </p>
            )}
            <div className="flex gap-2 justify-center">
              {!deadlinePassed && (
                <Button size="sm" variant="primary" onClick={() => navigate('/franchise/trade')}>
                  {userAnalysis?.type === 'seller' ? 'Shop Veterans' : userAnalysis?.type === 'buyer' ? 'Add Talent' : 'Make a Trade'}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => navigate('/franchise/trade-machine')}>
                Trade Machine
              </Button>
            </div>
          </div>
        </Panel>

        {/* Trade Activity */}
        <Panel title="Season Trade Activity">
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-md bg-navy-lighter/20 py-2">
                <p className="font-display text-2xl font-bold text-gold">{tradeLog.length}</p>
                <p className="font-mono text-[9px] text-cream-dim/50">Total Trades</p>
              </div>
              <div className="rounded-md bg-navy-lighter/20 py-2">
                <p className="font-display text-2xl font-bold text-cream">{recentTrades.length}</p>
                <p className="font-mono text-[9px] text-cream-dim/50">Last 14 Days</p>
              </div>
            </div>
            <div className="text-center">
              <p className="font-mono text-[10px] text-cream-dim/40">
                {deadlinePassed
                  ? 'No more trades this season'
                  : tradeLog.length === 0
                  ? 'No trades yet — activity picks up near deadline'
                  : `Last trade: Day ${tradeLog[tradeLog.length - 1]?.day}`}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Buyer/Seller Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title={`Buyers (${buyers.length})`}>
          <p className="font-mono text-[10px] text-cream-dim/40 mb-2">Contenders looking to add for a playoff push</p>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {buyers.length === 0 ? (
              <p className="font-mono text-xs text-cream-dim/30 text-center py-4">No clear buyers yet</p>
            ) : buyers.map(t => (
              <TeamTag key={t.id} name={`${t.city} ${t.name}`} abbr={t.abbr} pct={t.pct} type="buyer" />
            ))}
          </div>
        </Panel>

        <Panel title={`Sellers (${sellers.length})`}>
          <p className="font-mono text-[10px] text-cream-dim/40 mb-2">Rebuilders looking to move veterans for prospects</p>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {sellers.length === 0 ? (
              <p className="font-mono text-xs text-cream-dim/30 text-center py-4">No clear sellers yet</p>
            ) : sellers.map(t => (
              <TeamTag key={t.id} name={`${t.city} ${t.name}`} abbr={t.abbr} pct={t.pct} type="seller" />
            ))}
          </div>
        </Panel>
      </div>

      {/* Available Targets */}
      {!deadlinePassed && availableTargets.length > 0 && (
        <Panel title="Available Targets">
          <p className="font-mono text-[10px] text-cream-dim/40 mb-3">Top players on selling teams — potential trade targets</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {availableTargets.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-navy-lighter/30 bg-navy-lighter/10 hover:border-gold/20 transition-colors"
              >
                <span className={cn(
                  'font-mono text-xs font-bold w-6 text-center',
                  t.ovr >= 75 ? 'text-gold' : t.ovr >= 65 ? 'text-green-light' : 'text-cream',
                )}>{t.ovr}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-xs text-cream truncate">{t.name}</p>
                  <p className="font-mono text-[9px] text-cream-dim/50">{t.pos} · {t.teamAbbr}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[10px] shrink-0"
                  onClick={() => navigate(`/franchise/trade-machine`)}
                >
                  Trade
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Recent Trades / Hot Stove */}
      <Panel title="Hot Stove Tracker">
        <p className="font-mono text-[10px] text-cream-dim/40 mb-3">Recent league-wide trade activity</p>
        {recentTrades.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-display text-cream-dim text-lg">Quiet on the trade front</p>
            <p className="font-mono text-cream-dim/40 text-xs mt-1">
              {currentDay < 60
                ? 'Trade activity typically picks up after day 60'
                : 'Teams are evaluating their rosters — deals coming soon'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTrades.map((trade, i) => (
              <TradeCard key={`${trade.day}-${i}`} trade={trade} isNew={trade.day === currentDay} />
            ))}
          </div>
        )}
      </Panel>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2 justify-center pb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/trade')}>Trade Center</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/trade-machine')}>Trade Machine</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/trade-proposals')}>Trade Proposals</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/trade-history')}>Trade History</Button>
      </div>
    </div>
  );
}
