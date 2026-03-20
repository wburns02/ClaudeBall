import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import { useInboxStore, type InboxItem, type InboxItemType } from '@/stores/inboxStore.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';

const TYPE_META: Record<InboxItemType, { icon: string; accentClass: string; label: string }> = {
  injury:       { icon: '🏥', accentClass: 'border-l-red-400',     label: 'Injury' },
  return:       { icon: '✅', accentClass: 'border-l-green-light', label: 'Return' },
  trade_offer:  { icon: '🤝', accentClass: 'border-l-gold',        label: 'Trade Offer' },
  trade_result: { icon: '🔄', accentClass: 'border-l-blue-400',    label: 'Trade' },
  waiver:       { icon: '📋', accentClass: 'border-l-cream-dim',   label: 'Waivers' },
  fa_signing:   { icon: '✍️', accentClass: 'border-l-cream-dim',   label: 'Free Agency' },
  milestone:    { icon: '⭐', accentClass: 'border-l-gold',        label: 'Milestone' },
  callup:       { icon: '⬆️', accentClass: 'border-l-green-light', label: 'Callup' },
  standings:    { icon: '📊', accentClass: 'border-l-cream-dim',   label: 'Standings' },
  contract:     { icon: '📝', accentClass: 'border-l-cream-dim',   label: 'Contract' },
  record:       { icon: '🏆', accentClass: 'border-l-gold',        label: 'Record' },
  general:      { icon: '📬', accentClass: 'border-l-cream-dim',   label: 'News' },
};

type FilterTab = 'all' | 'unread' | 'urgent';

export function InboxPage() {
  const navigate = useNavigate();
  const { items, markRead, markAllRead, getUnreadCount } = useInboxStore();
  const { season } = useFranchiseStore();
  const [filter, setFilter] = useState<FilterTab>('all');

  const unreadCount = getUnreadCount();

  const visible = items.filter(item => {
    if (filter === 'unread') return !item.read;
    if (filter === 'urgent') return item.urgent;
    return true;
  });

  const handleClick = (item: InboxItem) => {
    markRead(item.id);
    if (item.linkedUrl) navigate(item.linkedUrl);
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',    label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'urgent', label: 'Urgent' },
  ];

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">GM Inbox</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up'}
            {season ? ` · Season Day ${season.currentDay}/${season.totalDays}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button size="sm" variant="secondary" onClick={markAllRead}>
              Mark All Read
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 border-b border-navy-lighter/40 pb-3">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-md font-mono cursor-pointer transition-colors',
              filter === tab.key
                ? 'bg-gold/20 text-gold border border-gold/40'
                : 'text-cream-dim hover:text-cream border border-transparent',
            )}
          >
            {tab.label}
            {tab.key === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-red text-white text-[9px] rounded-full font-bold leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-cream-dim/30 font-mono text-xs self-center">
          {visible.length} item{visible.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Message list */}
      <div className="space-y-2">
        {visible.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">
              {filter === 'unread' ? '✉️' : filter === 'urgent' ? '🔔' : '📬'}
            </p>
            <p className="font-mono text-cream-dim text-sm">
              {filter === 'unread'
                ? 'No unread messages — you\'re all caught up!'
                : filter === 'urgent'
                  ? 'No urgent items right now.'
                  : 'No messages yet. Advance the season to receive updates.'}
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-3 text-gold text-xs font-mono hover:underline cursor-pointer"
              >
                View all messages
              </button>
            )}
          </div>
        ) : (
          visible.map(item => {
            const meta = TYPE_META[item.type] ?? TYPE_META.general;
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item)}
                className={cn(
                  'w-full text-left flex gap-3 rounded-lg border border-navy-lighter/40',
                  'p-3.5 transition-all duration-150 cursor-pointer group',
                  item.read
                    ? 'bg-navy-light/10 hover:bg-navy-light/20 opacity-60 hover:opacity-80 border-l-2'
                    : cn('bg-navy-light/30 hover:bg-navy-light/50 border-l-4', meta.accentClass),
                )}
              >
                {/* Icon */}
                <div className="text-xl shrink-0 mt-0.5 select-none">{meta.icon}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={cn(
                      'font-mono text-sm leading-snug',
                      item.read ? 'text-cream-dim font-normal' : 'text-cream font-bold',
                    )}>
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.urgent && !item.read && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red/25 text-red border border-red/50 uppercase tracking-wider">
                          !! Urgent
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-cream-dim/40 tabular-nums">
                        Day {item.day}
                      </span>
                    </div>
                  </div>
                  <p className={cn(
                    'text-xs font-body leading-relaxed',
                    item.read ? 'text-cream-dim/40' : 'text-cream-dim/75',
                  )}>
                    {item.body}
                  </p>
                  {item.linkedUrl && !item.read && (
                    <p className="text-[10px] font-mono text-gold/70 mt-2 group-hover:text-gold transition-colors">
                      → View {item.linkedUrl.split('/').pop()?.replace(/-/g, ' ')}
                    </p>
                  )}
                </div>

                {/* Unread indicator */}
                {!item.read && (
                  <div className="shrink-0 w-2 h-2 rounded-full bg-gold mt-2" />
                )}
              </button>
            );
          })
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-10 pb-4 text-center">
          <p className="text-cream-dim/25 font-mono text-xs">
            {items.length} total · inbox holds last 300 messages
          </p>
        </div>
      )}
    </div>
  );
}
