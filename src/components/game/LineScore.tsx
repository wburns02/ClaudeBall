import type { GameState } from '@/engine/types/index.ts';
import { cn } from '@/lib/cn.ts';

interface LineScoreProps {
  game: GameState;
}

export function LineScore({ game }: LineScoreProps) {
  const maxInnings = Math.max(game.score.away.length, game.score.home.length, 9);

  const awayR = game.score.away.reduce((a, b) => a + b, 0);
  const homeR = game.score.home.reduce((a, b) => a + b, 0);

  const awayH = game.boxScore.awayBatters.reduce((a, b) => a + b.h, 0);
  const homeH = game.boxScore.homeBatters.reduce((a, b) => a + b.h, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-navy-lighter">
            <th className="text-left px-3 py-1.5 text-gold-dim w-24">Team</th>
            {Array.from({ length: maxInnings }, (_, i) => (
              <th key={i} className="px-2 py-1.5 text-center text-gold-dim w-8">{i + 1}</th>
            ))}
            <th className="px-2 py-1.5 text-center text-gold font-bold border-l border-navy-lighter w-8">R</th>
            <th className="px-2 py-1.5 text-center text-gold-dim w-8">H</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-navy-lighter/50">
            <td className="px-3 py-1.5 text-cream font-semibold">{game.away.abbreviation}</td>
            {Array.from({ length: maxInnings }, (_, i) => (
              <td key={i} className={cn('px-2 py-1.5 text-center', game.score.away[i] !== undefined ? 'text-cream' : 'text-cream-dim/30')}>
                {game.score.away[i] ?? '-'}
              </td>
            ))}
            <td className="px-2 py-1.5 text-center font-bold text-gold border-l border-navy-lighter">{awayR}</td>
            <td className="px-2 py-1.5 text-center text-cream">{awayH}</td>
          </tr>
          <tr>
            <td className="px-3 py-1.5 text-cream font-semibold">{game.home.abbreviation}</td>
            {Array.from({ length: maxInnings }, (_, i) => (
              <td key={i} className={cn('px-2 py-1.5 text-center', game.score.home[i] !== undefined ? 'text-cream' : 'text-cream-dim/30')}>
                {game.score.home[i] ?? '-'}
              </td>
            ))}
            <td className="px-2 py-1.5 text-center font-bold text-gold border-l border-navy-lighter">{homeR}</td>
            <td className="px-2 py-1.5 text-center text-cream">{homeH}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
