import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import type { Team } from '@/engine/types/index.ts';

// ── 20-80 Scout Grade System ─────────────────────────────────────────────────
function to80(val: number): number {
  // Linear mapping from 0-100 → 20-80, rounded to nearest 5 (standard scouting steps)
  const raw = 20 + (val / 100) * 60;
  return Math.round(Math.max(20, Math.min(80, raw)) / 5) * 5;
}

function gradeLabel(g: number): string {
  if (g >= 80) return 'ELITE';
  if (g >= 70) return 'PLUS+';
  if (g >= 60) return 'PLUS';
  if (g >= 50) return 'AVG';
  if (g >= 45) return 'BLW';
  if (g >= 40) return 'FRG';
  if (g >= 30) return 'POOR';
  return 'N/A';
}

function gradeColor(g: number): string {
  if (g >= 70) return 'text-gold';
  if (g >= 60) return 'text-green-light';
  if (g >= 50) return 'text-cream';
  if (g >= 45) return 'text-cream-dim';
  return 'text-red-400';
}

function gradeBarColor(g: number): string {
  if (g >= 70) return 'bg-gold';
  if (g >= 60) return 'bg-green-light';
  if (g >= 50) return 'bg-cream-dim';
  if (g >= 45) return 'bg-cream-dim/50';
  return 'bg-red-400/60';
}

interface HitterGrades {
  hit: number; power: number; run: number; field: number; arm: number; eye: number;
}
interface PitcherGrades {
  velo: number; stuff: number; movement: number; control: number; stamina: number;
}

function getHitterGrades(p: Player): HitterGrades {
  const b = p.batting;
  const primaryField = p.fielding[0];
  return {
    hit: to80((b.contact_L + b.contact_R) / 2),
    power: to80((b.power_L + b.power_R) / 2),
    run: to80(b.speed),
    field: primaryField ? to80(primaryField.range) : 40,
    arm: primaryField ? to80(primaryField.arm_strength) : 40,
    eye: to80(b.eye),
  };
}

function getPitcherGrades(p: Player): PitcherGrades {
  const pi = p.pitching;
  const veloGrade = Math.max(20, Math.min(80,
    Math.round(((pi.velocity - 85) / (100 - 85)) * 60 + 20)
  ));
  return {
    velo: veloGrade,
    stuff: to80(pi.stuff),
    movement: to80(pi.movement),
    control: to80(pi.control),
    stamina: to80(pi.stamina),
  };
}

function isPitcherPos(pos: string): boolean {
  return pos === 'P' || pos === 'SP' || pos === 'RP';
}

function overallGrade(p: Player): number {
  if (isPitcherPos(p.position)) {
    const g = getPitcherGrades(p);
    return Math.round((g.velo + g.stuff + g.movement + g.control + g.stamina) / 5);
  }
  const g = getHitterGrades(p);
  return Math.round((g.hit + g.power + g.run + g.field + g.arm + g.eye) / 6);
}

function letterGrade(overall: number): string {
  if (overall >= 70) return 'A+';
  if (overall >= 65) return 'A';
  if (overall >= 60) return 'A-';
  if (overall >= 57) return 'B+';
  if (overall >= 54) return 'B';
  if (overall >= 51) return 'B-';
  if (overall >= 48) return 'C+';
  if (overall >= 45) return 'C';
  if (overall >= 42) return 'C-';
  if (overall >= 39) return 'D+';
  if (overall >= 36) return 'D';
  return 'F';
}

function letterGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-gold';
  if (grade.startsWith('B')) return 'text-green-light';
  if (grade.startsWith('C')) return 'text-cream';
  return 'text-red-400';
}

function projectionLabel(overall: number, age: number): string {
  if (age <= 24 && overall >= 60) return '★ Future Ace';
  if (age <= 26 && overall >= 58) return '★ Future Star';
  if (overall >= 65) return '◆ All-Star Cal.';
  if (age <= 25 && overall >= 52) return '▲ High Upside';
  if (age >= 33 && overall <= 48) return '▼ Fading Vet';
  if (age >= 30 && overall >= 55) return '◆ Proven Vet';
  if (overall >= 50) return '— Regular';
  return '○ Depth / 4A';
}

