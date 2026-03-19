import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { Tabs } from '@/components/ui/Tabs.tsx';
import { useCareerStore } from '@/stores/careerStore.ts';
import type { SeasonRecord, CareerState, Milestone } from '@/engine/player/CareerEngine.ts';

const GOLD = '#d4a843';
const NAVY = '#0a0f1a';
const CREAM = '#e8e0d4';

function fmt3(n: number) { return n.toFixed(3).replace(/^0/, ''); }

function StatsRow({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-1 border-b border-navy-lighter/30 ${highlight ? 'bg-gold/5' : ''}`}>
      <span className="text-cream-dim text-xs font-mono pl-1">{label}</span>
      <span className={`text-xs font-mono pr-1 ${highlight ? 'text-gold font-bold' : 'text-cream'}`}>{value}</span>
    </div>
  );
}

function BattingSeasonTable({ logs }: { logs: SeasonRecord[] }) {
  const fmt = fmt3;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse min-w-[700px]">
        <thead>
          <tr className="border-b border-navy-lighter">
            {['Year','Level','Team','G','AB','R','H','2B','3B','HR','RBI','BB','SO','SB','AVG','OBP','SLG','OPS'].map(h => (
              <th key={h} className="text-right py-1.5 px-2 text-cream-dim/70 text-[10px] uppercase tracking-wider first:text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((row, i) => {
            const s = row.stats;
            return (
              <tr key={i} className={`border-b border-navy-lighter/20 hover:bg-navy-lighter/10 ${row.level === 'MLB' ? 'text-cream' : 'text-cream-dim'}`}>
                <td className="py-1 px-2 text-left">{row.year}</td>
                <td className="py-1 px-2 text-right">
                  <span className={`px-1 rounded text-[9px] font-bold ${
                    row.level === 'MLB' ? 'bg-gold/20 text-gold' :
                    row.level === 'AAA' ? 'bg-blue-900/50 text-blue-300' :
                    row.level === 'AA'  ? 'bg-green-900/50 text-green-300' :
                                          'bg-navy-lighter/40 text-cream-dim'
                  }`}>{row.level}</span>
                </td>
                <td className="py-1 px-2 text-right text-[10px] max-w-[80px] truncate">{row.team}</td>
                <td className="py-1 px-2 text-right">{s.g}</td>
                <td className="py-1 px-2 text-right">{s.ab}</td>
                <td className="py-1 px-2 text-right">{s.r}</td>
                <td className="py-1 px-2 text-right">{s.h}</td>
                <td className="py-1 px-2 text-right">{s.doubles}</td>
                <td className="py-1 px-2 text-right">{s.triples}</td>
                <td className="py-1 px-2 text-right">{s.hr}</td>
                <td className="py-1 px-2 text-right">{s.rbi}</td>
                <td className="py-1 px-2 text-right">{s.bb}</td>
                <td className="py-1 px-2 text-right">{s.so}</td>
                <td className="py-1 px-2 text-right">{s.sb}</td>
                <td className="py-1 px-2 text-right">{fmt(s.avg)}</td>
                <td className="py-1 px-2 text-right">{fmt(s.obp)}</td>
                <td className="py-1 px-2 text-right">{fmt(s.slg)}</td>
                <td className="py-1 px-2 text-right">{fmt(s.ops)}</td>
              </tr>
            );
          })}
          {/* Totals row */}
          {logs.length > 0 && (() => {
            const tot = logs.reduce((acc, row) => {
              const s = row.stats;
              return {
                g: acc.g+s.g, ab: acc.ab+s.ab, r: acc.r+s.r, h: acc.h+s.h,
                doubles: acc.doubles+s.doubles, triples: acc.triples+s.triples,
                hr: acc.hr+s.hr, rbi: acc.rbi+s.rbi, bb: acc.bb+s.bb, so: acc.so+s.so, sb: acc.sb+s.sb,
              };
            }, { g:0,ab:0,r:0,h:0,doubles:0,triples:0,hr:0,rbi:0,bb:0,so:0,sb:0 });
            const avg = tot.ab > 0 ? fmt(tot.h/tot.ab) : '.000';
            const obp = (tot.ab+tot.bb) > 0 ? fmt((tot.h+tot.bb)/(tot.ab+tot.bb)) : '.000';
            const tb  = (tot.h-tot.doubles-tot.triples-tot.hr)+tot.doubles*2+tot.triples*3+tot.hr*4;
            const slg = tot.ab > 0 ? fmt(tb/tot.ab) : '.000';
            const ops = tot.ab > 0 ? fmt((tot.h+tot.bb)/(tot.ab+tot.bb) + tb/tot.ab) : '.000';
            return (
              <tr className="border-t-2 border-gold/40 bg-gold/5 text-gold font-bold">
                <td className="py-1.5 px-2 text-left">Career</td>
                <td className="py-1 px-2 text-right text-cream-dim text-[10px]">{logs.length} yrs</td>
                <td className="py-1 px-2 text-right">—</td>
                <td className="py-1 px-2 text-right">{tot.g}</td>
                <td className="py-1 px-2 text-right">{tot.ab}</td>
                <td className="py-1 px-2 text-right">{tot.r}</td>
                <td className="py-1 px-2 text-right">{tot.h}</td>
                <td className="py-1 px-2 text-right">{tot.doubles}</td>
                <td className="py-1 px-2 text-right">{tot.triples}</td>
                <td className="py-1 px-2 text-right">{tot.hr}</td>
                <td className="py-1 px-2 text-right">{tot.rbi}</td>
                <td className="py-1 px-2 text-right">{tot.bb}</td>
                <td className="py-1 px-2 text-right">{tot.so}</td>
                <td className="py-1 px-2 text-right">{tot.sb}</td>
                <td className="py-1 px-2 text-right">{avg}</td>
                <td className="py-1 px-2 text-right">{obp}</td>
                <td className="py-1 px-2 text-right">{slg}</td>
                <td className="py-1 px-2 text-right">{ops}</td>
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}

function PitchingSeasonTable({ logs }: { logs: SeasonRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse min-w-[600px]">
        <thead>
          <tr className="border-b border-navy-lighter">
            {['Year','Level','Team','GS','W','L','SV','IP','H','ER','BB','SO','ERA','WHIP'].map(h => (
              <th key={h} className="text-right py-1.5 px-2 text-cream-dim/70 text-[10px] uppercase tracking-wider first:text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((row, i) => {
            const s = row.stats;
            return (
              <tr key={i} className={`border-b border-navy-lighter/20 hover:bg-navy-lighter/10 ${row.level === 'MLB' ? 'text-cream' : 'text-cream-dim'}`}>
                <td className="py-1 px-2 text-left">{row.year}</td>
                <td className="py-1 px-2 text-right">
                  <span className={`px-1 rounded text-[9px] font-bold ${
                    row.level === 'MLB' ? 'bg-gold/20 text-gold' :
                    row.level === 'AAA' ? 'bg-blue-900/50 text-blue-300' :
                    row.level === 'AA'  ? 'bg-green-900/50 text-green-300' :
                                          'bg-navy-lighter/40 text-cream-dim'
                  }`}>{row.level}</span>
                </td>
                <td className="py-1 px-2 text-right text-[10px] max-w-[80px] truncate">{row.team}</td>
                <td className="py-1 px-2 text-right">{s.gs}</td>
                <td className="py-1 px-2 text-right">{s.wins}</td>
                <td className="py-1 px-2 text-right">{s.losses}</td>
                <td className="py-1 px-2 text-right">{s.saves}</td>
                <td className="py-1 px-2 text-right">{s.ip.toFixed(1)}</td>
                <td className="py-1 px-2 text-right">{s.hits_allowed}</td>
                <td className="py-1 px-2 text-right">{s.er}</td>
                <td className="py-1 px-2 text-right">{s.bb_p}</td>
                <td className="py-1 px-2 text-right">{s.so_p}</td>
                <td className="py-1 px-2 text-right">{s.era.toFixed(2)}</td>
                <td className="py-1 px-2 text-right">{s.whip.toFixed(3)}</td>
              </tr>
            );
          })}
          {logs.length > 0 && (() => {
            const tot = logs.reduce((acc, row) => {
              const s = row.stats;
              return {
                gs: acc.gs+s.gs, wins: acc.wins+s.wins, losses: acc.losses+s.losses,
                saves: acc.saves+s.saves, ip: acc.ip+s.ip,
                hits_allowed: acc.hits_allowed+s.hits_allowed, er: acc.er+s.er,
                bb_p: acc.bb_p+s.bb_p, so_p: acc.so_p+s.so_p,
              };
            }, { gs:0,wins:0,losses:0,saves:0,ip:0,hits_allowed:0,er:0,bb_p:0,so_p:0 });
            const era  = tot.ip > 0 ? ((tot.er / tot.ip) * 9).toFixed(2) : '0.00';
            const whip = tot.ip > 0 ? ((tot.hits_allowed + tot.bb_p) / tot.ip).toFixed(3) : '0.000';
            return (
              <tr className="border-t-2 border-gold/40 bg-gold/5 text-gold font-bold">
                <td className="py-1.5 px-2 text-left">Career</td>
                <td className="py-1 px-2 text-right text-cream-dim text-[10px]">{logs.length} yrs</td>
                <td className="py-1 px-2 text-right">—</td>
                <td className="py-1 px-2 text-right">{tot.gs}</td>
                <td className="py-1 px-2 text-right">{tot.wins}</td>
                <td className="py-1 px-2 text-right">{tot.losses}</td>
                <td className="py-1 px-2 text-right">{tot.saves}</td>
                <td className="py-1 px-2 text-right">{tot.ip.toFixed(1)}</td>
                <td className="py-1 px-2 text-right">{tot.hits_allowed}</td>
                <td className="py-1 px-2 text-right">{tot.er}</td>
                <td className="py-1 px-2 text-right">{tot.bb_p}</td>
                <td className="py-1 px-2 text-right">{tot.so_p}</td>
                <td className="py-1 px-2 text-right">{era}</td>
                <td className="py-1 px-2 text-right">{whip}</td>
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}

export function CareerStatsPage() {
  const navigate = useNavigate();
  const careerState = useCareerStore(s => s.careerState);
  const [activeTab, setActiveTab] = useState('table');

  if (!careerState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Panel className="text-center max-w-sm">
          <p className="text-cream py-4">No career in progress.</p>
          <Button onClick={() => navigate('/career/new')}>Start Career</Button>
        </Panel>
      </div>
    );
  }

  const { player, seasonLog, careerStats: cs, year, seasonStats: currentSeason } = careerState;
  const isPitcher = player.position === 'P';

  // Combine season log with current season if in-progress
  const allLogs: SeasonRecord[] = [
    ...seasonLog,
    ...(currentSeason.g > 0 || currentSeason.gs > 0
      ? [{ year, level: careerState.level, team: careerState.currentTeam, stats: currentSeason, awards: careerState.currentSeasonAwards }]
      : []),
  ];

  // Build chart data
  const chartData = allLogs.map(row => ({
    year: row.year,
    avg: parseFloat((row.stats.avg * 1000).toFixed(0)),    // batting avg ×1000
    hr: row.stats.hr,
    rbi: row.stats.rbi,
    era: parseFloat(row.stats.era.toFixed(2)),
    wins: row.stats.wins,
    so: row.stats.so_p,
  }));

  const CHART_TOOLTIP_STYLE = {
    backgroundColor: '#0f1929',
    border: '1px solid #1e2d44',
    borderRadius: '6px',
    color: CREAM,
    fontSize: 11,
  };

  const tabs = [
    { id: 'table',  label: 'Season Table' },
    { id: 'charts', label: 'Charts' },
    { id: 'milestones', label: 'Milestones' },
  ];

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl text-gold tracking-tight uppercase">
              {player.firstName} {player.lastName} — Career Stats
            </h1>
            <p className="text-cream-dim text-sm font-mono mt-1">
              {player.position} · Age {player.age} · {cs.seasons} seasons
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/career')}>
            ← Dashboard
          </Button>
        </div>

        {/* Career summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isPitcher ? (
            <>
              <KpiCard label="Career Wins"  value={cs.pitching.wins} />
              <KpiCard label="Career K"     value={cs.pitching.so_p} />
              <KpiCard label="Career ERA"   value={cs.pitching.ip > 0 ? ((cs.pitching.er/cs.pitching.ip)*9).toFixed(2) : '—'} />
              <KpiCard label="Career WHIP"  value={cs.pitching.ip > 0 ? ((cs.pitching.hits_allowed+cs.pitching.bb_p)/cs.pitching.ip).toFixed(3) : '—'} />
            </>
          ) : (
            <>
              <KpiCard label="Career HR"    value={cs.batting.hr} />
              <KpiCard label="Career Hits"  value={cs.batting.h} />
              <KpiCard label="Career RBI"   value={cs.batting.rbi} />
              <KpiCard label="Career AVG"   value={cs.batting.ab > 0 ? fmt3(cs.batting.h/cs.batting.ab) : '.000'} />
            </>
          )}
        </div>

        {/* Tabs */}
        <Panel>
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          <div className="mt-4">
            {activeTab === 'table' && (
              allLogs.length === 0 ? (
                <p className="text-cream-dim text-sm text-center py-8 font-mono">No seasons recorded yet.</p>
              ) : isPitcher ? (
                <PitchingSeasonTable logs={allLogs} />
              ) : (
                <BattingSeasonTable logs={allLogs} />
              )
            )}

            {activeTab === 'charts' && (
              <div className="space-y-6">
                {chartData.length === 0 && (
                  <p className="text-cream-dim text-sm text-center py-8 font-mono">No data to chart yet.</p>
                )}
                {chartData.length > 0 && !isPitcher && (
                  <>
                    {/* Batting average chart */}
                    <div>
                      <h3 className="text-cream-dim text-xs font-mono uppercase tracking-wider mb-3">
                        Batting Average (×1000)
                      </h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d44" />
                          <XAxis dataKey="year" stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <YAxis stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} domain={[0, 400]} />
                          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`.${String(Number(v)).padStart(3,'0')}`, 'AVG']} />
                          <Line type="monotone" dataKey="avg" stroke={GOLD} strokeWidth={2} dot={{ r: 3, fill: GOLD }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* HR chart */}
                    <div>
                      <h3 className="text-cream-dim text-xs font-mono uppercase tracking-wider mb-3">
                        Home Runs Per Season
                      </h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d44" />
                          <XAxis dataKey="year" stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <YAxis stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                          <Bar dataKey="hr" fill="#ef4444" radius={[3,3,0,0]} name="HR" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* RBI chart */}
                    <div>
                      <h3 className="text-cream-dim text-xs font-mono uppercase tracking-wider mb-3">
                        RBI Per Season
                      </h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d44" />
                          <XAxis dataKey="year" stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <YAxis stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                          <Bar dataKey="rbi" fill="#22c55e" radius={[3,3,0,0]} name="RBI" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}

                {chartData.length > 0 && isPitcher && (
                  <>
                    {/* ERA chart */}
                    <div>
                      <h3 className="text-cream-dim text-xs font-mono uppercase tracking-wider mb-3">ERA Per Season</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d44" />
                          <XAxis dataKey="year" stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <YAxis stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} domain={[0, 8]} />
                          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                          <Line type="monotone" dataKey="era" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} name="ERA" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Wins chart */}
                    <div>
                      <h3 className="text-cream-dim text-xs font-mono uppercase tracking-wider mb-3">Wins Per Season</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d44" />
                          <XAxis dataKey="year" stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <YAxis stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                          <Bar dataKey="wins" fill={GOLD} radius={[3,3,0,0]} name="Wins" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Strikeouts chart */}
                    <div>
                      <h3 className="text-cream-dim text-xs font-mono uppercase tracking-wider mb-3">Strikeouts Per Season</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d44" />
                          <XAxis dataKey="year" stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <YAxis stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                          <Bar dataKey="so" fill="#3b82f6" radius={[3,3,0,0]} name="K" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'milestones' && (
              <MilestonesTab careerState={careerState} />
            )}
          </div>
        </Panel>

        {/* Awards log */}
        {allLogs.some(l => l.awards.length > 0) && (
          <Panel title="Awards">
            <div className="space-y-2">
              {allLogs.filter(l => l.awards.length > 0).map((row, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-cream-dim text-xs font-mono w-12">{row.year}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {row.awards.map(award => (
                      <span key={award} className="px-2 py-0.5 rounded bg-gold/20 text-gold text-xs font-mono">
                        {award}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-navy-light border border-navy-lighter rounded-lg p-3 text-center">
      <p className="text-cream-dim text-xs font-mono uppercase tracking-wide">{label}</p>
      <p className="text-gold font-display text-2xl mt-1">{value}</p>
    </div>
  );
}

function MilestonesTab({ careerState }: { careerState: CareerState }) {
  const milestones: Milestone[] = careerState.milestones;
  const achieved = milestones.filter(m => m.achieved);
  const pending  = milestones.filter(m => !m.achieved);

  return (
    <div className="space-y-4">
      {achieved.length === 0 && pending.length === 0 && (
        <p className="text-cream-dim text-sm text-center py-4 font-mono">No milestones tracked yet. Keep playing!</p>
      )}
      {achieved.length > 0 && (
        <div>
          <h4 className="text-green-400 font-mono text-xs uppercase tracking-wide mb-2">Achieved</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {achieved.map(m => (
              <div key={m.id} className="flex items-start gap-2 p-2 rounded bg-green-900/20 border border-green-800/40">
                <span className="text-green-400 text-base mt-0.5">✓</span>
                <div>
                  <p className="text-cream text-xs font-mono font-bold">{m.label}</p>
                  <p className="text-cream-dim text-[10px]">{m.description}</p>
                  {m.year > 0 && <p className="text-green-400/70 text-[9px] mt-0.5">Achieved {m.year}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {pending.length > 0 && (
        <div>
          <h4 className="text-cream-dim/60 font-mono text-xs uppercase tracking-wide mb-2">In Progress</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {pending.slice(0, 10).map(m => (
              <div key={m.id} className="flex items-start gap-2 p-2 rounded bg-navy/50 border border-navy-lighter/30">
                <span className="text-cream-dim/40 text-base mt-0.5">○</span>
                <div>
                  <p className="text-cream-dim text-xs font-mono">{m.label}</p>
                  <p className="text-cream-dim/60 text-[10px]">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

