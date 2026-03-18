import type { GameState } from '@/engine/types/index.ts';
import { StatsTable } from '@/components/ui/StatsTable.tsx';
import { Panel } from '@/components/ui/Panel.tsx';

const BATTER_COLS = [
  { key: 'name', label: 'Player', align: 'left' as const, width: '160px' },
  { key: 'position', label: 'Pos', align: 'center' as const },
  { key: 'ab', label: 'AB', align: 'right' as const },
  { key: 'r', label: 'R', align: 'right' as const },
  { key: 'h', label: 'H', align: 'right' as const },
  { key: 'rbi', label: 'RBI', align: 'right' as const },
  { key: 'bb', label: 'BB', align: 'right' as const },
  { key: 'so', label: 'SO', align: 'right' as const },
  { key: 'hr', label: 'HR', align: 'right' as const },
  { key: 'avg', label: 'AVG', align: 'right' as const },
];

const PITCHER_COLS = [
  { key: 'name', label: 'Pitcher', align: 'left' as const, width: '160px' },
  { key: 'decision', label: 'Dec', align: 'center' as const },
  { key: 'ip', label: 'IP', align: 'right' as const },
  { key: 'h', label: 'H', align: 'right' as const },
  { key: 'r', label: 'R', align: 'right' as const },
  { key: 'er', label: 'ER', align: 'right' as const },
  { key: 'bb', label: 'BB', align: 'right' as const },
  { key: 'so', label: 'SO', align: 'right' as const },
  { key: 'hr', label: 'HR', align: 'right' as const },
  { key: 'pitchCount', label: 'PC', align: 'right' as const },
];

interface BoxScoreTableProps {
  game: GameState;
}

export function BoxScoreTable({ game }: BoxScoreTableProps) {
  const { boxScore } = game;

  return (
    <div className="space-y-4">
      <Panel title={`${game.away.city} ${game.away.name}`}>
        <StatsTable columns={BATTER_COLS} rows={boxScore.awayBatters} compact />
        <div className="mt-3 pt-3 border-t border-navy-lighter">
          <StatsTable columns={PITCHER_COLS} rows={boxScore.awayPitchers} compact />
        </div>
      </Panel>

      <Panel title={`${game.home.city} ${game.home.name}`}>
        <StatsTable columns={BATTER_COLS} rows={boxScore.homeBatters} compact />
        <div className="mt-3 pt-3 border-t border-navy-lighter">
          <StatsTable columns={PITCHER_COLS} rows={boxScore.homePitchers} compact />
        </div>
      </Panel>
    </div>
  );
}
