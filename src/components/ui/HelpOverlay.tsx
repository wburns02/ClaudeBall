/**
 * HelpOverlay — press ? to show keyboard shortcuts and navigation guide.
 * Accessible from any page in the app.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn.ts';
import { useAchievementStore } from '@/stores/achievementStore.ts';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; desc: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Game Controls',
    shortcuts: [
      { keys: ['Space'], desc: 'Next pitch / advance' },
      { keys: ['S'], desc: 'Swing (normal)' },
      { keys: ['Shift', 'Space'], desc: 'Power swing' },
      { keys: ['C'], desc: 'Contact swing' },
      { keys: ['B'], desc: 'Bunt' },
      { keys: ['T'], desc: 'Take (don\'t swing)' },
      { keys: ['A'], desc: 'Toggle auto-play' },
      { keys: ['N'], desc: 'Sim to end of game' },
      { keys: ['1-5'], desc: 'Set game speed' },
    ],
  },
  {
    title: 'Franchise',
    shortcuts: [
      { keys: ['N'], desc: 'Advance Day (on dashboard)' },
      { keys: ['Esc'], desc: 'Close modal / go back' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['?'], desc: 'Toggle this help overlay' },
    ],
  },
];

interface QuickLink {
  label: string;
  path: string;
  desc: string;
  category: string;
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'Dashboard', path: '/franchise', desc: 'Season overview and sim controls', category: 'Core' },
  { label: 'Roster', path: '/franchise/roster', desc: 'Your 25-man roster with quick-view modals', category: 'Core' },
  { label: 'Lineup Editor', path: '/franchise/lineup-editor', desc: 'Drag to reorder batting lineup', category: 'Core' },
  { label: 'Trade Center', path: '/franchise/trade', desc: 'Click players to build trade proposals', category: 'Trades' },
  { label: 'Trade Machine', path: '/franchise/trade-machine', desc: 'Analyze trade scenarios with WAR impact', category: 'Trades' },
  { label: 'Trade Deadline', path: '/franchise/trade-deadline', desc: 'Countdown, buyer/seller analysis', category: 'Trades' },
  { label: 'Free Agency', path: '/franchise/free-agency', desc: 'Sign available players to your roster', category: 'GM' },
  { label: 'Coaching Staff', path: '/franchise/coaching-staff', desc: 'Hire/fire coaches, see bonus impacts', category: 'GM' },
  { label: 'Scouting Hub', path: '/franchise/scouting', desc: '20-80 tool grades and team needs', category: 'GM' },
  { label: 'Compare Teams', path: '/franchise/team-compare', desc: 'Side-by-side team analysis with head-to-head', category: 'GM' },
  { label: 'League Highlights', path: '/franchise/highlights', desc: 'Shutouts, walk-offs, streaks across the league', category: 'Season' },
  { label: 'Season Story', path: '/franchise/season-story', desc: 'Narrative retelling of your season', category: 'Season' },
  { label: 'Awards Ceremony', path: '/franchise/awards', desc: 'MVP, Cy Young, ROY reveals', category: 'Season' },
  { label: 'Hall of Records', path: '/franchise/hall-of-records', desc: 'All-time franchise leaderboards', category: 'Season' },
];

function Key({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded bg-navy-lighter/50 border border-navy-lighter text-cream font-mono text-[11px] font-bold shadow-[0_1px_0_rgba(0,0,0,0.3)]">
      {children}
    </span>
  );
}

export function HelpOverlay() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const unlock = useAchievementStore(s => s.unlock);
  const toggle = useCallback(() => {
    setOpen(v => { if (!v) unlock('help-reader'); return !v; });
  }, [unlock]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  if (!open) return null;

  const categories = [...new Set(QUICK_LINKS.map(l => l.category))];

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-start justify-center overflow-y-auto" onClick={() => setOpen(false)}>
      <div className="w-full max-w-3xl mx-auto p-4 md:p-6 pb-20 mt-8" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-3xl text-gold uppercase tracking-wide">Help & Shortcuts</h2>
            <p className="font-mono text-cream-dim text-xs mt-1">Press <Key>?</Key> to toggle this overlay</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-cream-dim/50 hover:text-cream text-xl font-mono cursor-pointer">✕</button>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title} className="rounded-lg border border-navy-lighter/40 bg-navy-light/60 p-4">
              <h3 className="font-display text-sm text-gold/70 uppercase tracking-widest mb-3">{group.title}</h3>
              <div className="space-y-2">
                {group.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex gap-1 shrink-0">
                      {s.keys.map(k => <Key key={k}>{k}</Key>)}
                    </div>
                    <span className="font-mono text-xs text-cream-dim/70 flex-1">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Navigation */}
        <div className="mb-6">
          <h3 className="font-display text-lg text-gold/70 uppercase tracking-widest mb-4">Quick Navigation</h3>
          {categories.map(cat => (
            <div key={cat} className="mb-4">
              <p className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-widest mb-2">{cat}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {QUICK_LINKS.filter(l => l.category === cat).map(link => (
                  <button
                    key={link.path}
                    onClick={() => { navigate(link.path); setOpen(false); }}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-md border border-transparent hover:border-gold/20 hover:bg-gold/5 transition-all cursor-pointer text-left"
                  >
                    <span className="font-display text-sm text-cream tracking-wide">{link.label}</span>
                    <span className="font-mono text-[10px] text-cream-dim/40 flex-1 text-right">{link.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="rounded-lg border border-navy-lighter/30 bg-navy-lighter/10 p-4">
          <h3 className="font-display text-sm text-cream tracking-widest uppercase mb-3">Tips for New Players</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { tip: 'Start a franchise', detail: 'Click "New Franchise" on the main menu, pick a team, and hit Start Season.' },
              { tip: 'Sim your first games', detail: 'On the Dashboard, click "Advance Day" to play one day, or "Sim 7 Days" to skip ahead.' },
              { tip: 'Check your roster', detail: 'Click any player name in the Roster to see their scouting report and stats.' },
              { tip: 'Make trades', detail: 'Use the Trade Machine to analyze deals, then propose via the Trade Center.' },
            ].map(t => (
              <div key={t.tip}>
                <p className="font-body text-sm text-cream font-medium">{t.tip}</p>
                <p className="font-mono text-[10px] text-cream-dim/50 mt-0.5">{t.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center font-mono text-[10px] text-cream-dim/30 mt-6">
          v0.1.0 · Built with React + TypeScript + Pixi.js · Inspired by Front Page Sports: Baseball Pro '98
        </p>
      </div>
    </div>
  );
}
