import { useState } from 'react';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';
import { OffseasonInbox } from '@/dynasty/phases/OffseasonInbox.ts';
import type { InboxItem, InboxItemType, InboxPriority } from '@/dynasty/phases/OffseasonInbox.ts';

const TYPE_COLORS: Record<InboxItemType, string> = {
  actionable: 'border-gold/50 bg-gold/5',
  informational: 'border-cyan-500/30 bg-cyan-500/5',
  decision: 'border-red-400/50 bg-red-400/5',
  personal: 'border-purple-400/50 bg-purple-400/5',
};

const PRIORITY_BADGES: Record<InboxPriority, { label: string; color: string }> = {
  urgent: { label: 'URGENT', color: 'bg-red-500/20 text-red-400 border-red-500/40' },
  high: { label: 'HIGH', color: 'bg-gold/20 text-gold border-gold/40' },
  normal: { label: '', color: '' },
  low: { label: '', color: '' },
};

// Demo inbox items for display when no real data exists
const DEMO_ITEMS: Omit<InboxItem, 'id' | 'isRead' | 'isActedOn' | 'timestamp'>[] = [
  { type: 'actionable', priority: 'urgent', week: 1, title: 'Agent for Marcus Webb wants to discuss extension', description: 'Webb\'s agent called. He wants to lock in a deal before free agency opens.', fromName: 'Scott Boras' },
  { type: 'informational', priority: 'high', week: 1, title: 'BREAKING: Yankees sign top FA reliever, 4yr/$72M', description: 'The Yankees landed the top reliever on the market. One less option for your bullpen.', fromName: 'MLB Network' },
  { type: 'decision', priority: 'high', week: 2, title: 'Ownership wants to meet about next year\'s direction', description: 'Owner Jim Dalton has requested a meeting to discuss the team\'s future.', fromName: 'Jim Dalton' },
  { type: 'personal', priority: 'normal', week: 2, title: 'Your wife is asking about vacation plans', description: 'The offseason just started — time to plan some family time.', fromName: 'Family' },
  { type: 'informational', priority: 'normal', week: 3, title: 'Scout filed report on #3 draft prospect', description: 'Your top scout evaluated the best available college arm. Report ready for review.', fromName: 'Scouting Dept' },
  { type: 'actionable', priority: 'normal', week: 4, title: 'Trade call from Dodgers GM', description: 'The Dodgers are interested in your starting catcher. They have prospects to offer.', fromName: 'Andrew Friedman' },
];

export function DynastyInboxPage() {
  const [filter, setFilter] = useState<'all' | InboxItemType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Create demo inbox
  const [inbox] = useState(() => {
    const ib = new OffseasonInbox();
    for (const item of DEMO_ITEMS) {
      ib.addItem(item);
    }
    return ib;
  });

  const items = filter === 'all' ? inbox.getAll() : inbox.getAll().filter(i => i.type === filter);
  const selected = items.find(i => i.id === selectedId);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold uppercase tracking-wide">Hot Stove Inbox</h1>
          <p className="font-mono text-xs text-cream-dim/50 mt-1">
            {inbox.unreadCount} unread &middot; {inbox.actionCount} need action
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'actionable', 'decision', 'informational', 'personal'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'font-mono text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer capitalize',
              filter === f ? 'border-gold bg-gold/15 text-gold' : 'border-navy-lighter text-cream-dim/50 hover:border-gold/30'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4" style={{ minHeight: 400 }}>
        {/* Inbox list */}
        <div className="col-span-2 space-y-1.5 max-h-[600px] overflow-y-auto">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedId(item.id);
                inbox.markRead(item.id);
              }}
              className={cn(
                'w-full text-left rounded-lg border p-3 transition-all cursor-pointer',
                TYPE_COLORS[item.type],
                selectedId === item.id && 'ring-1 ring-gold/50',
                !item.isRead && 'border-l-2 border-l-gold',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className={cn('font-mono text-sm truncate', item.isRead ? 'text-cream-dim/70' : 'text-cream font-semibold')}>
                    {item.title}
                  </p>
                  <p className="font-mono text-[10px] text-cream-dim/40 mt-0.5">
                    {item.fromName ?? 'Unknown'} &middot; Week {item.week}
                  </p>
                </div>
                {PRIORITY_BADGES[item.priority].label && (
                  <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0', PRIORITY_BADGES[item.priority].color)}>
                    {PRIORITY_BADGES[item.priority].label}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div className="col-span-3">
          {selected ? (
            <Panel title={selected.title}>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-cream-dim/40 uppercase">{selected.type}</span>
                  <span className="font-mono text-xs text-cream-dim/40">Week {selected.week}</span>
                  {selected.fromName && (
                    <span className="font-mono text-xs text-gold/70">From: {selected.fromName}</span>
                  )}
                </div>
                <p className="text-cream text-sm leading-relaxed">{selected.description}</p>
                {selected.type === 'actionable' && !selected.isActedOn && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => inbox.markActedOn(selected.id)}>Take Action</Button>
                    <Button size="sm" variant="secondary" onClick={() => inbox.markActedOn(selected.id)}>Dismiss</Button>
                  </div>
                )}
                {selected.type === 'decision' && !selected.isActedOn && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => inbox.markActedOn(selected.id)}>Schedule Meeting</Button>
                    <Button size="sm" variant="secondary" onClick={() => inbox.markActedOn(selected.id)}>Decline</Button>
                  </div>
                )}
                {selected.isActedOn && (
                  <div className="font-mono text-xs text-green-light/70 bg-green-light/5 border border-green-light/20 rounded px-3 py-1.5">
                    Handled
                  </div>
                )}
              </div>
            </Panel>
          ) : (
            <Panel>
              <div className="text-center py-12">
                <p className="text-cream-dim/40 font-mono text-sm">Select an item to view details</p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
