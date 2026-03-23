import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { usePlayerModal } from '@/stores/playerModalStore.ts';
import { evaluatePlayer, evaluateTrade } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import {
  calcBattingAdvanced, calcPitchingAdvanced,
  deriveLeagueContext, DEFAULT_LEAGUE_CONTEXT,
} from '@/engine/stats/AdvancedStats.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';

// ── Types ────────────────────────────────────────────────────────────────────

interface TradeScenario {
  id: string;
  yourPlayers: string[];
  theirPlayers: string[];
  partnerId: string;
}

function PlayerChip({
  player,
  war,
  salary,
  onRemove,
  onClick,
}: {
  player: Player;
  war: number;
  salary?: string;
  onRemove: () => void;
  onClick: () => void;
}) {
  const ovr = Math.round(evaluatePlayer(player));
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-navy-lighter/30 border border-navy-lighter/50 group">
      <button onClick={onClick} className="flex-1 min-w-0 text-left cursor-pointer">
        <p className="font-body text-xs text-cream truncate">{getPlayerName(player)}</p>
        <p className="font-mono text-[9px] text-cream-dim/50">
          {player.position} · {ovr} OVR · {war >= 0 ? '+' : ''}{war.toFixed(1)} WAR
          {salary && ` · ${salary}`}
        </p>
      </button>
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="text-cream-dim/30 hover:text-red-400 text-xs shrink-0 cursor-pointer transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function TradeMachinePage() {
  const navigate = useNavigate();
  const { engine, userTeamId, season, teams } = useFranchiseStore();
  const playerStats = useStatsStore(s => s.playerStats);
  const openPlayer = usePlayerModal(s => s.openPlayer);

  const [partnerId, setPartnerId] = useState<string>('');
  const [yourPlayers, setYourPlayers] = useState<string[]>([]);
  const [theirPlayers, setTheirPlayers] = useState<string[]>([]);
  const [searchYour, setSearchYour] = useState('');
  const [searchTheir, setSearchTheir] = useState('');
  const [savedScenarios, setSavedScenarios] = useState<TradeScenario[]>([]);

  if (!engine || !userTeamId || !season) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Trade Machine</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          Build and analyze trade scenarios. Compare WAR impact, salary implications, and fairness grades.
        </p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const userTeam = engine.getTeam(userTeamId)!;
  const otherTeams = teams.filter(t => t.id !== userTeamId).sort((a, b) => `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`));

  // Auto-select first partner if none selected
  if (!partnerId && otherTeams.length > 0) {
    setPartnerId(otherTeams[0].id);
  }

  const partnerTeam = engine.getTeam(partnerId);

  // League context for WAR
  const leagueCtx = useMemo(() => {
    const allStats = Object.values(playerStats);
    if (allStats.length === 0) return DEFAULT_LEAGUE_CONTEXT;
    let tAB = 0, tPA = 0, tH = 0, tD = 0, tT = 0, tHR = 0, tBB = 0, tHBP = 0, tSF = 0, tSO = 0, tR = 0, tER = 0, tIP = 0;
    for (const p of allStats) {
      tAB += p.batting.ab; tPA += p.batting.pa; tH += p.batting.h;
      tD += p.batting.doubles; tT += p.batting.triples; tHR += p.batting.hr;
      tBB += p.batting.bb; tHBP += p.batting.hbp; tSF += p.batting.sf;
      tSO += p.batting.so; tR += p.batting.r; tER += p.pitching.er; tIP += p.pitching.ip;
    }
    return deriveLeagueContext(tAB, tPA, tH, tD, tT, tHR, tBB, tHBP, tSF, tSO, tR, 0, tER, tIP);
  }, [playerStats]);

  const getWar = useCallback((playerId: string, position: string) => {
    const ps = playerStats[playerId];
    if (!ps) return 0;
    if (position === 'P' && ps.pitching.ip > 0) return calcPitchingAdvanced(ps.pitching, leagueCtx).war;
    if (position !== 'P' && ps.batting.pa > 0) return calcBattingAdvanced(ps.batting, leagueCtx, position).war;
    return 0;
  }, [playerStats, leagueCtx]);

  const getSalary = useCallback((playerId: string) => {
    const c = engine.contractEngine?.getContract(playerId);
    if (!c || c.isFreeAgent) return null;
    return `$${(c.salaryPerYear / 1000).toFixed(1)}M`;
  }, [engine]);

  const getSalaryNum = useCallback((playerId: string) => {
    const c = engine.contractEngine?.getContract(playerId);
    return c && !c.isFreeAgent ? c.salaryPerYear : 0;
  }, [engine]);

  // Filter players by search
  const filterPlayers = (roster: Player[], search: string, exclude: string[]) => {
    const q = search.toLowerCase();
    return roster
      .filter(p => !exclude.includes(p.id))
      .filter(p => !q || getPlayerName(p).toLowerCase().includes(q) || p.position.toLowerCase().includes(q))
      .sort((a, b) => evaluatePlayer(b) - evaluatePlayer(a))
      .slice(0, 15);
  };

  const yourRoster = filterPlayers(userTeam.roster.players, searchYour, yourPlayers);
  const theirRoster = partnerTeam ? filterPlayers(partnerTeam.roster.players, searchTheir, theirPlayers) : [];

  // Selected player objects
  const yourSelected = yourPlayers.map(id => userTeam.roster.players.find(p => p.id === id)).filter(Boolean) as Player[];
  const theirSelected = partnerTeam ? theirPlayers.map(id => partnerTeam.roster.players.find(p => p.id === id)).filter(Boolean) as Player[] : [];

  // Trade analysis
  const analysis = useMemo(() => {
    if (yourSelected.length === 0 && theirSelected.length === 0) return null;

    const yourWarTotal = yourSelected.reduce((sum, p) => sum + getWar(p.id, p.position), 0);
    const theirWarTotal = theirSelected.reduce((sum, p) => sum + getWar(p.id, p.position), 0);
    const warDelta = theirWarTotal - yourWarTotal;

    const yourSalaryTotal = yourSelected.reduce((sum, p) => sum + getSalaryNum(p.id), 0);
    const theirSalaryTotal = theirSelected.reduce((sum, p) => sum + getSalaryNum(p.id), 0);
    const salaryDelta = theirSalaryTotal - yourSalaryTotal;

    const yourOvrTotal = yourSelected.reduce((sum, p) => sum + evaluatePlayer(p), 0);
    const theirOvrTotal = theirSelected.reduce((sum, p) => sum + evaluatePlayer(p), 0);

    // Fairness using trade engine
    let fairness = 0;
    if (yourSelected.length > 0 && theirSelected.length > 0 && partnerTeam) {
      fairness = evaluateTrade(
        { teamId: userTeamId, playerIds: yourPlayers },
        { teamId: partnerId, playerIds: theirPlayers },
        engine.getAllTeams()
      );
    }

    const grade = fairness > 10 ? 'A+' : fairness > 5 ? 'A' : fairness > 2 ? 'B+' :
      fairness > -2 ? 'B' : fairness > -5 ? 'C' : fairness > -10 ? 'D' : 'F';
    const gradeColor = grade.startsWith('A') ? 'text-gold' : grade.startsWith('B') ? 'text-green-light' :
      grade === 'C' ? 'text-cream' : 'text-red-400';

    return {
      yourWarTotal, theirWarTotal, warDelta,
      yourSalaryTotal, theirSalaryTotal, salaryDelta,
      yourOvrTotal, theirOvrTotal,
      fairness, grade, gradeColor,
    };
  }, [yourSelected, theirSelected, getWar, getSalaryNum, userTeamId, partnerId, yourPlayers, theirPlayers, engine, partnerTeam]);

  const handleSaveScenario = () => {
    if (yourPlayers.length === 0 && theirPlayers.length === 0) return;
    setSavedScenarios(prev => [...prev, {
      id: `scenario-${Date.now()}`,
      yourPlayers: [...yourPlayers],
      theirPlayers: [...theirPlayers],
      partnerId,
    }]);
  };

  const handleLoadScenario = (s: TradeScenario) => {
    setPartnerId(s.partnerId);
    setYourPlayers(s.yourPlayers);
    setTheirPlayers(s.theirPlayers);
  };

  const handleClear = () => {
    setYourPlayers([]);
    setTheirPlayers([]);
    setSearchYour('');
    setSearchTheir('');
  };

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Trade Machine</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            Build and analyze trade scenarios with WAR impact analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate('/franchise/trade')}>Trade Center →</Button>
          <Button variant="ghost" onClick={() => navigate('/franchise')}>← Back</Button>
        </div>
      </div>

      {/* Partner Selector */}
      <div className="mb-4 flex items-center gap-3">
        <span className="font-mono text-gold/70 text-xs uppercase tracking-wider">Trade with:</span>
        <select
          value={partnerId}
          onChange={e => { setPartnerId(e.target.value); setTheirPlayers([]); setSearchTheir(''); }}
          className="bg-navy-light border border-gold/30 rounded-md px-4 py-2 font-mono text-sm text-cream focus:outline-none focus:border-gold/60 appearance-none cursor-pointer pr-8 hover:border-gold/50 transition-colors"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23d4a843' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
        >
          {otherTeams.map(t => (
            <option key={t.id} value={t.id} style={{ background: '#0f1829', color: '#e8e0d4' }}>
              {t.city} {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* YOUR SIDE */}
        <Panel title={`${userTeam.city} ${userTeam.name} (You Send)`}>
          <input
            type="text"
            placeholder="Search your roster..."
            value={searchYour}
            onChange={e => setSearchYour(e.target.value)}
            className="w-full bg-navy border border-navy-lighter rounded-md px-3 py-1.5 text-cream font-mono text-xs mb-2 focus:outline-none focus:border-gold/50 placeholder:text-cream-dim/30"
          />

          {/* Selected players */}
          {yourSelected.length > 0 && (
            <div className="space-y-1 mb-3 pb-3 border-b border-navy-lighter/30">
              {yourSelected.map(p => (
                <PlayerChip
                  key={p.id}
                  player={p}
                  war={getWar(p.id, p.position)}
                  salary={getSalary(p.id) ?? undefined}
                  onRemove={() => setYourPlayers(prev => prev.filter(id => id !== p.id))}
                  onClick={() => openPlayer(p.id)}
                />
              ))}
            </div>
          )}

          {/* Available players */}
          <div className="space-y-0.5 max-h-[300px] overflow-y-auto pr-1">
            {yourRoster.map(p => {
              const ovr = Math.round(evaluatePlayer(p));
              return (
                <button
                  key={p.id}
                  onClick={() => setYourPlayers(prev => [...prev, p.id])}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-gold/10 transition-colors cursor-pointer flex items-center gap-2 group border border-transparent hover:border-gold/20"
                >
                  <span className={cn('font-mono text-[10px] w-5 shrink-0',
                    ovr >= 70 ? 'text-gold' : ovr >= 55 ? 'text-green-light' : 'text-cream-dim',
                  )}>{ovr}</span>
                  <span className="font-body text-xs text-cream truncate flex-1">{getPlayerName(p)}</span>
                  <span className="font-mono text-[10px] text-cream-dim/40">{p.position}</span>
                  <span className="font-mono text-xs text-gold/0 group-hover:text-gold/70 transition-colors shrink-0">+</span>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* ANALYSIS CENTER */}
        <Panel title="Trade Analysis">
          {analysis ? (
            <div className="space-y-4">
              {/* Fairness Grade */}
              <div className="text-center py-3">
                <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider mb-1">Trade Grade</p>
                <p className={cn('font-display text-5xl font-bold', analysis.gradeColor)}>{analysis.grade}</p>
                <p className="font-mono text-xs text-cream-dim/50 mt-1">
                  {analysis.fairness > 5 ? 'Heavily favors you' :
                   analysis.fairness > 2 ? 'Slightly favors you' :
                   analysis.fairness > -2 ? 'Fair trade' :
                   analysis.fairness > -5 ? 'Slightly favors them' :
                   'Heavily favors them'}
                </p>
              </div>

              {/* WAR Impact */}
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center py-2 rounded-lg bg-navy-lighter/20 border border-navy-lighter/30">
                  <p className="font-mono text-[9px] text-cream-dim/40 uppercase">You Lose</p>
                  <p className="font-mono text-lg font-bold text-red-400">{analysis.yourWarTotal.toFixed(1)}</p>
                  <p className="font-mono text-[9px] text-cream-dim/30">WAR</p>
                </div>
                <div className="text-center py-2 rounded-lg bg-navy-lighter/20 border border-navy-lighter/30">
                  <p className="font-mono text-[9px] text-cream-dim/40 uppercase">You Gain</p>
                  <p className="font-mono text-lg font-bold text-green-light">{analysis.theirWarTotal.toFixed(1)}</p>
                  <p className="font-mono text-[9px] text-cream-dim/30">WAR</p>
                </div>
              </div>

              {/* Net Impact */}
              <div className="text-center py-2 rounded-lg border border-navy-lighter/40">
                <p className="font-mono text-[9px] text-cream-dim/40 uppercase">Net WAR Impact</p>
                <p className={cn('font-mono text-2xl font-bold',
                  analysis.warDelta > 0 ? 'text-green-light' : analysis.warDelta < 0 ? 'text-red-400' : 'text-cream',
                )}>
                  {analysis.warDelta > 0 ? '+' : ''}{analysis.warDelta.toFixed(1)}
                </p>
              </div>

              {/* Salary Impact */}
              <div className="text-center py-2 rounded-lg border border-navy-lighter/40">
                <p className="font-mono text-[9px] text-cream-dim/40 uppercase">Salary Impact</p>
                <p className={cn('font-mono text-sm font-bold',
                  analysis.salaryDelta > 0 ? 'text-red-400' : analysis.salaryDelta < 0 ? 'text-green-light' : 'text-cream-dim',
                )}>
                  {analysis.salaryDelta > 0 ? '+' : ''}${(analysis.salaryDelta / 1000).toFixed(1)}M/yr
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <Button className="w-full" variant="secondary" onClick={handleSaveScenario}>
                  Save Scenario
                </Button>
                <Button className="w-full" variant="ghost" onClick={handleClear}>
                  Clear All
                </Button>
                {yourPlayers.length > 0 && theirPlayers.length > 0 && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set('partner', partnerId);
                      yourPlayers.forEach(id => params.append('offer', id));
                      theirPlayers.forEach(id => params.append('request', id));
                      navigate(`/franchise/trade?${params.toString()}`);
                    }}
                  >
                    Propose This Trade →
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="font-mono text-cream-dim/40 text-sm">Click players from each roster to add them</p>
              <p className="font-mono text-cream-dim/25 text-xs mt-2">WAR impact, salary changes, and fairness grade</p>
            </div>
          )}
        </Panel>

        {/* THEIR SIDE */}
        <Panel title={`${partnerTeam ? `${partnerTeam.city} ${partnerTeam.name}` : 'Select Partner'} (You Get)`}>
          <input
            type="text"
            placeholder="Search their roster..."
            value={searchTheir}
            onChange={e => setSearchTheir(e.target.value)}
            className="w-full bg-navy border border-navy-lighter rounded-md px-3 py-1.5 text-cream font-mono text-xs mb-2 focus:outline-none focus:border-gold/50 placeholder:text-cream-dim/30"
          />

          {/* Selected players */}
          {theirSelected.length > 0 && (
            <div className="space-y-1 mb-3 pb-3 border-b border-navy-lighter/30">
              {theirSelected.map(p => (
                <PlayerChip
                  key={p.id}
                  player={p}
                  war={getWar(p.id, p.position)}
                  salary={getSalary(p.id) ?? undefined}
                  onRemove={() => setTheirPlayers(prev => prev.filter(id => id !== p.id))}
                  onClick={() => openPlayer(p.id)}
                />
              ))}
            </div>
          )}

          {/* Available players */}
          <div className="space-y-0.5 max-h-[300px] overflow-y-auto pr-1">
            {theirRoster.map(p => {
              const ovr = Math.round(evaluatePlayer(p));
              return (
                <button
                  key={p.id}
                  onClick={() => setTheirPlayers(prev => [...prev, p.id])}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-gold/10 transition-colors cursor-pointer flex items-center gap-2 group border border-transparent hover:border-gold/20"
                >
                  <span className={cn('font-mono text-[10px] w-5 shrink-0',
                    ovr >= 70 ? 'text-gold' : ovr >= 55 ? 'text-green-light' : 'text-cream-dim',
                  )}>{ovr}</span>
                  <span className="font-body text-xs text-cream truncate flex-1">{getPlayerName(p)}</span>
                  <span className="font-mono text-[10px] text-cream-dim/40">{p.position}</span>
                  <span className="font-mono text-xs text-gold/0 group-hover:text-gold/70 transition-colors shrink-0">+</span>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Saved Scenarios */}
      {savedScenarios.length > 0 && (
        <Panel title={`Saved Scenarios (${savedScenarios.length})`}>
          <div className="space-y-2">
            {savedScenarios.map((s, i) => {
              const partner = engine.getTeam(s.partnerId);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-navy-lighter/20 border border-navy-lighter/30 hover:border-navy-lighter/60 transition-colors"
                >
                  <div>
                    <p className="font-mono text-xs text-cream">
                      Scenario #{i + 1}: {s.yourPlayers.length} player{s.yourPlayers.length !== 1 ? 's' : ''} ⇄ {s.theirPlayers.length} player{s.theirPlayers.length !== 1 ? 's' : ''}
                    </p>
                    <p className="font-mono text-[10px] text-cream-dim/50">
                      vs {partner ? `${partner.city} ${partner.name}` : s.partnerId}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleLoadScenario(s)}>Load</Button>
                    <Button size="sm" variant="ghost" onClick={() => setSavedScenarios(prev => prev.filter(x => x.id !== s.id))}>✕</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
