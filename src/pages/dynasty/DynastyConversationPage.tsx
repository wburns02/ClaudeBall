import { useState, useMemo } from 'react';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';
import { ConversationLibrary } from '@/dynasty/conversations/ConversationLibrary.ts';
import { TemplateEngine } from '@/dynasty/conversations/TemplateEngine.ts';
import type { ConversationTemplate, DialogueNode, ConversationContext } from '@/dynasty/conversations/types.ts';

// Sample templates for demo
const DEMO_TEMPLATES: ConversationTemplate[] = [
  {
    id: 'owner-meeting-001',
    situation: 'owner_meeting',
    archetypes: { npc: ['high_ego'], player: ['any'] },
    emotionalState: ['frustrated'],
    stakes: 'career_defining' as any,
    nodes: [
      { id: 'open', speaker: 'npc', text: 'Close the door, {{playerName}}. We need to talk about this team\'s direction.', next: ['confident', 'cautious', 'apologetic'] },
      { id: 'confident', speaker: 'player', text: 'I have a plan, Mr. {{npcName}}. Give me one more offseason and you\'ll see results.', effects: { affinity: 3, respect: 5 }, next: ['owner_skeptical'] },
      { id: 'cautious', speaker: 'player', text: 'I understand your frustration. What changes do you want to see?', effects: { affinity: 1 }, next: ['owner_demands'] },
      { id: 'apologetic', speaker: 'player', text: 'You\'re right to be disappointed. I take full responsibility.', effects: { affinity: -2, respect: -3 }, next: ['owner_softens'] },
      { id: 'owner_skeptical', speaker: 'npc', text: '"One more offseason." I\'ve heard that before. What specifically will be different?', next: ['pitch_plan'] },
      { id: 'owner_demands', speaker: 'npc', text: 'I want a playoff team. Period. I don\'t care how you get there — trades, free agents, whatever it takes.', next: ['pitch_plan'] },
      { id: 'owner_softens', speaker: 'npc', text: '...At least you own it. Not many GMs do. Look, I\'m giving you one more year. Make it count.' },
      { id: 'pitch_plan', speaker: 'player', text: 'Here\'s my plan: we target two impact bats in free agency and trade from our pitching depth. We can contend by July.' },
    ],
    outcomes: {
      'confidence_gained': { event: 'OwnerMeeting', affinityDelta: 5, description: 'Owner is cautiously optimistic.' },
      'on_thin_ice': { event: 'OwnerMeeting', affinityDelta: -5, description: 'Owner is running out of patience.' },
    },
  },
];

export function DynastyConversationPage() {
  const [currentNodeId, setCurrentNodeId] = useState('open');
  const [history, setHistory] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const context: ConversationContext = {
    playerName: 'Will',
    npcName: 'Dalton',
    teamCity: 'Houston',
    teamName: 'Astros',
    record: '58-72',
    season: 2026,
  };

  const template = DEMO_TEMPLATES[0];
  const resolvedNodes = useMemo(() => TemplateEngine.resolveTemplate(template, context), []);
  const nodeMap = useMemo(() => new Map(resolvedNodes.map(n => [n.id, n])), [resolvedNodes]);

  const currentNode = nodeMap.get(currentNodeId);
  const previousNodes = history.map(id => nodeMap.get(id)).filter(Boolean) as DialogueNode[];

  const handleChoice = (nextId: string) => {
    setHistory(prev => [...prev, currentNodeId]);
    setCurrentNodeId(nextId);
    const nextNode = nodeMap.get(nextId);
    if (!nextNode?.next || nextNode.next.length === 0) {
      // This is a terminal node — conversation ends after displaying it
      setTimeout(() => setIsComplete(true), 1500);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="font-display text-3xl text-gold uppercase tracking-wide">Conversation</h1>
        <p className="font-mono text-xs text-cream-dim/50 mt-1">Owner Meeting — Career Defining</p>
      </div>

      <Panel>
        <div className="space-y-4 min-h-[300px]">
          {/* Previous dialogue */}
          {previousNodes.map((node, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-3 items-start opacity-60',
                node.speaker === 'npc' ? '' : 'flex-row-reverse'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono shrink-0',
                node.speaker === 'npc' ? 'bg-red-400/20 text-red-400 border border-red-400/30' : 'bg-gold/20 text-gold border border-gold/30'
              )}>
                {node.speaker === 'npc' ? 'NPC' : 'YOU'}
              </div>
              <div className={cn(
                'rounded-xl px-4 py-2.5 max-w-md',
                node.speaker === 'npc' ? 'bg-navy-lighter/50' : 'bg-gold/10'
              )}>
                <p className="text-cream text-sm leading-relaxed">{node.text}</p>
              </div>
            </div>
          ))}

          {/* Current node */}
          {currentNode && !isComplete && (
            <div className={cn(
              'flex gap-3 items-start',
              currentNode.speaker === 'npc' ? '' : 'flex-row-reverse'
            )}>
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono shrink-0',
                currentNode.speaker === 'npc' ? 'bg-red-400/20 text-red-400 border border-red-400/30' : 'bg-gold/20 text-gold border border-gold/30'
              )}>
                {currentNode.speaker === 'npc' ? 'NPC' : 'YOU'}
              </div>
              <div className={cn(
                'rounded-xl px-4 py-2.5 max-w-md',
                currentNode.speaker === 'npc' ? 'bg-navy-lighter/50 border border-navy-lighter' : 'bg-gold/10 border border-gold/20'
              )}>
                <p className="text-cream text-sm leading-relaxed">{currentNode.text}</p>
              </div>
            </div>
          )}

          {/* Player choices */}
          {currentNode?.next && currentNode.next.length > 0 && currentNode.speaker === 'npc' && !isComplete && (
            <div className="pt-4 space-y-2 border-t border-navy-lighter/50">
              <p className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-widest">Your Response</p>
              {currentNode.next.map(nextId => {
                const nextNode = nodeMap.get(nextId);
                if (!nextNode) return null;
                return (
                  <button
                    key={nextId}
                    onClick={() => handleChoice(nextId)}
                    className="w-full text-left rounded-lg border border-gold/20 bg-gold/5 px-4 py-2.5 hover:bg-gold/15 hover:border-gold/40 transition-all cursor-pointer"
                  >
                    <p className="text-cream text-sm">{nextNode.text}</p>
                    {nextNode.effects && (
                      <div className="flex gap-2 mt-1">
                        {nextNode.effects.affinity !== undefined && (
                          <span className={cn('text-[10px] font-mono', nextNode.effects.affinity > 0 ? 'text-green-light' : 'text-red-400')}>
                            {nextNode.effects.affinity > 0 ? '+' : ''}{nextNode.effects.affinity} Affinity
                          </span>
                        )}
                        {nextNode.effects.respect !== undefined && (
                          <span className={cn('text-[10px] font-mono', nextNode.effects.respect > 0 ? 'text-gold' : 'text-red-400')}>
                            {nextNode.effects.respect > 0 ? '+' : ''}{nextNode.effects.respect} Respect
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Conversation complete */}
          {isComplete && (
            <div className="text-center py-8 border-t border-navy-lighter/50">
              <div className="font-mono text-xs text-gold/70 uppercase tracking-widest mb-2">Conversation Complete</div>
              <p className="text-cream-dim text-sm">The owner's decision will affect your future with the organization.</p>
              <Button className="mt-4" onClick={() => window.history.back()}>Return</Button>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
