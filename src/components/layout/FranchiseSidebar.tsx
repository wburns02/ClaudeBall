import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useInboxStore } from '@/stores/inboxStore.ts';
import { cn } from '@/lib/cn.ts';
import { winPct, streakStr } from '@/engine/season/index.ts';

// ── Icons (inline SVG paths) ─────────────────────────────────────────────────
const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
  >
    <path d={d} />
  </svg>
);

const Icons = {
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  roster: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 3a4 4 0 100 8 4 4 0 000-8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  playerEditor: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  createPlayer: 'M12 5v14 M5 12h14',
  teamEditor: 'M3 3h18v18H3z M9 3v18 M3 9h18',
  standings: 'M18 20V10 M12 20V4 M6 20v-6',
  leaders: 'M8.21 13.89L7 23l5-3 5 3-1.21-9.12 M12 2a4 4 0 100 8 4 4 0 000-8z',
  records: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  trades: 'M7 16V4m0 0L3 8m4-4l4 4 M17 8v12m0 0l4-4m-4 4l-4-4',
  freeAgency: 'M20 12V22H4V12 M22 7H2v5h20V7z M12 22V7 M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z',
  draft: 'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  rosterMgr: 'M4 6h16 M4 10h16 M4 14h16 M4 18h16',
  injuries: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10 M12 9v4 M12 15h.01',
  minors: 'M22 17a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2h4l2-3h4l2 3h4a2 2 0 012 2v8z',
  waivers: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  tradeHistory: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  playoffs: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  offseason: 'M17.5 19H9a7 7 0 1114 0z M17.5 19 M22 12h-4 M6 12H2 M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M19.07 4.93l-2.83 2.83 M7.76 16.24l-2.83 2.83',
  save: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z M17 21v-8H7v8 M7 3v5h8',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 000 2.32 1.65 1.65 0 001.82.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  customLeague: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z M8 12h8 M12 8v8',
  schedule: 'M8 2v4 M16 2v4 M3 10h18 M21 8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V8z',
  gameLog: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  allStar: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  awards: 'M8.21 13.89L7 23l5-3 5 3-1.21-9.12 M12 2a4 4 0 100 8 4 4 0 000-8z',
  tradeProposals: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  history: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  scouting: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z M10 10.5a.5.5 0 11-1 0 .5.5 0 011 0z',
  payroll: 'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  analytics: 'M3 3v18h18 M7 16l4-4 4 4 4-8',
  finances: 'M2 20h20 M5 20V10l7-8 7 8v10 M9 20v-5h6v5',
  lineup: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  development: 'M22 12h-4l-3 9L9 3l-3 9H2',
  training: 'M6.5 6.5a5.5 5.5 0 0111 0c0 4-5.5 8-5.5 8S6.5 10.5 6.5 6.5z M12 6.5h.01',
  inbox: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6',
  news: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2z M9 10h6 M9 14h4',
  teamStats: 'M3 3h18v18H3z M7 7h4v4H7z M13 7h4v4h-4z M7 13h4v4H7z M13 13h4v4h-4z',
  hotCold: 'M12 2a5 5 0 015 5c0 3-2 5-5 8-3-3-5-5-5-8a5 5 0 015-5z M12 22l2-4h-4l2 4z',
  goals: 'M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2',
  compare: 'M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3 M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3 M12 3v18',
  depthChart: 'M3 3h18v4H3z M3 10h8v4H3z M3 17h8v4H3z M14 10h7v11h-7z',
  warRoom: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18',
  scoreboard: 'M2 3h20v14H2z M8 21h8 M12 17v4',
  transactions: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2 M9 12h6 M9 16h4',
};

