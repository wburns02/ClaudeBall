import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
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
  schedule: 'M8 2v4 M16 2v4 M3 10h18 M21 8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V8z',
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
  menu: 'M3 12h18 M3 6h18 M3 18h18',
};

interface NavItem {
  label: string;
  path: string;
  icon: keyof typeof Icons;
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
    ],
  },
  {
    heading: 'TEAM',
    items: [
      { label: 'Roster', path: '/franchise/roster', icon: 'roster' },
      { label: 'Player Editor', path: '/franchise/player', icon: 'playerEditor' },
      { label: 'Create Player', path: '/franchise/create-player', icon: 'createPlayer' },
      { label: 'Team Editor', path: '/franchise/team', icon: 'teamEditor' },
    ],
  },
  {
    heading: 'LEAGUE',
    items: [
      { label: 'Standings', path: '/franchise/standings', icon: 'standings' },
      { label: 'Leaders', path: '/franchise/leaders', icon: 'leaders' },
      { label: 'Records', path: '/franchise/records', icon: 'records' },
    ],
  },
  {
    heading: 'GM',
    items: [
      { label: 'Trades', path: '/franchise/trade', icon: 'trades' },
      { label: 'Free Agency', path: '/franchise/free-agency', icon: 'freeAgency' },
      { label: 'Draft', path: '/franchise/draft', icon: 'draft' },
      { label: 'Roster Manager', path: '/franchise/roster-manager', icon: 'rosterMgr' },
    ],
  },
  {
    heading: 'SEASON',
    items: [
      { label: 'Injuries', path: '/franchise/injuries', icon: 'injuries' },
      { label: 'Minors', path: '/franchise/minors', icon: 'minors' },
      { label: 'Waivers', path: '/franchise/waivers', icon: 'waivers' },
      { label: 'Trade History', path: '/franchise/trade-history', icon: 'tradeHistory' },
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

  const [collapsed, setCollapsed] = useState(false);

  const userTeam = userTeamId ? engine?.getTeam(userTeamId) ?? null : null;
  const userRecord = userTeamId ? season?.standings.getRecord(userTeamId) ?? null : null;

  // Determine active path — exact match for dashboard, prefix for others
  const isActive = (path: string) => {
    if (path === '/franchise') return location.pathname === '/franchise';
    // For player/team editor parent paths, match prefix but exclude exact /franchise
    if (path === '/franchise/player' || path === '/franchise/team') {
      return location.pathname.startsWith(path + '/');
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div
      data-testid="franchise-sidebar"
      className={cn(
        'flex flex-col h-screen bg-[#060b14] border-r border-navy-lighter/60 transition-all duration-200 shrink-0',
        collapsed ? 'w-[60px]' : 'w-[240px]',
      )}
      style={{ position: 'sticky', top: 0 }}
    >
      {/* Team header */}
      <div className={cn(
        'flex items-center border-b border-navy-lighter/60 bg-navy-light/40',
        collapsed ? 'flex-col py-3 px-2 gap-2 min-h-[80px] justify-center' : 'px-4 py-3 gap-3 min-h-[80px]',
      )}>
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
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
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
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  data-testid={`nav-${item.path.replace(/\//g, '-').slice(1)}`}
                  onClick={() => navigate(item.path)}
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
                    <span className="font-mono text-xs tracking-wide truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

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