function projectionColor(label: string): string {
  if (label.includes('Ace') || label.includes('All-Star')) return 'text-gold';
  if (label.includes('Future Star')) return 'text-gold';
  if (label.includes('High Upside')) return 'text-green-light';
  if (label.includes('Proven Vet')) return 'text-cream';
  if (label.includes('Fading')) return 'text-red-400';
  return 'text-cream-dim';
}

// ── Grade Bar ────────────────────────────────────────────────────────────────
function GradeBar({ label, grade }: { label: string; grade: number }) {
  const pct = ((grade - 20) / 60) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-cream-dim/50 w-10 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-navy-lighter/30 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', gradeBarColor(grade))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-xs font-mono font-bold w-5 text-right', gradeColor(grade))}>
        {grade}
      </span>
      <span className="text-[9px] font-mono text-cream-dim/30 w-8">{gradeLabel(grade)}</span>
    </div>
  );
}

// ── Player Scout Card ────────────────────────────────────────────────────────
function ScoutCard({
  player, team, onSelect, selected,
}: {
  player: Player; team: Team; onSelect: (p: Player) => void; selected: boolean;
}) {
  const isP = isPitcherPos(player.position);
  const overall = overallGrade(player);
  const letter = letterGrade(overall);
  const proj = projectionLabel(overall, player.age);
  const hGrades = !isP ? getHitterGrades(player) : null;
  const pGrades = isP ? getPitcherGrades(player) : null;

  return (
    <div
      onClick={() => onSelect(player)}
      className={cn(
        'rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.01]',
        'hover:border-gold/40 hover:bg-navy-lighter/20',
        selected
          ? 'border-gold bg-gold/5 shadow-[0_0_20px_rgba(212,168,67,0.12)]'
          : 'border-navy-lighter bg-navy-light/20',
      )}
    >
      <div className="px-3 pt-3 pb-2 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className={cn(
              'inline-block px-1.5 py-px rounded text-[9px] font-bold font-mono uppercase',
              isP ? 'bg-blue-400/20 text-blue-400' : 'bg-green-light/20 text-green-light'
            )}>
              {player.position === 'P' ? 'P' : player.position}
            </span>
            <span className="text-[10px] font-mono text-cream-dim/40">
              Age {player.age} · {team.abbreviation}
            </span>
          </div>
          <p className="font-display text-cream text-sm tracking-wide leading-tight">
            {player.firstName} {player.lastName}
          </p>
          <p className={cn('text-[10px] font-mono mt-0.5', projectionColor(proj))}>
            {proj}
          </p>
        </div>
        <div className="text-center shrink-0 ml-2">
          <div className={cn('text-2xl font-display font-bold leading-none', letterGradeColor(letter))}>
            {letter}
          </div>
          <div className="text-[9px] font-mono text-cream-dim/40">{overall}</div>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-1">
        {hGrades && (
          <>
            <GradeBar label="HIT" grade={hGrades.hit} />
            <GradeBar label="PWR" grade={hGrades.power} />
            <GradeBar label="SPD" grade={hGrades.run} />
            <GradeBar label="FLD" grade={hGrades.field} />
            <GradeBar label="EYE" grade={hGrades.eye} />
          </>
        )}
        {pGrades && (
          <>
            <GradeBar label="VELO" grade={pGrades.velo} />
            <GradeBar label="STF" grade={pGrades.stuff} />
            <GradeBar label="MOV" grade={pGrades.movement} />
            <GradeBar label="CTL" grade={pGrades.control} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Team Needs ───────────────────────────────────────────────────────────────
function TeamNeedsPanel({ userTeam }: { userTeam: Team }) {
  const POS_LIST = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P'] as const;
  const posStrength = POS_LIST.map(pos => {
    const posPlayers = userTeam.roster.players.filter(p => p.position === pos);
    if (posPlayers.length === 0) return { pos, grade: 20, count: 0 };
    const best = Math.max(...posPlayers.map(overallGrade));
    return { pos, grade: best, count: posPlayers.length };
  });

  return (
    <Panel title="Team Needs Analysis" className="mb-0">
      <p className="text-xs font-mono text-cream-dim/50 mb-3">
        Best player grade at each position. Red = upgrade needed.
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {posStrength.map(({ pos, grade, count }) => {
          const letter = count === 0 ? '—' : letterGrade(grade);
          return (
            <div key={pos} className={cn(
              'rounded-lg px-2 py-1.5 border text-center',
              count === 0 ? 'border-red-400/30 bg-red-400/5' :
              grade >= 60 ? 'border-green-light/30 bg-green-light/5' :
              grade >= 50 ? 'border-navy-lighter/50 bg-navy-lighter/10' :
              grade >= 42 ? 'border-gold/20 bg-gold/5' :
              'border-red-400/30 bg-red-400/5',
            )}>
              <div className="text-[10px] font-mono text-cream-dim/60 mb-0.5">{pos}</div>
              <div className={cn('text-base font-display font-bold', letterGradeColor(letter))}>
                {letter}
              </div>
              {(count === 0 || grade < 45) && (
                <div className="text-[8px] text-gold mt-0.5">NEED</div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Detailed Report ──────────────────────────────────────────────────────────
function DetailedReport({ player, team }: { player: Player; team: Team }) {
  const isP = isPitcherPos(player.position);
  const overall = overallGrade(player);
  const letter = letterGrade(overall);
  const proj = projectionLabel(overall, player.age);
  const hGrades = !isP ? getHitterGrades(player) : null;
  const pGrades = isP ? getPitcherGrades(player) : null;
  const floorGrade = Math.max(20, overall - 10);
  const ceilingGrade = Math.min(80, overall + (player.age <= 25 ? 15 : player.age <= 28 ? 8 : 4));

  function assessment(): string {
    const name = `${player.firstName} ${player.lastName}`;
    const teamStr = `${team.city} ${team.name}`;
    if (isP && pGrades) {
      const veloStr = player.pitching.velocity >= 96 ? 'electric fastball' :
        player.pitching.velocity >= 93 ? 'plus fastball' :
        player.pitching.velocity >= 90 ? 'solid fastball' : 'fringy velocity';
      const ctrlStr = pGrades.control >= 60 ? 'plus command' :
        pGrades.control >= 50 ? 'average command' : 'below-average control';
      const outlook = player.age <= 26 ? 'Youth gives him real projection upside.' :
        player.age >= 34 ? 'Likely in the back nine of his career.' :
        'In the heart of his prime.';
      return `${name} (${player.position}, ${teamStr}) features a ${veloStr} at ${player.pitching.velocity} mph paired with ${ctrlStr}. ${outlook}`;
    }
    if (hGrades) {
      const hitStr = hGrades.hit >= 60 ? 'plus bat-to-ball skills' :
        hGrades.hit >= 50 ? 'solid contact ability' : 'below-average contact';
      const pwrStr = hGrades.power >= 60 ? 'plus raw power' :
        hGrades.power >= 50 ? 'average power' : 'limited pop';
      const outlook = player.age <= 25 ? 'Still maturing — ceiling likely higher than current grades.' :
        player.age >= 33 ? 'Skills declining, production window narrowing.' :
        'Entering his prime production years.';
      return `${name} (${player.position}, ${teamStr}) brings ${hitStr} and ${pwrStr} to the lineup. ${outlook}`;
    }
    return `${name} is a ${player.position} for the ${teamStr}.`;
  }

  const batsThrowsStr = `${player.bats === 'L' ? 'L' : player.bats === 'S' ? 'S' : 'R'} / ${player.throws === 'L' ? 'L' : 'R'}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn(
              'inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase',
              isP ? 'bg-blue-400/20 text-blue-400' : 'bg-green-light/20 text-green-light'
            )}>
              {player.position}
            </span>
            <span className="text-xs font-mono text-cream-dim/50">
              #{player.number} · Age {player.age} · B/T: {batsThrowsStr}
            </span>
          </div>
          <h2 className="font-display text-2xl text-gold tracking-wide leading-tight">
            {player.firstName} {player.lastName}
          </h2>
          <p className="font-mono text-cream-dim/60 text-xs mt-0.5">
            {team.city} {team.name}
          </p>
        </div>
        <div className="text-center shrink-0">
          <div className={cn('text-5xl font-display font-bold leading-none', letterGradeColor(letter))}>
            {letter}
          </div>
          <div className="text-xs font-mono text-cream-dim/40 mt-0.5">{overall}/80</div>
        </div>
      </div>

      {/* Projection */}
      <div className="rounded-lg border border-navy-lighter bg-navy-light/30 p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono text-cream-dim/50 uppercase tracking-wider">Projection</span>
          <span className={cn('text-xs font-mono font-bold', projectionColor(proj))}>{proj}</span>
        </div>
        <div className="flex items-center gap-3 justify-around">
          {[
            { label: 'Floor', g: floorGrade },
            { label: 'Current', g: overall },
            { label: 'Ceiling', g: ceilingGrade },
          ].map(({ label, g }, i, arr) => (
            <div key={label} className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-[10px] font-mono text-cream-dim/40 mb-1">{label}</div>
                <div className={cn('text-xl font-display font-bold', letterGradeColor(letterGrade(g)))}>
                  {letterGrade(g)}
                </div>
                <div className="text-[10px] font-mono text-cream-dim/40">{g}</div>
              </div>
              {i < arr.length - 1 && <div className="w-px h-10 bg-navy-lighter" />}
            </div>
          ))}
        </div>
      </div>

      {/* Tool Grades */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono text-cream-dim/50 uppercase tracking-wider">20-80 Tool Grades</p>
        {hGrades && (
          <>
            <GradeBar label="HIT" grade={hGrades.hit} />
            <GradeBar label="POWER" grade={hGrades.power} />
            <GradeBar label="RUN" grade={hGrades.run} />
            <GradeBar label="FIELD" grade={hGrades.field} />
            <GradeBar label="ARM" grade={hGrades.arm} />
            <GradeBar label="EYE" grade={hGrades.eye} />
          </>
        )}
        {pGrades && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <GradeBar label="VELO" grade={pGrades.velo} />
              </div>
              <span className="text-[10px] font-mono text-cream-dim/40 shrink-0">
                {player.pitching.velocity} mph
              </span>
            </div>
            <GradeBar label="STUFF" grade={pGrades.stuff} />
            <GradeBar label="MOVE" grade={pGrades.movement} />
            <GradeBar label="CTRL" grade={pGrades.control} />
            <GradeBar label="STAM" grade={pGrades.stamina} />
          </>
        )}
      </div>

      {/* Scout Assessment */}
      <div className="rounded-lg border border-navy-lighter bg-navy-light/20 p-3">
        <p className="text-[10px] font-mono text-cream-dim/50 uppercase tracking-wider mb-2">Scout Assessment</p>
        <p className="text-sm font-mono text-cream-dim/80 leading-relaxed">{assessment()}</p>
      </div>

      {/* Intangibles */}
      <div className="rounded-lg border border-navy-lighter bg-navy-light/20 p-3">
        <p className="text-[10px] font-mono text-cream-dim/50 uppercase tracking-wider mb-2">Intangibles</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Work Ethic', val: player.mental.work_ethic },
            { label: 'Composure', val: player.mental.composure },
            { label: 'Leadership', val: player.mental.leadership },
            { label: 'Durability', val: player.mental.durability },
            { label: 'Consistency', val: player.mental.consistency },
            { label: 'Intel', val: player.mental.intelligence },
          ].map(({ label, val }) => (
            <div key={label}>
              <div className={cn('text-lg font-mono font-bold', gradeColor(to80(val)))}>{to80(val)}</div>
              <div className="text-[9px] font-mono text-cream-dim/40">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
type ViewMode = 'roster' | 'league' | 'prospects';
type SortMode = 'overall' | 'age' | 'position' | 'name';

export function ScoutingPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId } = useFranchiseStore();

  const [view, setView] = useState<ViewMode>('roster');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPlayerTeam, setSelectedPlayerTeam] = useState<Team | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('overall');
  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(36);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => navigate('/')}>Back to Menu</Button>
      </div>
    );
  }

  const userTeam = engine.getTeam(userTeamId);
  const allTeams = engine.getAllTeams();

  // All players across the league with their team
  const allLeaguePlayers = useMemo((): { player: Player; team: Team }[] => {
    const result: { player: Player; team: Team }[] = [];
    for (const team of allTeams) {
      for (const player of team.roster.players) {
        result.push({ player, team });
      }
    }
    return result;
  }, [allTeams]);

  // Top prospects (age <= 27, not on user team)
  const topProspects = useMemo(() => {
    return allLeaguePlayers
      .filter(({ player, team }) => team.id !== userTeamId && player.age <= 27)
      .map(({ player, team }) => ({
        player,
        team,
        score: overallGrade(player) + Math.max(0, 27 - player.age) * 0.5,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }, [allLeaguePlayers, userTeamId]);

  // Displayed player pool based on view
  const playerPool = useMemo((): { player: Player; team: Team }[] => {
    if (view === 'roster') {
      return userTeam ? userTeam.roster.players.map(p => ({ player: p, team: userTeam })) : [];
    }
    if (view === 'prospects') {
      return topProspects.map(({ player, team }) => ({ player, team }));
    }
    return allLeaguePlayers;
  }, [view, userTeam, allLeaguePlayers, topProspects]);

  // Apply position filter + search + sort
  const displayedPlayers = useMemo(() => {
    let filtered = playerPool;
    if (posFilter !== 'ALL') {
      filtered = filtered.filter(({ player }) => player.position === posFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(({ player }) =>
        `${player.firstName} ${player.lastName}`.toLowerCase().includes(q) ||
        player.position.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      if (sortMode === 'overall') return overallGrade(b.player) - overallGrade(a.player);
      if (sortMode === 'age') return a.player.age - b.player.age;
      if (sortMode === 'position') return a.player.position.localeCompare(b.player.position);
      return a.player.lastName.localeCompare(b.player.lastName);
    });
  }, [playerPool, posFilter, searchQuery, sortMode]);

  function handleSelect(p: Player) {
    setSelectedPlayer(p);
    const found = allLeaguePlayers.find(({ player }) => player.id === p.id);
    setSelectedPlayerTeam(found?.team ?? null);
  }

  const POSITIONS = ['ALL', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

  // Summary stats
  const avgGrade = displayedPlayers.length > 0
    ? Math.round(displayedPlayers.reduce((sum, { player }) => sum + overallGrade(player), 0) / displayedPlayers.length)
    : 0;
  const elites = displayedPlayers.filter(({ player }) => overallGrade(player) >= 60).length;

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Scouting Hub</h1>
          <p className="font-mono text-cream-dim text-sm mt-0.5">
            20-80 Tool Grades · Projections · Needs Analysis
          </p>
        </div>
        {/* View tabs */}
        <div className="flex items-center gap-1 bg-navy-lighter/30 rounded-xl p-1">
          {(['roster', 'league', 'prospects'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => { setView(v); setSelectedPlayer(null); setVisibleCount(36); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all',
                view === v ? 'bg-gold text-navy shadow-[0_1px_3px_rgba(0,0,0,0.3)]' : 'text-cream-dim hover:text-cream',
              )}
            >
              {v === 'roster' ? 'My Roster' : v === 'league' ? 'League' : 'Prospects'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        {/* ── Left Column ────────────────────────────────────────── */}
        <div className="space-y-4 min-w-0">
          {/* Team Needs */}
          {view === 'roster' && userTeam && <TeamNeedsPanel userTeam={userTeam} />}

          {/* Stats bar */}
          {displayedPlayers.length > 0 && (
            <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-navy-lighter/20 border border-navy-lighter/30">
              <div>
                <span className="text-[10px] font-mono text-cream-dim/50 uppercase">Players</span>
                <div className="text-lg font-mono font-bold text-cream">{displayedPlayers.length}</div>
              </div>
              <div className="w-px h-8 bg-navy-lighter/50" />
              <div>
                <span className="text-[10px] font-mono text-cream-dim/50 uppercase">Avg Grade</span>
                <div className={cn('text-lg font-mono font-bold', gradeColor(avgGrade))}>{avgGrade}</div>
              </div>
              <div className="w-px h-8 bg-navy-lighter/50" />
              <div>
                <span className="text-[10px] font-mono text-cream-dim/50 uppercase">60+ Grade</span>
                <div className="text-lg font-mono font-bold text-green-light">{elites}</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search player..."
              className="px-3 py-1.5 rounded-lg bg-navy-lighter/30 border border-navy-lighter text-sm font-mono text-cream placeholder-cream-dim/25 focus:outline-none focus:border-gold/40 flex-1 min-w-[120px]"
            />
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="px-2 py-1.5 rounded-lg bg-navy-lighter/30 border border-navy-lighter text-xs font-mono text-cream focus:outline-none focus:border-gold/40"
            >
              <option value="overall">↓ Overall</option>
              <option value="age">Age ↑</option>
              <option value="position">Position</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>

          {/* Position pills */}
          <div className="flex flex-wrap gap-1.5">
            {POSITIONS.map(pos => (
              <button
                key={pos}
                onClick={() => { setPosFilter(pos); setVisibleCount(36); }}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all',
                  posFilter === pos
                    ? 'bg-gold/20 text-gold border border-gold/40'
                    : 'bg-navy-lighter/20 text-cream-dim/50 border border-transparent hover:text-cream hover:bg-navy-lighter/40',
                )}
              >
                {pos}
              </button>
            ))}
          </div>

          {/* Player grid */}
          {displayedPlayers.length === 0 ? (
            <Panel>
              <p className="font-mono text-cream-dim text-sm text-center py-8">
                No players match your filters.
              </p>
            </Panel>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayedPlayers.slice(0, visibleCount).map(({ player, team }) => (
                  <ScoutCard
                    key={player.id}
                    player={player}
                    team={team}
                    onSelect={handleSelect}
                    selected={selectedPlayer?.id === player.id}
                  />
                ))}
              </div>
              {displayedPlayers.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount(c => c + 36)}
                  className="w-full mt-3 py-2 font-mono text-xs text-cream-dim/50 hover:text-cream-dim border border-dashed border-navy-lighter/60 hover:border-navy-lighter rounded-lg transition-all"
                >
                  ▼ Show more ({displayedPlayers.length - visibleCount} remaining)
                </button>
              )}
              {visibleCount > 36 && (
                <button
                  onClick={() => setVisibleCount(36)}
                  className="w-full py-1 font-mono text-xs text-cream-dim/30 hover:text-cream-dim/50 transition-colors"
                >
                  ▲ Collapse
                </button>
              )}
            </>
          )}
          {displayedPlayers.length > 36 && (
            <p className="text-xs font-mono text-cream-dim/30 text-center">
              Showing 36 of {displayedPlayers.length} — use filters to narrow results.
            </p>
          )}
        </div>

        {/* ── Right Column ───────────────────────────────────────── */}
        <div className="xl:sticky xl:top-6 xl:self-start space-y-4">
          {selectedPlayer && selectedPlayerTeam ? (
            <Panel className="transition-all">
              <DetailedReport player={selectedPlayer} team={selectedPlayerTeam} />
              <div className="mt-4 pt-3 border-t border-navy-lighter/30">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedPlayer(null)}>
                  Dismiss Report
                </Button>
              </div>
            </Panel>
          ) : (
            <Panel>
              <div className="text-center py-10 px-4 space-y-3">
                <div className="text-4xl">🔭</div>
                <p className="font-display text-gold text-lg tracking-wide">Scout Report</p>
                <p className="font-mono text-cream-dim/60 text-xs leading-relaxed">
                  Click any player card to open their full scouting report with 20-80 tool grades,
                  floor/ceiling projection, velocity, and a scout's written assessment.
                </p>
              </div>
            </Panel>
          )}

          {/* Grade Scale */}
          <div className="rounded-xl border border-navy-lighter bg-navy-light/20 p-4">
            <p className="text-[10px] font-mono text-cream-dim/50 uppercase tracking-wider mb-3">20-80 Scale</p>
            <div className="space-y-1">
              {[
                { g: 80, label: 'Elite / Hall of Fame' },
                { g: 70, label: 'Plus Plus / All-Star' },
                { g: 60, label: 'Plus / Solid Regular' },
                { g: 50, label: 'Average MLB Player' },
                { g: 45, label: 'Below Average' },
                { g: 40, label: 'Fringe MLB' },
                { g: 30, label: 'Below Replacement' },
                { g: 20, label: 'Non-Prospect' },
              ].map(({ g, label }) => (
                <div key={g} className="flex items-center gap-2">
                  <div className={cn('w-6 h-4 rounded flex items-center justify-center text-[10px] font-bold font-mono', gradeColor(g))}>
                    {g}
                  </div>
                  <span className="text-[10px] font-mono text-cream-dim/50">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