interface NavItem {
  label: string;
  /** Static path, or a function that resolves to a path given the userTeamId */
  path: string | ((userTeamId: string | null) => string);
  icon: keyof typeof Icons;
  /** Optional: used for active-path matching when path is dynamic */
  activePrefixes?: string[];
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'HOME',
    items: [
      { label: 'Dashboard', path: '/franchise', icon: 'home' },
      { label: 'GM Inbox', path: '/franchise/inbox', icon: 'inbox' },
      { label: 'League News', path: '/franchise/news', icon: 'news' },
    ],
  },
  {
    heading: 'TEAM',
    items: [
      { label: 'Roster', path: '/franchise/roster', icon: 'roster' },
      { label: 'Depth Chart', path: '/franchise/depth-chart', icon: 'depthChart' },
      { label: 'Development Hub', path: '/franchise/development', icon: 'development' },
      { label: 'Training Center', path: '/franchise/training', icon: 'training' },
      { label: 'Lineup Editor', path: '/franchise/lineup-editor', icon: 'lineup' },
      { label: 'Create Player', path: '/franchise/create-player', icon: 'createPlayer' },
      {
        label: 'Team Editor',
        path: (id) => id ? `/franchise/team/${id}` : '/franchise/roster',
        icon: 'teamEditor',
        activePrefixes: ['/franchise/team/'],
      },
    ],
  },
  {
    heading: 'LEAGUE',
    items: [
      { label: 'Standings', path: '/franchise/standings', icon: 'standings' },
      { label: 'Power Rankings', path: '/franchise/power-rankings', icon: 'records' },
      { label: 'Team Analytics', path: '/franchise/team-analytics', icon: 'analytics' },
      { label: 'Leaders', path: '/franchise/leaders', icon: 'leaders' },
      { label: 'Compare Players', path: '/franchise/compare', icon: 'compare' },
      { label: 'Records', path: '/franchise/records', icon: 'records' },
      {
        label: 'Team Stats',
        path: (id) => id ? `/franchise/team-stats/${id}` : '/franchise/standings',
        icon: 'teamStats',
        activePrefixes: ['/franchise/team-stats/'],
      },
    ],
  },
  {
    heading: 'GM',
    items: [
      { label: 'GM War Room', path: '/franchise/war-room', icon: 'warRoom' },
      { label: 'Scouting Hub', path: '/franchise/scouting', icon: 'scouting' },
      { label: 'Finances', path: '/franchise/finances', icon: 'finances' },
      { label: 'Payroll', path: '/franchise/payroll', icon: 'payroll' },
      { label: 'Trades', path: '/franchise/trade', icon: 'trades' },
      { label: 'Free Agency', path: '/franchise/free-agency', icon: 'freeAgency' },
      { label: 'Draft', path: '/franchise/draft', icon: 'draft' },
      { label: 'Roster Manager', path: '/franchise/roster-manager', icon: 'rosterMgr' },
    ],
  },
  {
    heading: 'GAMES',
    items: [
      { label: 'Scoreboard', path: '/franchise/scoreboard', icon: 'scoreboard' },
      { label: 'Schedule', path: '/franchise/schedule', icon: 'schedule' },
      { label: 'Game Log', path: '/franchise/game-log', icon: 'gameLog' },
      { label: 'All-Star Game', path: '/franchise/all-star', icon: 'allStar' },
    ],
  },
  {
    heading: 'SEASON',
    items: [
      { label: "Owner's Office", path: '/franchise/goals', icon: 'goals' },
      { label: 'Hot & Cold', path: '/franchise/hot-cold', icon: 'hotCold' },
      { label: 'Awards', path: '/franchise/awards', icon: 'awards' },
      { label: 'Trade Proposals', path: '/franchise/trade-proposals', icon: 'tradeProposals' },
      { label: 'Injuries', path: '/franchise/injuries', icon: 'injuries' },
      { label: 'Minors', path: '/franchise/minors', icon: 'minors' },
      { label: 'Waivers', path: '/franchise/waivers', icon: 'waivers' },
      { label: 'Trade History', path: '/franchise/trade-history', icon: 'tradeHistory' },
      { label: 'Transactions', path: '/franchise/transactions', icon: 'transactions' },
    ],
  },
  {
    heading: 'HISTORY',
    items: [
      { label: 'Franchise History', path: '/franchise/history', icon: 'history' },
      { label: 'Player Career Stats', path: '/franchise/player-history', icon: 'leaders' },
    ],
  },
  {
    heading: 'PLAYOFFS',
    items: [
      { label: 'Playoffs', path: '/franchise/playoffs', icon: 'playoffs' },
      { label: 'Offseason', path: '/franchise/offseason', icon: 'offseason' },
    ],
  },
  {
    heading: 'SETTINGS',
    items: [
      { label: 'Save / Load', path: '/saves', icon: 'save' },
      { label: 'Settings', path: '/settings', icon: 'settings' },
    ],
  },
];

