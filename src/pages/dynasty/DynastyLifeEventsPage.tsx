import { useState } from 'react';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';
import type { LifeEvent, LifeEventChoice, LifeEventCategory } from '@/dynasty/systems/LifeEventSystem.ts';

const CATEGORY_ICONS: Record<LifeEventCategory, string> = {
  family: 'house', financial: 'wallet', legal: 'scale', health: 'heart',
  endorsement: 'megaphone', charity: 'star', education: 'book',
  social: 'users', drama: 'alert', opportunity: 'rocket',
};

const CATEGORY_COLORS: Record<LifeEventCategory, string> = {
  family: 'border-purple-400/40 bg-purple-400/5',
  financial: 'border-green-light/40 bg-green-light/5',
  legal: 'border-red-400/40 bg-red-400/5',
  health: 'border-cyan-500/40 bg-cyan-500/5',
  endorsement: 'border-gold/40 bg-gold/5',
  charity: 'border-pink-400/40 bg-pink-400/5',
  education: 'border-blue-400/40 bg-blue-400/5',
  social: 'border-orange-400/40 bg-orange-400/5',
  drama: 'border-red-500/40 bg-red-500/5',
  opportunity: 'border-gold/40 bg-gold/5',
};

// Demo life events
const DEMO_EVENTS: LifeEvent[] = [
  {
    id: 'le_1', category: 'endorsement', entityId: 'e_1', season: 2026,
    title: 'Nike Endorsement Offer',
    description: 'Nike wants you as the face of their new baseball cleat line. It would mean appearances, social media commitments, and a national ad campaign during the World Series.',
    choices: [
      { label: 'Sign the deal — $2M/year', effects: { financialDelta: 2000, reputationDelta: { fan: 8, media: 5 }, description: 'You signed with Nike. Your face is on billboards nationwide.' } },
      { label: 'Counter for more money', effects: { financialDelta: 3000, reputationDelta: { media: 3 }, description: 'You negotiated hard. Nike came back with $3M/year.' } },
      { label: 'Decline — stay focused', effects: { description: 'You turned down the deal to focus on baseball. Some fans respect it, some think you\'re crazy.' } },
    ],
  },
  {
    id: 'le_2', category: 'drama', entityId: 'e_1', season: 2026,
    title: 'TMZ: Nightclub Incident',
    description: 'Photos of you at a nightclub at 3 AM surfaced on TMZ. The front office is asking for a comment. Your agent is calling non-stop.',
    choices: [
      { label: 'Issue a public apology', effects: { reputationDelta: { media: -2, fan: -1, clubhouse: 1 }, description: 'You apologized. The story dies in 48 hours.' } },
      { label: 'No comment — let it blow over', effects: { reputationDelta: { media: -8 }, description: 'The media ran with it for a week without your side of the story.' } },
      { label: 'Lean into it — "I had a great time"', effects: { reputationDelta: { fan: 3, media: -5, clubhouse: -4 }, description: 'Fans loved the honesty. Your manager didn\'t.' } },
    ],
  },
  {
    id: 'le_3', category: 'charity', entityId: 'e_1', season: 2026,
    title: 'Boys & Girls Club Gala',
    description: 'The local Boys & Girls Club is hosting their annual fundraiser. They want you to be the keynote speaker and are hoping for a donation.',
    choices: [
      { label: 'Speak + donate $100K', effects: { financialDelta: -100, reputationDelta: { fan: 12, media: 8, clubhouse: 5 }, description: 'You gave an incredible speech. Kids look up to you.' } },
      { label: 'Attend but no donation', effects: { reputationDelta: { fan: 4, media: 3 }, description: 'Your presence meant a lot to the kids.' } },
      { label: 'Skip it — too busy', effects: { description: 'You stayed home. Nobody noticed.' } },
    ],
  },
  {
    id: 'le_4', category: 'education', entityId: 'e_1', season: 2026,
    title: 'Executive MBA Opportunity',
    description: 'Wharton\'s executive MBA program has a spot for you. It\'s designed for athletes — classes during the offseason, online during the season. Could be your ticket to a front office career.',
    choices: [
      { label: 'Enroll ($120K tuition)', effects: { financialDelta: -120, description: 'You started your MBA. It\'s hard, but you\'re building skills for life after baseball.' } },
      { label: 'Maybe next year', effects: { description: 'The spot won\'t be held. You passed on it this time.' } },
    ],
  },
];

