import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';

interface TeamOption {
  id: string;
  city: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
  league: string;
  division: string;
}

interface NewFranchisePageProps {
  teamOptions: TeamOption[];
  allTeams: import('@/engine/types/index.ts').Team[];
  leagueStructure: Record<string, Record<string, string[]>>;
}

export function NewFranchisePage({ teamOptions, allTeams, leagueStructure }: NewFranchisePageProps) {
  const navigate = useNavigate();
  const { startFranchise } = useFranchiseStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleStart = () => {
    if (!selectedId) return;
    startFranchise(allTeams, leagueStructure, selectedId);
    navigate('/franchise');
  };

  // Group by league/division
  const grouped: Record<string, Record<string, TeamOption[]>> = {};
  for (const t of teamOptions) {
    if (!grouped[t.league]) grouped[t.league] = {};
    if (!grouped[t.league][t.division]) grouped[t.league][t.division] = [];
    grouped[t.league][t.division].push(t);
  }

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl text-gold tracking-wide uppercase">New Franchise</h1>
        <p className="font-mono text-cream-dim text-sm mt-2">Select your team</p>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([league, divisions]) => (
          <div key={league}>
            <h2 className="font-display text-xl text-gold mb-3 tracking-wider uppercase">{league}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(divisions).map(([division, teams]) => (
                <Panel key={division} title={division}>
                  <div className="space-y-1">
                    {teams.map(team => (
                      <button
                        key={team.id}
                        onClick={() => setSelectedId(team.id)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-md transition-all cursor-pointer',
                          'flex items-center gap-2',
                          selectedId === team.id
                            ? 'bg-gold/15 border border-gold/50 border-l-2 border-l-gold'
                            : 'hover:bg-navy-lighter/40 border border-transparent hover:border-navy-lighter/60',
                        )}
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: team.primaryColor }}
                        />
                        <div className="flex-1">
                          <p className={cn('text-sm font-medium', selectedId === team.id ? 'text-gold' : 'text-cream')}>{team.city} {team.name}</p>
                          <p className="text-cream-dim text-xs font-mono">{team.abbreviation}</p>
                        </div>
                        {selectedId === team.id && (
                          <span className="text-gold text-xs font-bold shrink-0">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 mt-8">
        <div className="flex gap-4">
          <Button variant="ghost" onClick={() => navigate('/')}>Back</Button>
          <Button size="lg" disabled={!selectedId} onClick={handleStart}>
            Start Season
          </Button>
        </div>
        {!selectedId && (
          <p className="font-mono text-xs text-cream-dim/50">Select a team above to begin</p>
        )}
      </div>
    </div>
  );
}
