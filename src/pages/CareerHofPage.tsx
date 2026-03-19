import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { ProgressBar } from '@/components/ui/ProgressBar.tsx';
import { useCareerStore } from '@/stores/careerStore.ts';
import { cn } from '@/lib/cn.ts';

interface HofCriterion {
  label: string;
  current: number;
  threshold: number;
  unit?: string;
}

function CriterionRow({ label, current, threshold, unit = '' }: HofCriterion) {
  const pct = Math.min(100, (current / threshold) * 100);
  const met = current >= threshold;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-mono">
        <span className={met ? 'text-green-400' : 'text-cream-dim'}>{label}</span>
        <span className={met ? 'text-green-400 font-bold' : 'text-cream'}>
          {current.toLocaleString()}{unit} / {threshold.toLocaleString()}{unit}
          {met && ' ✓'}
        </span>
      </div>
      <ProgressBar value={pct} color={met ? '#22c55e' : '#d4a843'} />
    </div>
  );
}

export function CareerHofPage() {
  const navigate = useNavigate();
  const careerState = useCareerStore(s => s.careerState);
  const retirePlayer = useCareerStore(s => s.retirePlayer);

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

  const { player, careerStats: cs, hofStatus, retired, year } = careerState;
  const isPitcher = player.position === 'P';

  // Compute current HOF score live
  let hofScore = 0;
  if (isPitcher) {
    hofScore += Math.min(40, (cs.pitching.wins / 300) * 40);
    hofScore += Math.min(30, (cs.pitching.so_p / 3000) * 30);
    hofScore += Math.min(20, cs.seasons >= 15 ? 20 : (cs.seasons / 15) * 20);
    hofScore += Math.min(10, (cs.seasons / 20) * 10);
  } else {
    hofScore += Math.min(30, (cs.batting.h / 3000) * 30);
    hofScore += Math.min(25, (cs.batting.hr / 500) * 25);
    hofScore += Math.min(20, (cs.batting.rbi / 1500) * 20);
    hofScore += Math.min(15, (cs.batting.sb / 300) * 15);
    const avg = cs.batting.ab > 0 ? cs.batting.h / cs.batting.ab : 0;
    hofScore += Math.min(10, (avg / 0.300) * 10);
  }
  hofScore = Math.min(100, Math.round(hofScore));

  const inducted = hofStatus.inducted || (retired && hofScore >= 75);

  const battingCriteria: HofCriterion[] = [
    { label: '3,000 Hits',   current: cs.batting.h,   threshold: 3000 },
    { label: '500 HR',       current: cs.batting.hr,  threshold: 500  },
    { label: '1,500 RBI',    current: cs.batting.rbi, threshold: 1500 },
    { label: '300 SB',       current: cs.batting.sb,  threshold: 300  },
    { label: '.300 Career AVG', current: Math.round((cs.batting.ab > 0 ? cs.batting.h/cs.batting.ab : 0) * 1000), threshold: 300, unit: '' },
  ];

  const pitchingCriteria: HofCriterion[] = [
    { label: '300 Wins',      current: cs.pitching.wins,  threshold: 300  },
    { label: '3,000 K',       current: cs.pitching.so_p,  threshold: 3000 },
    { label: '15 Seasons',    current: cs.seasons,        threshold: 15   },
    { label: '3.50 ERA',      current: Math.round((cs.pitching.ip > 0 ? (cs.pitching.er/cs.pitching.ip)*9 : 9) * 10), threshold: 350, unit: '' },
  ];

  const criteria = isPitcher ? pitchingCriteria : battingCriteria;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl text-gold tracking-tight uppercase">
              Hall of Fame
            </h1>
            <p className="text-cream-dim text-sm font-mono mt-1">
              {player.firstName} {player.lastName} · Age {player.age} · {cs.seasons} seasons
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/career')}>← Dashboard</Button>
        </div>

        {/* Inducted Banner */}
        {inducted && (
          <div
            className="p-6 rounded-xl border-2 text-center space-y-3"
            style={{ borderColor: '#d4a843', backgroundColor: '#d4a84318', boxShadow: '0 0 32px #d4a84344' }}
          >
            <p className="font-display text-4xl text-gold tracking-wide uppercase">
              Hall of Famer
            </p>
            <p className="text-cream font-mono text-lg">
              {player.firstName} {player.lastName}
            </p>
            {hofStatus.inductionYear && (
              <p className="text-cream-dim font-mono text-sm">
                Inducted: {hofStatus.inductionYear}
              </p>
            )}
            <div className="flex justify-center gap-4 pt-2 text-cream-dim text-xs font-mono">
              {isPitcher ? (
                <>
                  <span>{cs.pitching.wins} W</span>
                  <span>{cs.pitching.so_p.toLocaleString()} K</span>
                  <span>{cs.seasons} seasons</span>
                </>
              ) : (
                <>
                  <span>{cs.batting.h.toLocaleString()} H</span>
                  <span>{cs.batting.hr} HR</span>
                  <span>{cs.batting.rbi.toLocaleString()} RBI</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* HOF Score */}
        <Panel title="Hall of Fame Score">
          <div className="space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-4 mb-2"
                style={{
                  borderColor: hofScore >= 75 ? '#22c55e' : hofScore >= 50 ? '#d4a843' : '#1e2d44',
                  backgroundColor: hofScore >= 75 ? '#22c55e18' : hofScore >= 50 ? '#d4a84318' : 'transparent',
                }}
              >
                <span className="font-display text-3xl" style={{ color: hofScore >= 75 ? '#22c55e' : hofScore >= 50 ? '#d4a843' : '#a09880' }}>
                  {hofScore}
                </span>
              </div>
              <p className="text-cream-dim text-xs font-mono">/ 100 HOF Score</p>
              <p className={cn(
                'text-sm font-mono font-bold mt-1',
                hofScore >= 75 ? 'text-green-400' : hofScore >= 50 ? 'text-yellow-400' : 'text-cream-dim'
              )}>
                {hofScore >= 75 ? 'HOF Worthy' : hofScore >= 50 ? 'Borderline Case' : 'Not Yet HOF Eligible'}
              </p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-cream-dim mb-1">
                <span>Overall HOF Score</span>
                <span>Need 75 for Induction</span>
              </div>
              <ProgressBar value={hofScore} color={hofScore >= 75 ? '#22c55e' : '#d4a843'} showPercent />
            </div>
          </div>
        </Panel>

        {/* Criteria breakdown */}
        <Panel title={`${isPitcher ? 'Pitching' : 'Batting'} HOF Criteria`}>
          <div className="space-y-4">
            {criteria.map(c => (
              <CriterionRow key={c.label} {...c} />
            ))}
          </div>
          <p className="text-cream-dim/60 text-xs font-mono mt-4">
            Meeting individual thresholds earns partial credit. Total across all criteria = HOF Score.
          </p>
        </Panel>

        {/* HOF milestones */}
        <Panel title="Career Milestones">
          <div className="grid grid-cols-2 gap-2">
            {careerState.milestones.filter(m => m.achieved).map(m => (
              <div key={m.id} className="flex items-center gap-2 p-2 rounded bg-green-900/20 border border-green-800/40">
                <span className="text-green-400 text-sm">✓</span>
                <div>
                  <p className="text-cream text-xs font-mono">{m.label}</p>
                  {m.year > 0 && <p className="text-green-400/60 text-[10px]">{m.year}</p>}
                </div>
              </div>
            ))}
            {careerState.milestones.filter(m => m.achieved).length === 0 && (
              <p className="col-span-2 text-cream-dim text-xs font-mono py-2 text-center">
                No milestones achieved yet. Keep playing!
              </p>
            )}
          </div>
        </Panel>

        {/* Retirement */}
        {!retired && (
          <Panel title="Retirement">
            <div className="space-y-3">
              <p className="text-cream-dim text-sm font-mono">
                When you retire, your final HOF score is locked in.
                A score of 75+ earns induction {year + 5}.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="text-red-400 border-red-900/50"
                  onClick={() => {
                    if (confirm('Retire your player? This action cannot be undone.')) {
                      retirePlayer();
                    }
                  }}
                >
                  Retire Now
                </Button>
                <span className="text-cream-dim text-xs font-mono">
                  (You can also retire from the Dashboard offseason screen)
                </span>
              </div>
            </div>
          </Panel>
        )}

        {/* HOF info */}
        <Panel title="HOF Scoring Guide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-cream-dim">
            <div>
              <p className="text-cream font-bold mb-2">Batters (100 pts total)</p>
              <ul className="space-y-1">
                <li>3,000 Hits → up to 30 pts</li>
                <li>500 HR → up to 25 pts</li>
                <li>1,500 RBI → up to 20 pts</li>
                <li>300 SB → up to 15 pts</li>
                <li>.300 AVG → up to 10 pts</li>
              </ul>
            </div>
            <div>
              <p className="text-cream font-bold mb-2">Pitchers (100 pts total)</p>
              <ul className="space-y-1">
                <li>300 Wins → up to 40 pts</li>
                <li>3,000 K → up to 30 pts</li>
                <li>15+ Seasons → up to 20 pts</li>
                <li>20 Seasons → up to 10 pts</li>
              </ul>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
