import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';

const DEADLINE_DAY = 120;

export function TradeHistoryPage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId, userTradeLog, getAITradeLog, isTradeDeadlinePassed } = useFranchiseStore();

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Trade History</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">Review all trades made this season — both your moves and AI team transactions.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const currentDay = season.currentDay;
  const deadlinePassed = isTradeDeadlinePassed();
  const aiTrades = getAITradeLog();
  const daysToDeadline = Math.max(0, DEADLINE_DAY - currentDay);
  const totalTrades = aiTrades.length + userTradeLog.length;

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Trade History</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            Day {currentDay} · {totalTrades} total trades this season
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/trade')}>Trade Center</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      {/* Deadline Banner */}
      <div className={cn(
        'mb-6 px-4 py-3 rounded-lg border flex items-center justify-between',
        deadlinePassed
          ? 'bg-red-950/20 border-red-700/30'
          : daysToDeadline <= 10
          ? 'bg-orange-950/20 border-orange-600/30'
          : 'bg-navy-light border-navy-lighter',
      )}>
        <div>
          <span className={cn(
            'font-display text-lg font-bold uppercase',
            deadlinePassed ? 'text-red-400' : daysToDeadline <= 10 ? 'text-orange-400' : 'text-cream',
          )}>
            {deadlinePassed ? 'Trade Deadline Passed' : 'Trade Deadline: Day 120'}
          </span>
          {!deadlinePassed && (
            <p className="font-mono text-xs text-cream-dim mt-0.5">
              {daysToDeadline} days remaining — after Day 120, no trades allowed
            </p>
          )}
        </div>
        <div className={cn(
          'font-mono text-2xl font-bold',
          deadlinePassed ? 'text-red-400' : daysToDeadline <= 10 ? 'text-orange-400' : 'text-cream-dim',
        )}>
          {deadlinePassed ? 'CLOSED' : `Day ${currentDay}/${DEADLINE_DAY}`}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI Trades */}
        <Panel title={`AI-to-AI Trades (${aiTrades.length})`}>
          <p className="font-mono text-xs text-cream-dim mb-3">
            Trades between CPU-controlled teams
          </p>
          {aiTrades.length === 0 ? (
            <div className="text-center py-6">
              <p className="font-mono text-cream-dim">No AI trades yet this season.</p>
              <p className="font-mono text-xs text-cream-dim/60 mt-1">
                Contenders acquire veterans; sellers get prospects.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {[...aiTrades].reverse().map((trade, i) => (
                <div
                  key={i}
                  className="bg-navy-lighter/20 border border-navy-lighter/40 rounded-lg px-3 py-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-cream-dim">Day {trade.day}</span>
                    <span className="font-mono text-xs text-gold">Trade</span>
                  </div>
                  <p className="font-body text-sm text-cream leading-snug">{trade.description}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <p className="font-mono text-xs text-cream-dim mb-1">
                        {trade.buyerTeamName} ACQUIRE:
                      </p>
                      {trade.playersToBuyer.map((name, j) => (
                        <span key={j} className="block font-mono text-xs text-cream">{name}</span>
                      ))}
                    </div>
                    <div>
                      <p className="font-mono text-xs text-cream-dim mb-1">
                        {trade.sellerTeamName} RECEIVE:
                      </p>
                      {trade.playersToSeller.map((name, j) => (
                        <span key={j} className="block font-mono text-xs text-cream">{name}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* User Trades */}
        <Panel title={`Your Trades (${userTradeLog.length})`}>
          <p className="font-mono text-xs text-cream-dim mb-3">
            Trades you've made this season
          </p>
          {userTradeLog.length === 0 ? (
            <div className="text-center py-6">
              <p className="font-mono text-cream-dim">You haven't made any trades yet.</p>
              {!deadlinePassed && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate('/franchise/trade')}
                >
                  Go to Trade Center
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {userTradeLog.map((log, i) => (
                <div
                  key={i}
                  className="bg-gold/5 border border-gold/20 rounded-md px-3 py-2"
                >
                  <p className="font-body text-sm text-cream">{log}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Trade timeline */}
        <Panel title="Season Trade Volume">
          <p className="font-mono text-xs text-cream-dim mb-4">
            AI trades by day (deadline day 120)
          </p>
          {aiTrades.length === 0 ? (
            <p className="font-mono text-cream-dim text-sm text-center py-4">
              No trades to display
            </p>
          ) : (
            <div className="relative">
              {/* Timeline bars */}
              <div className="flex items-end gap-0.5 h-20">
                {Array.from({ length: 12 }, (_, i) => {
                  const startDay = i * 10 + 1;
                  const endDay = (i + 1) * 10;
                  const count = aiTrades.filter(t => t.day >= startDay && t.day <= endDay).length;
                  const maxCount = Math.max(...Array.from({ length: 12 }, (_, j) => {
                    const s = j * 10 + 1;
                    const e = (j + 1) * 10;
                    return aiTrades.filter(t => t.day >= s && t.day <= e).length;
                  }), 1);
                  const pct = (count / maxCount) * 100;
                  const isPast = currentDay > endDay;
                  const isDeadlineZone = endDay > 100 && endDay <= 120;

                  return (
                    <div key={i} className="flex flex-col items-center flex-1" title={`Days ${startDay}-${endDay}: ${count} trades`}>
                      <div className="w-full flex flex-col justify-end" style={{ height: '72px' }}>
                        <div
                          className={cn(
                            'w-full rounded-t-sm transition-all',
                            isPast ? 'opacity-100' : 'opacity-40',
                            isDeadlineZone ? 'bg-orange-500' : 'bg-gold/60',
                          )}
                          style={{ height: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[9px] text-cream-dim/60 mt-1">
                        {startDay}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>

        {/* Active contenders and sellers summary */}
        <Panel title="Contender / Seller Status">
          <p className="font-mono text-xs text-cream-dim mb-3">
            Teams classified by win% (updates each day)
          </p>
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {engine.getAllTeams()
              .map(team => {
                const rec = season.standings.getRecord(team.id);
                if (!rec) return null;
                const total = rec.wins + rec.losses;
                if (total === 0) return { team, pct: 0.5, status: 'TBD' };
                const pct = rec.wins / total;
                const status = pct >= 0.52 ? 'Contender' : pct <= 0.45 ? 'Seller' : 'Middle';
                return { team, pct, status, rec };
              })
              .filter(Boolean)
              .sort((a, b) => (b?.pct ?? 0) - (a?.pct ?? 0))
              .map((item, i) => {
                if (!item) return null;
                const { team, pct, status, rec } = item;
                const isUser = team.id === userTeamId;
                return (
                  <div key={i} className={cn(
                    'flex items-center justify-between px-3 py-1.5 rounded-md',
                    isUser ? 'bg-gold/10 border border-gold/30' : 'bg-navy-lighter/10',
                  )}>
                    <span className={cn('font-body text-sm', isUser ? 'text-gold' : 'text-cream')}>
                      {team.city} {team.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-cream-dim">
                        {rec ? `${rec.wins}-${rec.losses}` : '—'}
                      </span>
                      <span className={cn(
                        'font-mono text-xs font-bold',
                        status === 'Contender' ? 'text-green-light' :
                        status === 'Seller' ? 'text-red-400' :
                        'text-cream-dim',
                      )}>
                        {status}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
