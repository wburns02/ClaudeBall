import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';

// ── Event type categories ─────────────────────────────────────────────────────

type TxCategory = 'all' | 'trades' | 'injuries' | 'callups' | 'waivers';

interface TxEvent {
  id: string;
  day: number;
  category: Exclude<TxCategory, 'all'>;
  teamId: string;
  teamAbbr: string;
  headline: string;
  detail: string;
  isUserTeam: boolean;
  icon: string;
}

const CATEGORY_META: Record<Exclude<TxCategory, 'all'>, { label: string; color: string; bg: string; border: string }> = {
  trades:   { label: 'Trades',   color: 'text-blue-400',    bg: 'bg-blue-900/15',   border: 'border-blue-400/25'  },
  injuries: { label: 'Injuries', color: 'text-red-400',     bg: 'bg-red-900/15',    border: 'border-red-400/25'   },
  callups:  { label: 'Rosters',  color: 'text-green-light', bg: 'bg-green-900/15',  border: 'border-green-light/25' },
  waivers:  { label: 'Waivers',  color: 'text-orange-400',  bg: 'bg-orange-900/15', border: 'border-orange-400/25' },
};

// ── Badge chip ────────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: Exclude<TxCategory, 'all'> }) {
  const m = CATEGORY_META[category];
  return (
    <span className={cn(
      'inline-flex items-center font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
      m.color, m.border, m.bg,
    )}>
      {m.label}
    </span>
  );
}

// ── Event row ─────────────────────────────────────────────────────────────────

