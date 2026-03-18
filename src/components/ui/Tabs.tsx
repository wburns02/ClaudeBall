import { cn } from '@/lib/cn.ts';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 border-b border-navy-lighter', className)}>
      {tabs.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative px-4 py-2 font-body text-sm transition-colors duration-150 cursor-pointer',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/50 rounded-t',
              isActive
                ? 'text-gold font-semibold'
                : 'text-cream-dim hover:text-cream',
            )}
          >
            {tab.label}
            {/* Gold underline */}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold rounded-t" />
            )}
          </button>
        );
      })}
    </div>
  );
}
