/**
 * SeasonStoryPage — narrative retelling of the season as a story.
 * Generates dramatic prose from game results, streaks, trades, and milestones.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { winPct } from '@/engine/season/index.ts';
import { cn } from '@/lib/cn.ts';

interface StoryChapter {
  id: string;
  title: string;
  period: string;
  mood: 'triumph' | 'struggle' | 'neutral' | 'dramatic' | 'historic';
  paragraphs: string[];
  record: string;
  highlight?: string;
}

function chapterMoodStyle(mood: StoryChapter['mood']) {
  switch (mood) {
    case 'triumph': return { border: 'border-green-light/30', bg: 'bg-green-900/10', accent: 'text-green-light', icon: 'W' };
    case 'struggle': return { border: 'border-red-400/30', bg: 'bg-red-900/10', accent: 'text-red-400', icon: 'L' };
    case 'dramatic': return { border: 'border-gold/40', bg: 'bg-gold/5', accent: 'text-gold', icon: '!' };
    case 'historic': return { border: 'border-purple-400/40', bg: 'bg-purple-900/10', accent: 'text-purple-400', icon: '*' };
    default: return { border: 'border-navy-lighter/40', bg: 'bg-navy-lighter/5', accent: 'text-cream', icon: '-' };
  }
}

export function SeasonStoryPage() {
  const navigate = useNavigate();
  const { engine, userTeamId, season, tradeLog } = useFranchiseStore();
  const playerStats = useStatsStore(s => s.playerStats);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  const team = useMemo(() => {
    if (!engine || !userTeamId) return null;
    return engine.getTeam(userTeamId) ?? null;
  }, [engine, userTeamId]);

  const chapters = useMemo(() => {
    if (!engine || !season || !userTeamId || !team) return [];

    const schedule = season.schedule;
    const teamGames = schedule
      .filter(g => g.played && (g.awayId === userTeamId || g.homeId === userTeamId))
      .sort((a, b) => a.date - b.date);

    if (teamGames.length === 0) return [];

    const rec = season.standings.getRecord(userTeamId);
    const teamName = `${team.city} ${team.name}`;
    const abbr = team.abbreviation;

    // Split season into ~6 chapters by game count
    const chapterSize = Math.max(5, Math.ceil(teamGames.length / 6));
    const result: StoryChapter[] = [];

    for (let i = 0; i < teamGames.length; i += chapterSize) {
      const chunk = teamGames.slice(i, i + chapterSize);
      const chapterNum = Math.floor(i / chapterSize) + 1;
      const firstDay = chunk[0]!.date;
      const lastDay = chunk[chunk.length - 1]!.date;

      let wins = 0, losses = 0, runDiff = 0;
      let bestStreak = 0, worstStreak = 0, currentStreak = 0;
      let biggestWin = 0, closestGame = 999;
      let shutouts = 0;

      for (const g of chunk) {
        const isHome = g.homeId === userTeamId;
        const us = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
        const them = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
        const won = us > them;
        const diff = us - them;
        runDiff += diff;

        if (won) { wins++; currentStreak = Math.max(0, currentStreak) + 1; bestStreak = Math.max(bestStreak, currentStreak); }
        else { losses++; currentStreak = Math.min(0, currentStreak) - 1; worstStreak = Math.max(worstStreak, Math.abs(currentStreak)); }

        biggestWin = Math.max(biggestWin, diff);
        if (Math.abs(diff) < closestGame) closestGame = Math.abs(diff);
        if (them === 0 && us > 0) shutouts++;
      }

      const pct = wins / Math.max(1, wins + losses);
      const mood: StoryChapter['mood'] =
        pct >= 0.7 ? 'triumph' :
        pct <= 0.35 ? 'struggle' :
        bestStreak >= 5 || worstStreak >= 5 ? 'dramatic' :
        shutouts >= 2 || biggestWin >= 8 ? 'historic' :
        'neutral';

      // Generate narrative
      const paras: string[] = [];
      const periodLabel = chapterNum === 1 ? 'Opening Day' :
        chapterNum <= 2 ? 'Early Season' :
        chapterNum <= 3 ? 'First Half' :
        chapterNum <= 4 ? 'Midseason' :
        chapterNum <= 5 ? 'Stretch Run' :
        'Final Push';

      // Opening paragraph
      if (mood === 'triumph') {
        paras.push(`The ${teamName} were dominant during this stretch, posting a ${wins}-${losses} record. The offense was clicking and the pitching staff held firm, outscoring opponents by ${runDiff > 0 ? '+' : ''}${runDiff} runs over ${chunk.length} games.`);
      } else if (mood === 'struggle') {
        paras.push(`A difficult stretch for the ${teamName}, who stumbled to a ${wins}-${losses} mark. The team couldn't find its footing, falling ${Math.abs(runDiff)} runs behind in the run differential over ${chunk.length} contests.`);
      } else if (mood === 'dramatic') {
        paras.push(`An emotional rollercoaster for the ${teamName}. The team went ${wins}-${losses} in a stretch defined by momentum swings — ${bestStreak >= 4 ? `a ${bestStreak}-game winning streak` : ''} ${bestStreak >= 4 && worstStreak >= 4 ? 'countered by ' : ''}${worstStreak >= 4 ? `a ${worstStreak}-game skid` : ''}.`);
      } else {
        paras.push(`The ${teamName} went ${wins}-${losses} during this period, keeping pace in a competitive ${season.year} campaign. Run differential: ${runDiff > 0 ? '+' : ''}${runDiff}.`);
      }

      // Detail paragraph
      if (bestStreak >= 4) paras.push(`Highlight: A ${bestStreak}-game winning streak electrified the clubhouse and pushed the ${abbr} up in the standings.`);
      if (worstStreak >= 4) paras.push(`Low point: The team dropped ${worstStreak} straight, testing the resolve of the roster and coaching staff.`);
      if (shutouts >= 2) paras.push(`The pitching staff was dominant, recording ${shutouts} shutout${shutouts > 1 ? 's' : ''} during this stretch.`);
      if (biggestWin >= 8) paras.push(`The ${abbr} put on a show with a ${biggestWin}-run blowout victory — the kind of game that makes a statement.`);
      if (closestGame <= 1 && chunk.length > 3) paras.push(`Several nail-biters defined this period — at least one game was decided by a single run.`);

      // Trade deadline chapter if applicable
      if (firstDay <= 120 && lastDay >= 110) {
        const tradeCount = tradeLog.filter(t => t.day >= firstDay && t.day <= lastDay).length;
        if (tradeCount > 0) paras.push(`The trade deadline loomed large. ${tradeCount} deal${tradeCount > 1 ? 's' : ''} went down around the league as teams made their moves.`);
        else paras.push('The trade deadline passed quietly, with the front office choosing to stand pat.');
      }

      result.push({
        id: `ch-${chapterNum}`,
        title: `Chapter ${chapterNum}: ${periodLabel}`,
        period: `Day ${firstDay}–${lastDay}`,
        mood,
        paragraphs: paras,
        record: `${wins}-${losses}`,
        highlight: bestStreak >= 5 ? `${bestStreak}-game win streak` :
          shutouts >= 2 ? `${shutouts} shutouts` :
          biggestWin >= 8 ? `${biggestWin}-run blowout` :
          undefined,
      });
    }

    return result;
  }, [engine, season, userTeamId, team, tradeLog]);

  if (!team || !season) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="font-display text-gold text-xl">Season Story</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          A narrative retelling of your season — the triumphs, the struggles, and the moments that defined it.
        </p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const rec = season.standings.getRecord(userTeamId!);
  const totalGames = chapters.reduce((s, c) => {
    const [w, l] = c.record.split('-').map(Number);
    return s + (w ?? 0) + (l ?? 0);
  }, 0);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3 pt-4">
        <p className="font-mono text-[10px] text-gold/50 uppercase tracking-[0.3em]">{season.year} Season</p>
        <h1 className="font-display text-4xl text-gold uppercase tracking-wide">Season Story</h1>
        <p className="font-mono text-cream-dim text-sm">
          {team.city} {team.name} · {rec ? `${rec.wins}-${rec.losses}` : '—'} · {totalGames} games played
        </p>
        <div className="w-24 h-0.5 bg-gold/30 mx-auto" />
      </div>

      {/* Prologue */}
      <Panel>
        <div className="text-center py-4">
          <p className="font-body text-cream leading-relaxed max-w-lg mx-auto">
            {totalGames >= 150 ? 'The' : 'So far, the'} {season.year} {team.city} {team.name} season {totalGames >= 150 ? 'was' : 'has been'}{' '}
            {rec && rec.wins - rec.losses >= 20 ? 'a dominant campaign that left the league in awe' :
             rec && rec.wins > rec.losses ? 'a tale of resilience and triumph' :
             rec && rec.losses - rec.wins >= 20 ? 'a long rebuilding year that tested the franchise\'s patience' :
             rec && rec.wins < rec.losses ? 'a challenging journey through adversity' :
             'a season of tight margins and razor-thin competitive play'}.
            {totalGames >= 150
              ? ` Over ${totalGames} games, this is how their story unfolded.`
              : ` Through ${totalGames} games, here's the story so far.`}
          </p>
        </div>
      </Panel>

      {/* Chapters */}
      {chapters.map((ch, idx) => {
        const style = chapterMoodStyle(ch.mood);
        const isExpanded = expandedChapter === ch.id;
        return (
          <div key={ch.id} className={cn('rounded-xl border-2 transition-all duration-300', style.border, style.bg)}>
            {/* Chapter header */}
            <button
              onClick={() => setExpandedChapter(isExpanded ? null : ch.id)}
              className="w-full text-left px-5 py-4 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border', style.border, style.accent)}>{style.icon}</span>
                    <span className="font-mono text-[10px] text-cream-dim/50">{ch.period}</span>
                  </div>
                  <h3 className={cn('font-display text-lg uppercase tracking-wide', style.accent)}>{ch.title}</h3>
                  {ch.highlight && (
                    <span className={cn('inline-block mt-1 font-mono text-[10px] px-2 py-0.5 rounded border', style.border, style.accent)}>
                      {ch.highlight}
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('font-mono text-lg font-bold', style.accent)}>{ch.record}</p>
                  <p className={cn('font-mono text-[10px] mt-1', isExpanded ? 'text-cream-dim/50' : 'text-gold/50 underline underline-offset-2')}>{isExpanded ? '- collapse' : '+ read more'}</p>
                </div>
              </div>
            </button>

            {/* Expanded narrative */}
            {isExpanded && (
              <div className="px-5 pb-5 border-t border-navy-lighter/20 pt-4 space-y-3">
                {ch.paragraphs.map((p, i) => (
                  <p key={i} className="font-body text-sm text-cream/80 leading-relaxed">{p}</p>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {chapters.length === 0 && (
        <Panel>
          <div className="text-center py-12">
            <p className="font-display text-cream-dim text-lg">No story yet</p>
            <p className="font-mono text-cream-dim/40 text-xs mt-2">
              Simulate games from the Dashboard to start writing your season's story.
            </p>
          </div>
        </Panel>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 justify-center pb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/season-review')}>Season Review</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/highlights')}>League Highlights</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/timeline')}>Season Timeline</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise')}>Dashboard</Button>
      </div>
    </div>
  );
}
