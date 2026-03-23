/**
 * AchievementsPage — trophy case showing unlocked and locked achievements.
 */
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { ACHIEVEMENTS, useAchievementStore, tierColor, tierBorder, tierBg, type Achievement } from '@/stores/achievementStore.ts';
import { cn } from '@/lib/cn.ts';

function AchievementCard({ achievement, unlocked, date }: { achievement: Achievement; unlocked: boolean; date?: string }) {
  const color = tierColor(achievement.tier);

  return (
    <div className={cn(
      'rounded-xl border-2 p-3 transition-all duration-300',
      unlocked ? tierBorder(achievement.tier) : 'border-navy-lighter/20',
      unlocked ? tierBg(achievement.tier) : 'bg-navy-lighter/5 opacity-50',
    )}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border',
            unlocked ? tierBorder(achievement.tier) : 'border-navy-lighter/30',
          )}
          style={unlocked ? { backgroundColor: `${color}15`, borderColor: `${color}40` } : {}}
        >
          <span
            className="font-display text-sm font-bold"
            style={{ color: unlocked ? color : '#3a3f4b' }}
          >
            {unlocked ? achievement.icon : '?'}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'font-display text-sm uppercase tracking-wide truncate',
            unlocked ? 'text-cream' : 'text-cream-dim/30',
          )}>
            {unlocked ? achievement.title : (achievement.category === 'hidden' ? '???' : achievement.title)}
          </p>
          <p className="font-mono text-[10px] text-cream-dim/50 mt-0.5">
            {unlocked
              ? achievement.description
              : (achievement.category === 'hidden' ? 'Hidden achievement' : achievement.description)}
          </p>
          {unlocked && date && (
            <p className="font-mono text-[9px] text-cream-dim/30 mt-1">
              Unlocked {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Tier badge */}
        <span
          className={cn('font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0', unlocked ? tierBorder(achievement.tier) : 'border-navy-lighter/20 text-cream-dim/20')}
          style={unlocked ? { color, borderColor: `${color}40` } : {}}
        >
          {achievement.tier}
        </span>
      </div>
    </div>
  );
}

export function AchievementsPage() {
  const navigate = useNavigate();
  const { unlocked, getProgress } = useAchievementStore();
  const progress = getProgress();

  const categories: { key: string; label: string }[] = [
    { key: 'franchise', label: 'Franchise' },
    { key: 'roster', label: 'Roster' },
    { key: 'game', label: 'Game' },
    { key: 'season', label: 'Season' },
    { key: 'hidden', label: 'Hidden' },
  ];

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Achievements</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {progress.unlocked} of {progress.total} unlocked ({progress.pct}%)
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>Back</Button>
      </div>

      {/* Progress bar */}
      <div className="rounded-lg border border-navy-lighter/40 bg-navy-light/60 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider">Completion</p>
          <p className="font-mono text-sm text-gold font-bold">{progress.pct}%</p>
        </div>
        <div className="h-3 bg-navy-lighter/30 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#cd7f32] via-gold to-cyan-300 transition-all duration-1000"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          {(['bronze', 'silver', 'gold', 'diamond'] as const).map(tier => {
            const tierAchs = ACHIEVEMENTS.filter(a => a.tier === tier);
            const tierUnlocked = tierAchs.filter(a => unlocked.some(u => u.id === a.id)).length;
            return (
              <div key={tier} className="text-center">
                <p className="font-mono text-xs font-bold" style={{ color: tierColor(tier) }}>{tierUnlocked}/{tierAchs.length}</p>
                <p className="font-mono text-[8px] text-cream-dim/30 uppercase">{tier}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Achievement categories */}
      {categories.map(cat => {
        const catAchs = ACHIEVEMENTS.filter(a => a.category === cat.key);
        const catUnlocked = catAchs.filter(a => unlocked.some(u => u.id === a.id)).length;
        return (
          <Panel key={cat.key} title={`${cat.label} (${catUnlocked}/${catAchs.length})`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {catAchs.map(ach => {
                const u = unlocked.find(x => x.id === ach.id);
                return (
                  <AchievementCard
                    key={ach.id}
                    achievement={ach}
                    unlocked={!!u}
                    date={u?.unlockedAt}
                  />
                );
              })}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