export function DynastyLifeEventsPage() {
  const [events, setEvents] = useState<LifeEvent[]>(DEMO_EVENTS);
  const [resolvedResults, setResolvedResults] = useState<Map<string, { choice: LifeEventChoice; choiceIndex: number }>>(new Map());

  const handleChoice = (eventId: string, choiceIndex: number, choice: LifeEventChoice) => {
    setResolvedResults(prev => new Map(prev).set(eventId, { choice, choiceIndex }));
  };

  const pendingEvents = events.filter(e => !resolvedResults.has(e.id));
  const resolvedEvents = events.filter(e => resolvedResults.has(e.id));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl text-gold uppercase tracking-wide">Life Events</h1>
        <p className="font-mono text-xs text-cream-dim/50 mt-1">
          {pendingEvents.length} pending &middot; {resolvedEvents.length} resolved
        </p>
      </div>

      {/* Pending Events */}
      {pendingEvents.length > 0 && (
        <div className="space-y-4 mb-8">
          <h2 className="font-mono text-xs text-cream-dim/40 uppercase tracking-widest">Needs Your Decision</h2>
          {pendingEvents.map(event => (
            <div key={event.id} className={cn('rounded-xl border p-5', CATEGORY_COLORS[event.category])}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-widest">{event.category}</span>
                  <h3 className="font-display text-xl text-cream mt-1">{event.title}</h3>
                </div>
              </div>
              <p className="text-cream-dim text-sm leading-relaxed mb-4">{event.description}</p>
              <div className="space-y-2">
                {event.choices.map((choice, i) => (
                  <button
                    key={i}
                    onClick={() => handleChoice(event.id, i, choice)}
                    className="w-full text-left rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
                  >
                    <p className="text-cream text-sm font-medium">{choice.label}</p>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      {choice.effects.financialDelta && (
                        <span className={cn('text-[10px] font-mono', choice.effects.financialDelta > 0 ? 'text-green-light' : 'text-red-400')}>
                          {choice.effects.financialDelta > 0 ? '+' : ''}${Math.abs(choice.effects.financialDelta)}K
                        </span>
                      )}
                      {choice.effects.reputationDelta?.fan && (
                        <span className={cn('text-[10px] font-mono', choice.effects.reputationDelta.fan > 0 ? 'text-green-light' : 'text-red-400')}>
                          {choice.effects.reputationDelta.fan > 0 ? '+' : ''}{choice.effects.reputationDelta.fan} Fan Rep
                        </span>
                      )}
                      {choice.effects.reputationDelta?.media && (
                        <span className={cn('text-[10px] font-mono', choice.effects.reputationDelta.media > 0 ? 'text-gold' : 'text-red-400')}>
                          {choice.effects.reputationDelta.media > 0 ? '+' : ''}{choice.effects.reputationDelta.media} Media Rep
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolved Events */}
      {resolvedEvents.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-mono text-xs text-cream-dim/40 uppercase tracking-widest">Resolved</h2>
          {resolvedEvents.map(event => {
            const result = resolvedResults.get(event.id)!;
            return (
              <Panel key={event.id} title={event.title}>
                <p className="text-cream-dim text-sm">{result.choice.effects.description}</p>
                <div className="flex gap-3 mt-2 flex-wrap">
                  {result.choice.effects.financialDelta && (
                    <span className={cn('text-xs font-mono px-2 py-0.5 rounded-full border',
                      result.choice.effects.financialDelta > 0 ? 'text-green-light border-green-light/30 bg-green-light/10' : 'text-red-400 border-red-400/30 bg-red-400/10'
                    )}>
                      {result.choice.effects.financialDelta > 0 ? '+' : ''}${Math.abs(result.choice.effects.financialDelta)}K
                    </span>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {pendingEvents.length === 0 && resolvedEvents.length === 0 && (
        <Panel>
          <div className="text-center py-12">
            <p className="text-cream-dim/40 font-mono text-sm">No life events yet. Play through a season to generate offseason events.</p>
          </div>
        </Panel>
      )}
    </div>
  );
}