function TxRow({ event }: { event: TxEvent }) {
  const meta = CATEGORY_META[event.category];
  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3 border-b border-navy-lighter/20 last:border-0 transition-colors',
      event.isUserTeam ? 'bg-gold/3 hover:bg-gold/6' : 'hover:bg-navy-lighter/10',
    )}>
      {/* Icon */}
      <span className="text-base shrink-0 mt-0.5 select-none">{event.icon}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <CategoryBadge category={event.category} />
          <span className={cn(
            'font-mono text-[10px] font-bold uppercase tracking-wider shrink-0',
            event.isUserTeam ? 'text-gold' : 'text-cream-dim/60',
          )}>
            {event.teamAbbr}
          </span>
          <span className="font-mono text-[10px] text-cream-dim/40 shrink-0 ml-auto">Day {event.day}</span>
        </div>
        <p className={cn(
          'font-body text-sm leading-snug',
          event.isUserTeam ? 'text-cream' : 'text-cream/80',
        )}>
          {event.headline}
        </p>
        {event.detail && (
          <p className="font-mono text-xs text-cream-dim/60 mt-0.5 leading-snug">{event.detail}</p>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const ICONS: Record<string, string> = {
  trades:   '🔄',
  injuries: '🩹',
  callups:  '⬆',
  waivers:  '📋',
};

export function TransactionsPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId, tradeLog, callupLog, injuryLog, waiverLog, userTradeLog } = useFranchiseStore();

  const [category, setCategory] = useState<TxCategory>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [dayRange, setDayRange] = useState<number>(30); // show last N days

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Transactions</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          A live feed of every trade, signing, injury, callup, and waiver move across the league.
        </p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const currentDay = season.currentDay;

  // Build team abbreviation map
  const teamMap = useMemo(() => {
    const map = new Map<string, { abbr: string; name: string }>();
    for (const team of engine.getAllTeams()) {
      map.set(team.id, { abbr: team.abbreviation, name: `${team.city} ${team.name}` });
    }
    return map;
  }, [engine]);

  const getTeamAbbr = (id: string) => teamMap.get(id)?.abbr ?? id.slice(0, 3).toUpperCase();
  const getTeamName = (id: string) => teamMap.get(id)?.name ?? id;

  // Build unified event list
  const allEvents = useMemo((): TxEvent[] => {
    const events: TxEvent[] = [];

    // Trades
    for (const t of tradeLog) {
      const isUser = t.buyerTeamId === userTeamId || t.sellerTeamId === userTeamId;
      const buyers = t.playersToBuyer.join(', ') || '(prospects)';
      const sellers = t.playersToSeller.join(', ') || '(prospects)';
      events.push({
        id: `trade-${t.day}-${t.buyerTeamId}`,
        day: t.day,
        category: 'trades',
        teamId: t.buyerTeamId,
        teamAbbr: getTeamAbbr(t.buyerTeamId),
        headline: `${getTeamName(t.buyerTeamId)} acquire ${buyers} from ${getTeamName(t.sellerTeamId)}`,
        detail: sellers !== '(prospects)' ? `${getTeamName(t.sellerTeamId)} receive: ${sellers}` : '',
        isUserTeam: isUser,
        icon: ICONS.trades,
      });
    }

    // User's trade log (string descriptions)
    userTradeLog.forEach((desc, i) => {
      events.push({
        id: `user-trade-${i}`,
        day: currentDay,
        category: 'trades',
        teamId: userTeamId,
        teamAbbr: getTeamAbbr(userTeamId),
        headline: desc,
        detail: '',
        isUserTeam: true,
        icon: ICONS.trades,
      });
    });

    // Injuries
    for (const inj of injuryLog) {
      const isUser = inj.teamId === userTeamId;
      const severity = inj.severity === 'minor' ? 'Day-to-day' : inj.severity === 'moderate' ? `Out ${inj.daysOut}d` : `Season-ending`;
      events.push({
        id: `inj-${inj.playerId}-${inj.dayOccurred}`,
        day: inj.dayOccurred,
        category: 'injuries',
        teamId: inj.teamId,
        teamAbbr: getTeamAbbr(inj.teamId),
        headline: inj.returned
          ? `${inj.playerName} (${getTeamAbbr(inj.teamId)}) returns from ${inj.severity} injury`
          : `${inj.playerName} (${getTeamAbbr(inj.teamId)}) placed on IL — ${inj.description}`,
        detail: inj.returned ? '' : severity,
        isUserTeam: isUser,
        icon: inj.returned ? '✅' : ICONS.injuries,
      });
    }

    // Callups & Optionals
    for (let i = 0; i < callupLog.length; i++) {
      const c = callupLog[i];
      const isUser = c.teamId === userTeamId;
      events.push({
        id: `callup-${i}-${c.player.id}`,
        day: currentDay, // callups don't always have a day, approximate
        category: 'callups',
        teamId: c.teamId,
        teamAbbr: getTeamAbbr(c.teamId),
        headline: c.message,
        detail: `${c.player.position} · Age ${c.player.age}`,
        isUserTeam: isUser,
        icon: c.type === 'callup' ? '⬆' : '⬇',
      });
    }

    // Waivers
    for (let i = 0; i < waiverLog.length; i++) {
      const w = waiverLog[i];
      const isUser = w.teamId === userTeamId;
      events.push({
        id: `waiver-${i}-${w.player.id}`,
        day: currentDay,
        category: 'waivers',
        teamId: w.teamId,
        teamAbbr: getTeamAbbr(w.teamId),
        headline: w.message,
        detail: `${w.player.position} · Age ${w.player.age}`,
        isUserTeam: isUser,
        icon: ICONS.waivers,
      });
    }

    // Sort newest first (by day desc, then by array order)
    return events.sort((a, b) => b.day - a.day || 0);
  }, [tradeLog, callupLog, injuryLog, waiverLog, userTradeLog, userTeamId, currentDay]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter(e => {
      if (category !== 'all' && e.category !== category) return false;
      if (teamFilter !== 'all' && e.teamId !== teamFilter) return false;
      if (dayRange < 999 && e.day < currentDay - dayRange) return false;
      return true;
    });
  }, [allEvents, category, teamFilter, dayRange, currentDay]);

  // Count by category
  const counts = useMemo(() => {
    const c = { trades: 0, injuries: 0, callups: 0, waivers: 0, all: allEvents.length };
    for (const e of allEvents) c[e.category]++;
    return c;
  }, [allEvents]);

  // User team events
  const userEvents = allEvents.filter(e => e.isUserTeam);

  // Get unique teams that have events
  const teamsWithEvents = useMemo(() => {
    const ids = new Set(allEvents.map(e => e.teamId));
    return Array.from(ids)
      .map(id => ({ id, abbr: getTeamAbbr(id) }))
      .sort((a, b) => a.abbr.localeCompare(b.abbr));
  }, [allEvents]);

  const RANGE_OPTIONS = [
    { value: 1, label: 'Today' },
    { value: 7, label: 'Last 7d' },
    { value: 30, label: 'Last 30d' },
    { value: 999, label: 'All Season' },
  ];

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Transactions</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            Day {currentDay} · {allEvents.length} moves this season
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/news')}>League News</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(Object.entries(CATEGORY_META) as [Exclude<TxCategory, 'all'>, typeof CATEGORY_META[keyof typeof CATEGORY_META]][]).map(([cat, meta]) => (
          <button
            key={cat}
            onClick={() => setCategory(category === cat ? 'all' : cat)}
            className={cn(
              'rounded-lg border px-4 py-3 text-center transition-all cursor-pointer',
              category === cat
                ? cn('border-opacity-80', meta.border, meta.bg)
                : 'border-navy-lighter/40 bg-navy-light hover:border-navy-lighter/80',
            )}
          >
            <p className={cn('font-display text-2xl font-bold', category === cat ? meta.color : 'text-cream')}>
              {counts[cat]}
            </p>
            <p className="font-mono text-xs text-cream-dim mt-0.5">{meta.label}</p>
          </button>
        ))}
      </div>

      {/* Your team highlight (if has events) */}
      {userEvents.length > 0 && (
        <div className="mb-4 rounded-lg border border-gold/30 bg-gold/5 px-4 py-2.5">
          <p className="font-mono text-xs text-gold/70 uppercase tracking-wider mb-1">
            {getTeamAbbr(userTeamId)} — {userEvents.length} transaction{userEvents.length !== 1 ? 's' : ''} this season
          </p>
          <div className="flex gap-4">
            {(['trades', 'injuries', 'callups', 'waivers'] as const).map(cat => {
              const n = userEvents.filter(e => e.category === cat).length;
              if (n === 0) return null;
              return (
                <span key={cat} className={cn('font-mono text-xs', CATEGORY_META[cat].color)}>
                  {n} {n === 1 ? { trades: 'Trade', injuries: 'Injury', callups: 'Roster', waivers: 'Waiver' }[cat] : CATEGORY_META[cat].label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Category filter */}
        <div className="flex gap-1 rounded-lg border border-navy-lighter/40 p-1 bg-navy-light">
          {(['all', 'trades', 'injuries', 'callups', 'waivers'] as TxCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-2.5 py-1 rounded-md font-mono text-xs transition-all cursor-pointer',
                category === cat
                  ? 'bg-gold/15 text-gold border border-gold/40'
                  : 'text-cream-dim hover:text-cream',
              )}
            >
              {cat === 'all' ? `All (${counts.all})` : `${CATEGORY_META[cat].label} (${counts[cat]})`}
            </button>
          ))}
        </div>

        {/* Date range filter */}
        <div className="flex gap-1 rounded-lg border border-navy-lighter/40 p-1 bg-navy-light">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDayRange(opt.value)}
              className={cn(
                'px-2.5 py-1 rounded-md font-mono text-xs transition-all cursor-pointer',
                dayRange === opt.value
                  ? 'bg-gold/15 text-gold border border-gold/40'
                  : 'text-cream-dim hover:text-cream',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Team filter */}
        {teamsWithEvents.length > 1 && (
          <select
            value={teamFilter}
            onChange={e => setTeamFilter(e.target.value)}
            className="rounded-lg border border-navy-lighter/40 bg-navy-light px-3 py-1 font-mono text-xs text-cream-dim cursor-pointer focus:outline-none focus:border-gold/40"
          >
            <option value="all">All Teams</option>
            <option value={userTeamId}>{getTeamAbbr(userTeamId)} (My Team)</option>
            {teamsWithEvents.filter(t => t.id !== userTeamId).map(t => (
              <option key={t.id} value={t.id}>{t.abbr}</option>
            ))}
          </select>
        )}
      </div>

      {/* Event feed */}
      {filteredEvents.length === 0 ? (
        <Panel>
          <div className="text-center py-12">
            <p className="font-display text-gold text-xl mb-2">
              {allEvents.length === 0 ? 'No Transactions Yet' : 'No Matching Transactions'}
            </p>
            <p className="font-mono text-cream-dim text-sm">
              {allEvents.length === 0
                ? 'Simulate games to see trades, injuries, and roster moves appear here.'
                : 'Try adjusting the filters above.'}
            </p>
            {allEvents.length === 0 && (
              <Button className="mt-4" onClick={() => navigate('/franchise')}>
                Go Sim Some Days
              </Button>
            )}
          </div>
        </Panel>
      ) : (
        <Panel title={`${filteredEvents.length} Transaction${filteredEvents.length !== 1 ? 's' : ''}`}>
          <div className="divide-y divide-navy-lighter/20 -mx-4 -mb-4">
            {filteredEvents.map(event => (
              <TxRow key={event.id} event={event} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