export function FranchiseSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { season, engine, userTeamId } = useFranchiseStore();
  const inboxUnread = useInboxStore(s => s.getUnreadCount());

  // Auto-collapse on small screens
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 640);

  const userTeam = userTeamId ? engine?.getTeam(userTeamId) ?? null : null;
  const userRecord = userTeamId ? season?.standings.getRecord(userTeamId) ?? null : null;

  // Resolve the actual path for a nav item (handles dynamic paths)
  const resolvePath = (item: NavItem): string => {
    if (typeof item.path === 'function') {
      return item.path(userTeamId);
    }
    return item.path;
  };

  // Determine active path — exact match for dashboard, prefix for others
  const isActive = (item: NavItem) => {
    const resolved = resolvePath(item);
    if (resolved === '/franchise') return location.pathname === '/franchise';

    // Check explicit active prefixes (for dynamic paths)
    if (item.activePrefixes) {
      return item.activePrefixes.some(prefix => location.pathname.startsWith(prefix));
    }

    return location.pathname === resolved || location.pathname.startsWith(resolved + '/');
  };

  return (
    <div
      data-testid="franchise-sidebar"
      className={cn(
        'relative flex flex-col h-screen bg-[#060b14] border-r border-navy-lighter/60 transition-all duration-200 shrink-0',
        collapsed ? 'w-[60px]' : 'w-[240px]',
      )}
      style={{ position: 'sticky', top: 0 }}
    >
      {/* Team header */}
      <div className={cn(
        'flex items-center border-b border-navy-lighter/60 bg-navy-light/40',
        collapsed ? 'flex-col py-3 px-2 gap-2 min-h-[80px] justify-center' : 'px-4 py-3 gap-3 min-h-[80px]',
      )}>
        {/* Collapsed: tap team badge to expand */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            className="absolute inset-x-0 top-0 h-[80px] cursor-pointer z-10 hover:bg-navy-lighter/10 transition-colors"
            aria-label="Expand navigation"
          />
        )}
        {/* Baseball icon */}
        <div className={cn(
          'rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center text-gold font-display font-bold shrink-0',
          collapsed ? 'w-9 h-9 text-sm' : 'w-10 h-10 text-base',
        )}>
          {userTeam?.abbreviation?.slice(0, 2) ?? 'CB'}
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            {userTeam ? (
              <>
                <p className="font-display text-gold text-sm tracking-wide uppercase leading-tight truncate">
                  {userTeam.city}
                </p>
                <p className="font-display text-cream text-xs tracking-wide uppercase leading-tight truncate">
                  {userTeam.name}
                </p>
                {userRecord && (
                  <p className="font-mono text-cream-dim text-xs mt-0.5">
                    {userRecord.wins}–{userRecord.losses}
                    {' '}
                    <span className="text-cream-dim/60">{winPct(userRecord)}</span>
                    {' · '}
                    <span className={cn(
                      'text-xs',
                      userRecord.streak >= 2 ? 'text-green-light' :
                      userRecord.streak <= -2 ? 'text-red' : 'text-cream-dim',
                    )}>
                      {streakStr(userRecord)}
                    </span>
                  </p>
                )}
              </>
            ) : (
              <p className="font-display text-gold text-sm tracking-wide uppercase">Claude Ball</p>
            )}
          </div>
        )}
      </div>

      {/* Season day badge */}
      {!collapsed && season && (
        <div className="px-4 py-2 border-b border-navy-lighter/40 bg-navy-lighter/10">
          <p className="font-mono text-cream-dim text-xs">
            Day{' '}
            <span className="text-cream font-bold">{season.currentDay}</span>
            {' '}/{' '}{season.totalDays}
            {' · '}
            <span className={cn(
              'uppercase text-xs font-bold px-1 py-0.5 rounded',
              season.phase === 'regular' && 'text-green-light',
              season.phase === 'preseason' && 'text-cream-dim',
              season.phase === 'postseason' && 'text-gold',
              season.phase === 'offseason' && 'text-cream-dim',
            )}>
              {season.phase}
            </span>
          </p>
        </div>
      )}

      {/* Nav sections */}
      <div className="relative flex-1 min-h-0">
        <nav className="h-full overflow-y-auto py-2 scrollbar-thin">
        {NAV_SECTIONS.map(section => (
          <div key={section.heading} className="mb-1">
            {/* Section heading */}
            {!collapsed && (
              <p className="px-4 pt-3 pb-1 font-mono text-[10px] text-cream-dim/50 tracking-widest uppercase select-none">
                {section.heading}
              </p>
            )}
            {collapsed && (
              <div className="w-full h-px bg-navy-lighter/30 my-1.5" />
            )}

            {section.items.map(item => {
              const active = isActive(item);
              const resolvedPath = resolvePath(item);
              return (
                <button
                  key={typeof item.path === 'string' ? item.path : item.label}
                  data-testid={`nav-${resolvedPath.replace(/\//g, '-').slice(1)}`}
                  onClick={() => navigate(resolvedPath)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 transition-all cursor-pointer',
                    collapsed ? 'justify-center px-2 py-2.5' : 'px-4 py-2',
                    active
                      ? 'text-gold bg-gold/10 border-r-2 border-gold'
                      : 'text-cream-dim hover:text-cream hover:bg-navy-lighter/20 border-r-2 border-transparent',
                  )}
                >
                  <Icon d={Icons[item.icon]} size={15} />
                  {!collapsed && (
                    <span className="font-mono text-xs tracking-wide truncate flex-1">{item.label}</span>
                  )}
                  {/* Unread badge for Inbox */}
                  {item.path === '/franchise/inbox' && inboxUnread > 0 && (
                    <span className={cn(
                      'inline-flex items-center justify-center rounded-full font-bold text-white bg-red leading-none shrink-0',
                      collapsed ? 'w-3.5 h-3.5 text-[8px] absolute top-1 right-1' : 'w-4 h-4 text-[9px]',
                    )}>
                      {inboxUnread > 9 ? '9+' : inboxUnread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
        </nav>
        {/* Scroll hint fade */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0a0f1a] to-transparent" />
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-navy-lighter/60 p-2">
        <button
          data-testid="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-2 rounded-md text-cream-dim hover:text-cream hover:bg-navy-lighter/20 transition-colors cursor-pointer',
            collapsed ? 'justify-center' : '',
          )}
        >
          <Icon d={collapsed ? Icons.chevronRight : Icons.chevronLeft} size={14} />
          {!collapsed && <span className="font-mono text-xs">Collapse</span>}
        </button>
      </div>
    </div>
  );
}
