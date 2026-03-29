import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { DraftProspect, DraftClass, ProspectRisk, ScoutGrade } from '@/engine/gm/DraftEngine.ts';

// ── Tool grade helpers ────────────────────────────────────────────────────────

function gradeColor(g: number): string {
  if (g >= 70) return 'text-gold font-bold';
  if (g >= 60) return 'text-green-light font-semibold';
  if (g >= 50) return 'text-cream';
  if (g >= 40) return 'text-cream-dim';
  return 'text-red-400';
}

function gradeLabel(g: number): string {
  if (g >= 80) return 'Elite';
  if (g >= 70) return 'Plus+';
  if (g >= 60) return 'Plus';
  if (g >= 55) return 'Avg+';
  if (g >= 50) return 'Avg';
  if (g >= 45) return 'Avg-';
  if (g >= 40) return 'Fringe';
  if (g >= 30) return 'Poor';
  return 'Very Poor';
}

function riskColor(r: ProspectRisk): string {
  return r === 'SAFE' ? 'text-green-light bg-green-900/20 border-green-light/30'
       : r === 'MEDIUM' ? 'text-gold bg-gold/10 border-gold/30'
       : 'text-red-400 bg-red-900/20 border-red-500/30';
}

function gradeLetterColor(g: ScoutGrade): string {
  if (g === 'A+' || g === 'A') return 'text-gold';
  if (g === 'A-' || g === 'B+') return 'text-green-light';
  if (g === 'B' || g === 'B-') return 'text-cream';
  return 'text-cream-dim';
}

const POSITION_COLORS: Record<string, string> = {
  P: 'text-blue-400', C: 'text-purple-400',
  '1B': 'text-green-light', '2B': 'text-green-light', '3B': 'text-green-light',
  SS: 'text-gold', LF: 'text-cream', CF: 'text-cream', RF: 'text-cream', DH: 'text-red',
};

// ── ToolBar component ─────────────────────────────────────────────────────────

function ToolBar({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  const pct = Math.round(((value - 20) / 60) * 100);
  const color = value >= 70 ? 'bg-gold' : value >= 60 ? 'bg-green-light' : value >= 50 ? 'bg-cream-dim/80' : value >= 40 ? 'bg-navy-lighter' : 'bg-red-400/60';
  return (
    <div className={cn('flex items-center gap-2', compact ? 'gap-1.5' : 'gap-2')}>
      <span className={cn('font-mono text-right shrink-0', compact ? 'text-[10px] text-cream-dim/60 w-14' : 'text-xs text-cream-dim/70 w-16')}>{label}</span>
      <div className={cn('bg-navy-lighter/40 rounded-full overflow-hidden shrink-0', compact ? 'w-16 h-1' : 'w-24 h-1.5')}>
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('font-mono font-bold shrink-0', compact ? 'text-[11px] w-5' : 'text-xs w-6', gradeColor(value))}>{value}</span>
      {!compact && <span className="font-mono text-[10px] text-cream-dim/40 hidden sm:inline">{gradeLabel(value)}</span>}
    </div>
  );
}

// ── ScoutCard (compact board row) ────────────────────────────────────────────

