/**
 * AchievementToast — animated notification when an achievement unlocks.
 * Shows a slide-up card with the achievement details that auto-dismisses.
 */
import { useEffect, useState } from 'react';
import { useAchievementStore, ACHIEVEMENTS, tierColor, tierBorder, tierBg } from '@/stores/achievementStore.ts';
import { cn } from '@/lib/cn.ts';

export function AchievementToast() {
  const recentUnlock = useAchievementStore(s => s.recentUnlock);
  const clearRecent = useAchievementStore(s => s.clearRecent);
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (recentUnlock && recentUnlock !== current) {
      setCurrent(recentUnlock);
      setVisible(true);
      const t = setTimeout(() => { setVisible(false); clearRecent(); }, 4000);
      return () => clearTimeout(t);
    }
  }, [recentUnlock, current, clearRecent]);

  if (!visible || !current) return null;

  const ach = ACHIEVEMENTS.find(a => a.id === current);
  if (!ach) return null;

  const color = tierColor(ach.tier);

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-[200] max-w-xs',
        'animate-in slide-in-from-bottom-4 fade-in duration-500',
      )}
    >
      <div className={cn(
        'rounded-xl border-2 p-4 shadow-2xl backdrop-blur-sm',
        tierBorder(ach.tier), tierBg(ach.tier),
        'bg-navy-light/95',
      )}>
        <div className="flex items-start gap-3">
          <div
            className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border', tierBorder(ach.tier))}
            style={{ backgroundColor: `${color}20`, borderColor: `${color}50` }}
          >
            <span className="font-display text-sm font-bold" style={{ color }}>{ach.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color }}>Achievement Unlocked!</p>
            <p className="font-display text-sm text-cream uppercase tracking-wide mt-0.5">{ach.title}</p>
            <p className="font-mono text-[10px] text-cream-dim/60 mt-0.5">{ach.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
