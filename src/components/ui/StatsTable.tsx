import { cn } from '@/lib/cn.ts';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface StatsTableProps {
  columns: Column[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
  className?: string;
  compact?: boolean;
}

export function StatsTable({ columns, rows, className, compact }: StatsTableProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-navy-lighter">
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'text-gold-dim font-semibold uppercase tracking-wider',
                  compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2',
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                'border-b border-navy-lighter/50 hover:bg-navy-lighter/30 transition-colors',
                i % 2 === 1 && 'bg-navy-lighter/15',
              )}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={cn(
                    'text-cream',
                    compact ? 'px-2 py-1' : 'px-3 py-1.5',
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                  )}
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
