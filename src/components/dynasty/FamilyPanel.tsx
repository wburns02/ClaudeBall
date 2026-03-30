import { cn } from '@/lib/cn.ts';
import { Panel } from '@/components/ui/Panel.tsx';
import type { FamilyComponent, FamilyMember, FamilyRole } from '@/dynasty/systems/FamilySystem.ts';

const ROLE_EMOJIS: Record<FamilyRole, string> = {
  father: '👨',
  mother: '👩',
  older_brother: '👦',
  younger_sister: '👧',
  grandfather: '👴',
  grandmother: '👵',
  uncle: '🧔',
  aunt: '👩‍🦱',
  cousin: '🧑',
  spouse: '💑',
  son: '👶',
  daughter: '👶',
};

const INCOME_TIER_LABELS: Record<FamilyComponent['incomeTier'], string> = {
  poverty: 'Poverty',
  working_class: 'Working Class',
  middle_class: 'Middle Class',
  upper_middle: 'Upper Middle',
  wealthy: 'Wealthy',
};

interface FamilyPanelProps {
  family: FamilyComponent;
}

function RelationshipBar({ value }: { value: number }) {
  // value is -100 to +100, normalize to 0-100 for width
  const normalized = (value + 100) / 2; // 0 to 100
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-navy-lighter/40 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isPositive ? 'bg-green-light/70' : 'bg-red-400/70'
          )}
          style={{ width: `${normalized}%` }}
        />
      </div>
      <span
        className={cn(
          'text-xs font-mono w-8 text-right',
          isPositive ? 'text-green-light/70' : 'text-red-400/70'
        )}
      >
        {value > 0 ? '+' : ''}{value}
      </span>
    </div>
  );
}

function MemberCard({ member }: { member: FamilyMember }) {
  const emoji = ROLE_EMOJIS[member.role] ?? '🧑';
  const roleLabel = member.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="bg-navy-light/50 border border-navy-lighter/30 rounded-lg px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-cream font-mono text-sm font-semibold truncate">{member.name}</p>
          <p className="text-cream-dim/50 text-xs font-mono">
            {roleLabel} &middot; Age {member.age}
          </p>
        </div>
      </div>
      <RelationshipBar value={member.relationship} />
      {member.storyHook && (
        <p className="text-cream-dim/50 text-xs italic leading-snug">{member.storyHook}</p>
      )}
    </div>
  );
}

export function FamilyPanel({ family }: FamilyPanelProps) {
  const archetypeLabel = family.archetype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const tierLabel = INCOME_TIER_LABELS[family.incomeTier];

  const aliveMembers = family.members.filter(m => m.isAlive);
  const deceasedMembers = family.members.filter(m => !m.isAlive);

  return (
    <Panel title={`Family \u2014 ${archetypeLabel}`}>
      {/* Income info */}
      <div className="flex items-center gap-3 mb-4 text-xs font-mono">
        <span className="text-cream-dim/60">
          Income Tier: <span className="text-cream/80">{tierLabel}</span>
        </span>
        <span className="text-cream-dim/60">
          Household: <span className="text-cream/80">${family.householdIncome}k/yr</span>
        </span>
      </div>

      {/* Alive members */}
      <div className="space-y-2">
        {aliveMembers.map(member => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>

      {/* Deceased section */}
      {deceasedMembers.length > 0 && (
        <div className="mt-4 pt-3 border-t border-navy-lighter/30">
          <p className="text-cream-dim/40 text-xs font-mono uppercase tracking-wider mb-2">
            Deceased
          </p>
          <div className="space-y-1.5">
            {deceasedMembers.map(member => {
              const emoji = ROLE_EMOJIS[member.role] ?? '🧑';
              const roleLabel = member.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-2 text-cream-dim/30 text-xs font-mono px-2 py-1"
                >
                  <span className="opacity-50">{emoji}</span>
                  <span>{member.name}</span>
                  <span>&middot;</span>
                  <span>{roleLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}