function ProspectCard({
  prospect,
  rank,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: {
  prospect: DraftProspect;
  rank: number;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}) {
  const isPitcher = prospect.position === 'P';
  const t = prospect.tools;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => e.key === 'Enter' && onSelect()}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-all cursor-pointer',
        isSelected
          ? 'border-gold bg-gold/8 shadow-[0_0_12px_rgba(212,168,67,0.15)]'
          : 'border-navy-lighter/40 hover:border-navy-lighter/80 bg-navy-light/20 hover:bg-navy-light/40',
      )}
    >
      <div className="flex items-start gap-2">
        {/* Rank */}
        <span className="font-mono text-xs text-cream-dim/40 w-5 pt-0.5 shrink-0">{rank}</span>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-cream text-sm font-semibold truncate">{prospect.firstName} {prospect.lastName}</span>
            <span className={cn('font-mono text-xs font-bold', POSITION_COLORS[prospect.position] ?? 'text-cream')}>{prospect.position}</span>
            <span className="font-mono text-[10px] text-cream-dim/50">{prospect.bats}/{prospect.throws}</span>
            <span className="font-mono text-[10px] text-cream-dim/40">Age {prospect.age}</span>
          </div>
          <div className="font-mono text-[10px] text-cream-dim/40 truncate mt-0.5">{prospect.school}</div>

          {/* Mini tool bars */}
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
            {isPitcher ? (
              <>
                <ToolBar label="FB" value={t.fastball} compact />
                <ToolBar label="BRK" value={t.breaker} compact />
                <ToolBar label="CMD" value={t.command} compact />
                <ToolBar label="CHG" value={t.changeup} compact />
              </>
            ) : (
              <>
                <ToolBar label="HIT" value={t.hit} compact />
                <ToolBar label="PWR" value={t.power} compact />
                <ToolBar label="RUN" value={t.run} compact />
                <ToolBar label="FLD" value={t.field} compact />
              </>
            )}
          </div>
        </div>

        {/* Right side: grade + risk + favorite */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleFavorite}
              className={cn('text-sm transition-colors', isFavorite ? 'text-gold' : 'text-cream-dim/20 hover:text-cream-dim/60')}
            >
              ★
            </button>
            <span className={cn('font-mono text-lg font-bold', gradeLetterColor(prospect.scoutGrade))}>
              {prospect.scoutGrade}
            </span>
          </div>
          <span className={cn('font-mono text-[10px] px-1.5 py-0.5 rounded border', riskColor(prospect.risk))}>
            {prospect.risk}
          </span>
          <div className="text-right">
            <p className="font-mono text-[10px] text-cream-dim/40">POT</p>
            <p className={cn(
              'font-mono text-sm font-bold',
              prospect.potentialRating >= 80 ? 'text-gold' : prospect.potentialRating >= 70 ? 'text-green-light' : 'text-cream',
            )}>{prospect.potentialRating}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ScoutReport (right panel detail view) ────────────────────────────────────

function ScoutReport({
  prospect,
  isUserTurn,
  draftComplete,
  onDraft,
  isFavorite,
  onToggleFavorite,
}: {
  prospect: DraftProspect;
  isUserTurn: boolean;
  draftComplete: boolean;
  onDraft: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const isPitcher = prospect.position === 'P';
  const t = prospect.tools;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-gold text-xl leading-tight">{prospect.firstName} {prospect.lastName}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn('font-mono text-sm font-bold', POSITION_COLORS[prospect.position] ?? 'text-cream')}>{prospect.position}</span>
            <span className="font-mono text-xs text-cream-dim">Age {prospect.age}</span>
            <span className="font-mono text-xs text-cream-dim/50">{prospect.bats}ats · {prospect.throws}hrows</span>
          </div>
          <p className="font-mono text-[10px] text-cream-dim/50 mt-1">{prospect.school}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={cn('font-display text-3xl font-bold', gradeLetterColor(prospect.scoutGrade))}>{prospect.scoutGrade}</p>
          <p className="font-mono text-[10px] text-cream-dim/50">Scout Grade</p>
        </div>
      </div>

      {/* Risk + Ceiling */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded border border-navy-lighter/40 text-center">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest">Risk</p>
          <p className={cn('font-mono text-sm font-bold mt-0.5', riskColor(prospect.risk).split(' ')[0])}>{prospect.risk}</p>
        </div>
        <div className="p-2 rounded border border-navy-lighter/40 text-center">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest">Ceiling</p>
          <p className={cn(
            'font-mono text-sm font-bold mt-0.5',
            prospect.potentialRating >= 80 ? 'text-gold' : prospect.potentialRating >= 70 ? 'text-green-light' : 'text-cream',
          )}>{prospect.potentialRating}</p>
        </div>
      </div>

      {/* Tool Grades */}
      <div>
        <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest mb-2">20-80 Tool Grades</p>
        <div className="space-y-1">
          {isPitcher ? (
            <>
              <ToolBar label="Fastball" value={t.fastball} />
              <ToolBar label="Breaking Ball" value={t.breaker} />
              <ToolBar label="Changeup" value={t.changeup} />
              <ToolBar label="Command" value={t.command} />
              <ToolBar label="Arm Str." value={t.arm} />
            </>
          ) : (
            <>
              <ToolBar label="Hit Tool" value={t.hit} />
              <ToolBar label="Raw Power" value={t.power} />
              <ToolBar label="Run" value={t.run} />
              <ToolBar label="Arm" value={t.arm} />
              <ToolBar label="Fielding" value={t.field} />
            </>
          )}
        </div>
      </div>

      {/* Scout Report */}
      <div className="p-3 rounded-lg border border-navy-lighter/40 bg-navy-light/30">
        <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest mb-1.5">Scout Report</p>
        <p className="font-mono text-xs text-cream leading-relaxed">{prospect.scoutReport}</p>
      </div>

      {/* Current vs Potential */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-2 rounded border border-navy-lighter/40">
          <p className="font-mono text-[10px] text-cream-dim/50">Now</p>
          <p className="font-mono text-lg font-bold text-cream">{prospect.currentRating}</p>
        </div>
        <div className="p-2 rounded border border-gold/20 bg-gold/5">
          <p className="font-mono text-[10px] text-gold/60">Ceiling</p>
          <p className="font-mono text-lg font-bold text-gold">{prospect.potentialRating}</p>
        </div>
      </div>

      {isUserTurn && !draftComplete && (
        <Button className="w-full" onClick={onDraft} data-testid="draft-player-btn">
          Draft {prospect.firstName} {prospect.lastName}
        </Button>
      )}
      {!isUserTurn && !draftComplete && onToggleFavorite && (
        <button
          onClick={onToggleFavorite}
          className={cn(
            'w-full py-2 rounded-lg border text-sm font-mono font-bold transition-all',
            isFavorite
              ? 'bg-gold/20 border-gold/40 text-gold hover:bg-gold/30'
              : 'bg-navy-lighter/20 border-navy-lighter text-cream-dim hover:border-gold/40 hover:text-gold',
          )}
        >
          {isFavorite ? '★ On Watchlist — Remove' : '☆ Add to Watchlist'}
        </button>
      )}
      {!isUserTurn && !draftComplete && !onToggleFavorite && (
        <p className="text-center font-mono text-xs text-cream-dim/40 py-1">Waiting for your pick...</p>
      )}
      {draftComplete && (
        <p className="text-center font-mono text-xs text-cream-dim/40 py-1">Draft is complete</p>
      )}
    </div>
  );
}

// ── Pre-Draft Scouting (regular season) ──────────────────────────────────────

function PreDraftScouting({
  draftClass,
}: {
  draftClass: DraftClass;
}) {
  const [posFilter, setPosFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'pot' | 'grade' | 'risk'>('pot');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const positions = ['ALL', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

  const filtered = useMemo(() => {
    let list = [...draftClass.prospects];
    if (posFilter !== 'ALL') list = list.filter(p => p.position === posFilter);
    if (showFavOnly) list = list.filter(p => favorites.has(p.id));
    switch (sortBy) {
      case 'pot': list.sort((a, b) => b.potentialRating - a.potentialRating); break;
      case 'grade': {
        const gradeOrder = ['A+','A','A-','B+','B','B-','C+','C','C-','D'];
        list.sort((a, b) => gradeOrder.indexOf(a.scoutGrade) - gradeOrder.indexOf(b.scoutGrade));
        break;
      }
      case 'risk': {
        const riskOrder: ProspectRisk[] = ['SAFE', 'MEDIUM', 'HIGH'];
        list.sort((a, b) => riskOrder.indexOf(a.risk) - riskOrder.indexOf(b.risk));
        break;
      }
    }
    return list;
  }, [draftClass.prospects, posFilter, showFavOnly, favorites, sortBy]);

  const selected = draftClass.prospects.find(p => p.id === selectedId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Board */}
      <div className="lg:col-span-2 space-y-3">
        {/* Filters */}
        <Panel>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {positions.map(pos => (
                <button key={pos} onClick={() => setPosFilter(pos)}
                  className={cn('px-2 py-0.5 rounded text-xs font-mono border transition-colors',
                    posFilter === pos ? 'border-gold bg-gold/10 text-gold' : 'border-navy-lighter text-cream-dim hover:border-navy-lighter/80'
                  )}
                >{pos}</button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs text-cream-dim">Sort:</span>
              {(['pot', 'grade', 'risk'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={cn('px-2 py-0.5 rounded text-xs font-mono border transition-colors',
                    sortBy === s ? 'border-gold bg-gold/10 text-gold' : 'border-navy-lighter text-cream-dim hover:border-navy-lighter/80'
                  )}
                >{s === 'pot' ? 'Ceiling' : s === 'grade' ? 'Grade' : 'Risk'}</button>
              ))}
              <button onClick={() => setShowFavOnly(x => !x)}
                className={cn('px-2 py-0.5 rounded text-xs font-mono border transition-colors flex items-center gap-1',
                  showFavOnly ? 'border-gold bg-gold/10 text-gold' : 'border-navy-lighter text-cream-dim hover:border-navy-lighter/80'
                )}
              >
                ★ Watchlist {favorites.size > 0 && `(${favorites.size})`}
              </button>
            </div>
          </div>
        </Panel>

        <Panel title={`${filtered.length} Prospects`}>
          {filtered.length === 0 ? (
            <p className="text-cream-dim font-mono text-sm text-center py-6">No prospects match your filter</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filtered.map((p, i) => (
                <ProspectCard
                  key={p.id}
                  prospect={p}
                  rank={i + 1}
                  isSelected={selectedId === p.id}
                  isFavorite={favorites.has(p.id)}
                  onSelect={() => setSelectedId(selectedId === p.id ? null : p.id)}
                  onToggleFavorite={(e) => {
                    e.stopPropagation();
                    setFavorites(prev => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Scout Report */}
      <div>
        <Panel title="Scout Report">
          {selected ? (
            <ScoutReport
              prospect={selected}
              isUserTurn={false}
              draftComplete={false}
              onDraft={() => {}}
              isFavorite={favorites.has(selected.id)}
              onToggleFavorite={() => setFavorites(prev => {
                const next = new Set(prev);
                if (next.has(selected.id)) next.delete(selected.id); else next.add(selected.id);
                return next;
              })}
            />
          ) : (
            <div className="py-12 text-center">
              <p className="font-mono text-cream-dim/40 text-sm">Select a prospect</p>
              <p className="font-mono text-cream-dim/20 text-xs mt-1">to view their scout report</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ── Pick Reveal Announcement ──────────────────────────────────────────────────

interface PickReveal {
  teamId: string;
  teamAbbr: string;
  prospect: DraftProspect;
  round: number;
  overall: number;
  isUser: boolean;
}

function PickAnnouncement({ reveal, onDismiss }: { reveal: PickReveal; onDismiss: () => void }) {
  const isPitcher = reveal.prospect.position === 'P';
  const t = reveal.prospect.tools;
  const topToolLabel = isPitcher ? 'FB' : 'HIT';
  const topToolVal = isPitcher ? t.fastball : t.hit;

  return (
    <div
      className={cn(
        'mb-4 p-4 rounded-xl border-2',
        reveal.isUser
          ? 'border-gold bg-gold/10 shadow-[0_0_24px_rgba(212,168,67,0.2)]'
          : 'border-navy-lighter bg-navy-light/60',
      )}
      style={{ animation: 'fadeInDown 0.35s ease-out' }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className={cn(
          'font-mono text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-bold shrink-0',
          reveal.isUser ? 'bg-gold text-navy' : 'bg-navy-lighter text-cream-dim',
        )}>
          {reveal.isUser ? 'YOU SELECT' : 'CPU PICK'}
        </span>
        <span className={cn('font-mono text-xs shrink-0', reveal.isUser ? 'text-gold' : 'text-cream-dim')}>
          Round {reveal.round} · #{reveal.overall}
        </span>
        {!reveal.isUser && (
          <span className={cn(
            'font-display text-base font-bold shrink-0',
            reveal.isUser ? 'text-gold' : 'text-cream',
          )}>
            {reveal.teamAbbr}
          </span>
        )}
        <span className="font-mono text-xs text-cream-dim/50 shrink-0">selects</span>
        <span className={cn(
          'font-display text-lg font-bold',
          reveal.isUser ? 'text-gold' : 'text-cream',
        )}>
          {reveal.prospect.firstName} {reveal.prospect.lastName}
        </span>
        <span className={cn('font-mono text-sm font-bold shrink-0', POSITION_COLORS[reveal.prospect.position] ?? 'text-cream')}>
          {reveal.prospect.position}
        </span>
        <span className={cn('font-mono text-sm shrink-0', gradeLetterColor(reveal.prospect.scoutGrade))}>
          {reveal.prospect.scoutGrade}
        </span>
        <span className="font-mono text-xs text-cream-dim/50 shrink-0">{reveal.prospect.school}</span>
        <span className="font-mono text-xs text-cream-dim/30 shrink-0">
          {topToolLabel} {topToolVal}
        </span>
        {!reveal.isUser && (
          <button onClick={onDismiss} className="ml-auto text-cream-dim/30 hover:text-cream-dim text-xs font-mono">✕</button>
        )}
      </div>
    </div>
  );
}

// ── Main DraftPage ────────────────────────────────────────────────────────────

export function DraftPage() {
  const navigate = useNavigate();
  const {
    season, engine, userTeamId, isInitialized, _hasHydrated,
    draftClass, previewDraftClass, draftPickOrder, currentDraftPick, draftComplete,
    initDraft, draftPlayer, cpuDraftSinglePick, generatePreviewDraft,
  } = useFranchiseStore();

  const [selectedProspect, setSelectedProspect] = useState<DraftProspect | null>(null);
  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [justDrafted, setJustDrafted] = useState<DraftProspect | null>(null);
  const [scoutingTab, setScoutingTab] = useState<'board' | 'scouting'>('board');
  const [pickReveal, setPickReveal] = useState<PickReveal | null>(null);
  const [autoPicking, setAutoPicking] = useState(false);

  useEffect(() => {
    if (_hasHydrated && !isInitialized) navigate('/franchise/new');
  }, [_hasHydrated, isInitialized, navigate]);

  const isOffseason = season?.phase === 'offseason';
  const isRegularSeason = season?.phase === 'regular' || season?.phase === 'preseason';

  // Auto-init draft only during offseason
  useEffect(() => {
    if (!draftClass && season && engine && isOffseason) {
      initDraft();
    }
  }, [draftClass, season, engine, isOffseason, initDraft]);

  // Generate preview draft class for regular-season scouting
  useEffect(() => {
    if (!previewDraftClass && season && engine && isRegularSeason) {
      generatePreviewDraft();
    }
  }, [previewDraftClass, season, engine, isRegularSeason, generatePreviewDraft]);

  // Pre-draft scouting view — guard variable only; rendering moved after all hooks
  const _isRegularSeason = isRegularSeason;
  if (false as boolean) { // DISABLED: early return caused React hooks order violation; see line ~694
    const daysLeft = (season?.totalDays ?? 183) - (season?.currentDay ?? 0);
    return (
      <div className="min-h-screen p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Draft Room</h1>
              <p className="font-mono text-cream-dim text-sm mt-1">
                {season?.year ? `${season.year + 1} Amateur Draft` : 'Amateur Draft'} — Pre-Draft Scouting
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest">Draft In</p>
              <p className="font-display text-xl font-bold text-gold">{daysLeft}d</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-2 mt-4 border-b border-navy-lighter pb-0">
            <button
              onClick={() => setScoutingTab('board')}
              className={cn(
                'px-4 py-2 font-mono text-sm border-b-2 -mb-px transition-colors',
                scoutingTab === 'board' ? 'border-gold text-gold' : 'border-transparent text-cream-dim hover:text-cream',
              )}
            >
              Big Board
            </button>
            <button
              onClick={() => setScoutingTab('scouting')}
              className={cn(
                'px-4 py-2 font-mono text-sm border-b-2 -mb-px transition-colors',
                scoutingTab === 'scouting' ? 'border-gold text-gold' : 'border-transparent text-cream-dim hover:text-cream',
              )}
            >
              ★ Watchlist {favorites.size > 0 && `(${favorites.size})`}
            </button>
          </div>
        </div>

        <div className={cn(
          'p-3 rounded-lg border mb-4 font-mono text-xs',
          'border-gold/20 bg-gold/5 text-gold/80',
        )}>
          📋 Regular season is underway. Scout the upcoming draft class and add prospects to your watchlist.
          The draft begins during the offseason — {daysLeft} days remaining.
        </div>

        {previewDraftClass ? (
          <PreDraftScouting draftClass={previewDraftClass} />
        ) : (
          <Panel>
            <div className="py-12 text-center">
              <div className="text-5xl mb-4">📋</div>
              <p className="font-display text-xl text-gold mb-2">Generating Scout Reports</p>
              <p className="font-mono text-cream-dim text-sm">
                Building the {season?.year ? season.year + 1 : ''} draft class...
              </p>
            </div>
          </Panel>
        )}
      </div>
    );
  }

  // Guard: moved to after all hooks to prevent hooks order violation
  const _draftNotReady = !season || !engine || !draftClass;
  if (false as boolean) { // DISABLED — see line ~696
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Panel>
          <p className="text-cream-dim font-mono">Loading draft room...</p>
        </Panel>
      </div>
    );
  }

  const totalPicks = draftClass?.picks?.length ?? 0;
  const teamsCount = draftPickOrder?.length ?? 1;
  const currentPickEntry = draftClass?.picks?.[currentDraftPick];
  const currentPickTeamId = currentPickEntry?.teamId ?? '';
  const isUserTurn = currentPickTeamId === userTeamId && !draftComplete;

  const currentRound = draftComplete ? '—' : `${Math.floor(currentDraftPick / teamsCount) + 1}`;
  const currentPickNum = draftComplete ? '—' : `${(currentDraftPick % teamsCount) + 1}`;

  const draftedIds = new Set((draftClass?.picks ?? []).filter(p => p.prospectId).map(p => p.prospectId!));
  const available = (draftClass?.prospects ?? [])
    .filter(p => !draftedIds.has(p.id))
    .filter(p => posFilter === 'ALL' || p.position === posFilter)
    .sort((a, b) => b.potentialRating - a.potentialRating);

  const recentPicks = (draftClass?.picks ?? [])
    .filter(p => p.prospectId)
    .slice(-8)
    .reverse();

  const positions = ['ALL', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

  const teamName = (id: string) => {
    const t = engine?.getTeam(id);
    return t?.abbreviation ?? id.slice(0, 3).toUpperCase();
  };

  const handleDraft = () => {
    if (!selectedProspect || !isUserTurn || !draftClass) return;
    const drafted = selectedProspect;
    const pickEntry = draftClass.picks[currentDraftPick];
    const round = Math.floor(currentDraftPick / teamsCount) + 1;
    const success = draftPlayer(drafted.id);
    if (success) {
      // Show user's pick announcement
      setPickReveal({
        teamId: userTeamId ?? '',
        teamAbbr: teamName(userTeamId ?? ''),
        prospect: drafted,
        round,
        overall: pickEntry?.overallPick ?? (currentDraftPick + 1),
        isUser: true,
      });
      setJustDrafted(drafted);
      setSelectedProspect(null);
      setTimeout(() => {
        setJustDrafted(null);
        setPickReveal(null);
        // Start CPU animation after user pick announcement clears
        setAutoPicking(true);
      }, 1800);
    }
  };

  // CPU pick animation loop — fires after user's pick, reveals CPU picks one at a time
  useEffect(() => {
    if (!autoPicking || draftComplete || !draftClass) return;

    const nextEntry = draftClass.picks[currentDraftPick];
    if (!nextEntry) { setAutoPicking(false); return; }
    if (nextEntry.teamId === userTeamId) {
      setAutoPicking(false); // user's next turn — stop animating
      return;
    }

    const round = Math.floor(currentDraftPick / teamsCount) + 1;

    const timer = setTimeout(() => {
      const picked = cpuDraftSinglePick();
      if (picked) {
        setPickReveal({
          teamId: nextEntry.teamId,
          teamAbbr: teamName(nextEntry.teamId),
          prospect: picked,
          round,
          overall: (nextEntry.overallPick ?? currentDraftPick) + 1,
          isUser: false,
        });
        // Hold the reveal briefly, then loop
        setTimeout(() => {
          setPickReveal(null);
        }, 900);
      } else {
        setAutoPicking(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [autoPicking, currentDraftPick, draftComplete]);

  // Scouting view for regular season (moved here from line 526 to avoid hooks order violation)
  if (_isRegularSeason && !draftClass) {
    const daysLeft = (season?.totalDays ?? 183) - (season?.currentDay ?? 0);
    return (
      <div className="min-h-screen p-6 max-w-6xl mx-auto">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase mb-4">Draft Room</h1>
        <p className="font-mono text-cream-dim text-sm">
          {season?.year ? `${season.year + 1} Amateur Draft` : 'Amateur Draft'} — Pre-Draft Scouting
        </p>
        <p className="font-mono text-cream-dim/50 text-xs mt-1">
          {daysLeft} days until the draft. Scout prospects and build your board.
        </p>
        {previewDraftClass && (
          <div className="mt-4">
            <p className="font-mono text-xs text-cream-dim/50">{previewDraftClass.prospects.length} prospects in this year's class</p>
          </div>
        )}
      </div>
    );
  }

  // Loading guard — draft data not ready yet (moved from line 593 to after all hooks)
  if (_draftNotReady) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Panel>
          <p className="text-cream-dim font-mono">Loading draft room...</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto" data-testid="draft-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
            {season.year + 1} Draft Room
          </h1>
          <p className={cn('font-mono text-sm mt-0.5', isUserTurn ? 'text-gold' : 'text-cream-dim')}>
            {draftComplete
              ? 'Draft Complete'
              : isUserTurn
                ? `⚡ YOUR PICK — Round ${currentRound}, Pick ${currentPickNum}`
                : `Round ${currentRound}, Pick ${currentPickNum} — ${teamName(currentPickTeamId)} selecting`
            }
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => navigate('/franchise/offseason')}>
          ← Offseason
        </Button>
      </div>

      {/* "On the clock" banner */}
      {isUserTurn && !draftComplete && !autoPicking && !pickReveal && (
        <div className="mb-4 px-4 py-3 rounded-xl border-2 border-gold bg-gold/10 flex items-center justify-between"
          style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}>
          <p className="font-display text-gold text-lg uppercase tracking-wide">You're on the clock</p>
          <p className="font-mono text-gold/80 text-sm">Round {currentRound} · Pick {currentPickNum}</p>
        </div>
      )}

      {/* CPU animating banner */}
      {autoPicking && !pickReveal && !draftComplete && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-navy-lighter bg-navy-light/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-cream-dim animate-pulse">⚙ CPU selecting...</span>
            <span className="font-mono text-xs text-cream-dim/40">Round {currentRound}, Pick {currentPickNum}</span>
          </div>
          <button
            onClick={() => {
              // Fast-forward: execute all remaining CPU picks instantly until user's turn
              setAutoPicking(false);
              setPickReveal(null);
              // Keep calling cpuDraftSinglePick until it returns null (user's turn or done)
              let picked = cpuDraftSinglePick();
              while (picked !== null) {
                picked = cpuDraftSinglePick();
              }
            }}
            className="font-mono text-[10px] text-cream-dim/40 hover:text-cream-dim border border-navy-lighter/40 px-2 py-1 rounded transition-colors shrink-0"
          >
            Skip ⏩
          </button>
        </div>
      )}

      {/* Pick announcement (user or CPU) */}
      {pickReveal && (
        <PickAnnouncement
          reveal={pickReveal}
          onDismiss={() => setPickReveal(null)}
        />
      )}

      {/* Progress bar */}
      <div className="mb-4 p-3 rounded-lg border border-navy-lighter bg-navy-light">
        <div className="flex items-center justify-between font-mono text-xs mb-1.5">
          <span className="text-cream-dim">Pick {Math.min(currentDraftPick + 1, totalPicks)} of {totalPicks}</span>
          <span className={cn('px-2 py-0.5 rounded font-bold uppercase tracking-widest text-[10px]',
            isUserTurn ? 'bg-gold text-navy' : draftComplete ? 'bg-navy-lighter text-cream-dim' : 'bg-navy-lighter text-cream'
          )}>
            {draftComplete ? 'Complete' : isUserTurn ? 'Your Pick' : 'CPU Picking'}
          </span>
          <span className="text-cream-dim">{available.length} available</span>
        </div>
        <div className="h-1.5 bg-navy-lighter/40 rounded-full overflow-hidden">
          <div className="h-full bg-gold/60 rounded-full transition-all" style={{ width: `${(currentDraftPick / totalPicks) * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Prospect Board */}
        <div className="lg:col-span-2 space-y-3">
          <Panel title="Available Prospects">
            {/* Filters */}
            <div className="flex flex-wrap gap-1 mb-3">
              {positions.map(pos => (
                <button key={pos} onClick={() => setPosFilter(pos)}
                  className={cn('px-2 py-0.5 rounded text-xs font-mono border transition-colors',
                    posFilter === pos ? 'border-gold bg-gold/10 text-gold' : 'border-navy-lighter text-cream-dim hover:border-navy-lighter/80'
                  )}
                >{pos}</button>
              ))}
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {available.length === 0 ? (
                <p className="text-cream-dim font-mono text-sm py-4 text-center">No prospects available</p>
              ) : (
                available.map((p, i) => (
                  <ProspectCard
                    key={p.id}
                    prospect={p}
                    rank={i + 1}
                    isSelected={selectedProspect?.id === p.id}
                    isFavorite={favorites.has(p.id)}
                    onSelect={() => setSelectedProspect(selectedProspect?.id === p.id ? null : p)}
                    onToggleFavorite={(e) => {
                      e.stopPropagation();
                      setFavorites(prev => {
                        const next = new Set(prev);
                        if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                        return next;
                      });
                    }}
                  />
                ))
              )}
            </div>
          </Panel>

          {/* Recent Picks */}
          <Panel title="Recent Picks">
            {recentPicks.length === 0 ? (
              <p className="font-mono text-cream-dim/50 text-xs text-center py-3">No picks made yet</p>
            ) : (
              <div className="space-y-1">
                {recentPicks.map(pk => {
                  const prospect = draftClass.prospects.find(p => p.id === pk.prospectId);
                  if (!prospect) return null;
                  return (
                    <div key={pk.overallPick} className={cn(
                      'flex items-center justify-between px-2 py-1.5 rounded font-mono text-sm',
                      pk.teamId === userTeamId ? 'bg-gold/8 border border-gold/20' : 'border border-transparent',
                    )}>
                      <span className="text-cream-dim/50 text-xs w-6">#{pk.overallPick}</span>
                      <span className={cn('font-bold text-xs w-10', pk.teamId === userTeamId ? 'text-gold' : 'text-cream')}>
                        {teamName(pk.teamId)}
                      </span>
                      <span className="text-cream flex-1 text-xs truncate px-2">{prospect.firstName} {prospect.lastName}</span>
                      <span className={cn('font-bold text-xs w-6', POSITION_COLORS[prospect.position] ?? 'text-cream')}>{prospect.position}</span>
                      <span className={cn('text-xs w-6 text-right', gradeLetterColor(prospect.scoutGrade))}>{prospect.scoutGrade}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* Right: Scout Report + Pick Order */}
        <div className="space-y-3">
          <Panel title="Scout Report">
            {selectedProspect ? (
              <ScoutReport
                prospect={selectedProspect}
                isUserTurn={isUserTurn}
                draftComplete={draftComplete ?? false}
                onDraft={handleDraft}
              />
            ) : (
              <div className="py-10 text-center">
                <p className="font-mono text-cream-dim/40 text-sm">Select a prospect</p>
                <p className="font-mono text-cream-dim/20 text-xs mt-1">to view their scout report</p>
              </div>
            )}
          </Panel>

          {/* Pick Order */}
          <Panel title="On The Clock (Next 5)">
            <div className="space-y-1">
              {draftClass.picks.slice(currentDraftPick, currentDraftPick + 5).map((pk, i) => (
                <div key={pk.overallPick} className={cn(
                  'flex items-center justify-between p-1.5 rounded font-mono text-sm',
                  i === 0 && !draftComplete ? 'bg-gold/10 border border-gold/30' : 'border border-transparent',
                )}>
                  <span className="text-cream-dim text-xs">#{pk.overallPick}</span>
                  <span className={cn('font-bold text-sm', pk.teamId === userTeamId ? 'text-gold' : 'text-cream')}>
                    {teamName(pk.teamId)}
                    {pk.teamId === userTeamId && ' ◀'}
                  </span>
                  <span className="text-cream-dim text-xs">R{pk.round}</span>
                </div>
              ))}
              {currentDraftPick >= totalPicks && (
                <p className="text-cream-dim text-xs text-center py-2">Draft complete</p>
              )}
            </div>
          </Panel>

          {draftComplete && (
            <Button className="w-full" onClick={() => navigate('/franchise/offseason')} data-testid="draft-complete-btn">
              Return to Offseason
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
