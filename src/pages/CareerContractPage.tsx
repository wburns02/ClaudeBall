import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useCareerStore } from '@/stores/careerStore.ts';
import { generateContractOffers } from '@/engine/player/CareerEngine.ts';
import { RandomProvider } from '@/engine/core/RandomProvider.ts';
import { cn } from '@/lib/cn.ts';

function makeRng() {
  return new RandomProvider(Date.now() ^ (Math.random() * 0xffffffff) | 0);
}

interface Offer {
  teamName: string;
  years: number;
  salary: number;
}

function OfferCard({
  offer,
  isCurrent,
  selected,
  onSelect,
}: {
  offer: Offer;
  isCurrent: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const total = (offer.salary * offer.years) / 1000;
  return (
    <button
      onClick={onSelect}
      className={cn(
        'text-left w-full p-4 rounded-lg border-2 transition-all cursor-pointer',
        'hover:scale-[1.01] active:scale-[0.99]',
        selected
          ? 'border-gold bg-gold/10 shadow-[0_0_16px_#d4a84344]'
          : 'border-navy-lighter bg-navy-light/60 hover:border-navy-lighter/80'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-base text-cream tracking-wide">{offer.teamName}</span>
            {isCurrent && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 font-mono uppercase">Current</span>
            )}
          </div>
          <div className="mt-1 space-y-0.5 text-xs font-mono text-cream-dim">
            <div>{offer.years} year{offer.years > 1 ? 's' : ''}</div>
            <div>${(offer.salary / 1000).toFixed(2)}M / year</div>
            <div className="text-gold">${total.toFixed(2)}M total value</div>
          </div>
        </div>
        <div className={cn(
          'w-5 h-5 rounded-full border-2 mt-1 flex-shrink-0 transition-all',
          selected ? 'border-gold bg-gold shadow-[0_0_8px_#d4a843]' : 'border-navy-lighter'
        )} />
      </div>
    </button>
  );
}

export function CareerContractPage() {
  const navigate = useNavigate();
  const careerState    = useCareerStore(s => s.careerState);
  const signContract   = useCareerStore(s => s.signContract);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [generated, setGenerated] = useState(false);
  const [signed, setSigned] = useState(false);

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

  const { contract, player, currentTeam, careerStats: cs, year } = careerState;
  const isPitcher = player.position === 'P';

  function handleGenerate() {
    const rng = makeRng();
    const generated = generateContractOffers(careerState!, rng);
    setOffers(generated);
    setGenerated(true);
    setSelected(null);
  }

  function handleSign() {
    if (!selected) return;
    signContract(selected);
    setSigned(true);
    setTimeout(() => navigate('/career'), 1500);
  }

  // Career value summary
  const careerValue = isPitcher
    ? `${cs.pitching.wins}W · ${cs.pitching.so_p}K · ${cs.pitching.ip > 0 ? ((cs.pitching.er/cs.pitching.ip)*9).toFixed(2) : '—'} ERA`
    : `${cs.batting.h} H · ${cs.batting.hr} HR · ${cs.batting.rbi} RBI · ${cs.batting.ab > 0 ? (cs.batting.h/cs.batting.ab).toFixed(3).replace(/^0/,'') : '.000'} AVG`;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl text-gold tracking-tight uppercase">Contract Negotiations</h1>
            <p className="text-cream-dim text-sm font-mono mt-1">
              {player.firstName} {player.lastName} · Age {player.age} · {year}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/career')}>← Dashboard</Button>
        </div>

        {/* Current contract */}
        <Panel title="Current Contract">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-mono">
            <div>
              <p className="text-cream-dim text-xs uppercase tracking-wide">Team</p>
              <p className="text-cream mt-1">{contract.teamName}</p>
            </div>
            <div>
              <p className="text-cream-dim text-xs uppercase tracking-wide">Annual Salary</p>
              <p className="text-gold mt-1">${(contract.annualSalary / 1000).toFixed(2)}M</p>
            </div>
            <div>
              <p className="text-cream-dim text-xs uppercase tracking-wide">Length</p>
              <p className="text-cream mt-1">{contract.totalYears} years</p>
            </div>
            <div>
              <p className="text-cream-dim text-xs uppercase tracking-wide">Years Remaining</p>
              <p className={cn('mt-1 font-bold', contract.yearsRemaining === 0 ? 'text-red-400' : 'text-cream')}>
                {contract.yearsRemaining}
              </p>
            </div>
          </div>
          {contract.yearsRemaining === 0 && (
            <p className="text-red-400 text-xs font-mono mt-3">
              Contract expired — you are a free agent.
            </p>
          )}
        </Panel>

        {/* Career value summary */}
        <Panel title="Market Value Factors">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-cream-dim">Career Stats</span>
                <span className="text-cream">{careerValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cream-dim">Age</span>
                <span className={cn('font-bold', player.age > 35 ? 'text-red-400' : player.age > 30 ? 'text-yellow-400' : 'text-green-400')}>
                  {player.age} {player.age > 35 ? '(declining)' : player.age > 30 ? '(veteran)' : '(prime)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-cream-dim">Seasons</span>
                <span className="text-cream">{cs.seasons}</span>
              </div>
            </div>
            <div className="space-y-1 text-xs font-mono text-cream-dim/70">
              <p>• More career stats = higher market value</p>
              <p>• Players over 33 see salary reductions</p>
              <p>• Current team always makes a retention offer</p>
              <p>• FA lets you sign with any MLB team</p>
            </div>
          </div>
        </Panel>

        {/* Generate offers */}
        {!generated && !signed && (
          <div className="text-center py-4 space-y-3">
            <p className="text-cream-dim text-sm font-mono">
              {contract.yearsRemaining === 0
                ? 'Your contract has expired. Generate free agent offers.'
                : 'You can explore the market for better deals.'}
            </p>
            <Button onClick={handleGenerate} size="lg">
              {contract.yearsRemaining === 0 ? 'Enter Free Agency' : 'Explore Market'}
            </Button>
          </div>
        )}

        {/* Offers */}
        {generated && !signed && (
          <div className="space-y-3">
            <Panel title="Available Offers">
              <div className="space-y-2">
                {offers.map((offer, i) => (
                  <OfferCard
                    key={i}
                    offer={offer}
                    isCurrent={offer.teamName === currentTeam}
                    selected={selected?.teamName === offer.teamName}
                    onSelect={() => setSelected(offer)}
                  />
                ))}
              </div>
            </Panel>

            {selected && (
              <div className="p-4 rounded-lg border border-gold/40 bg-gold/5">
                <p className="text-gold font-mono text-sm font-bold mb-2">
                  Selected: {selected.teamName}
                </p>
                <p className="text-cream-dim text-xs font-mono">
                  {selected.years} yr{selected.years > 1 ? 's' : ''} ·
                  ${(selected.salary / 1000).toFixed(2)}M/yr ·
                  Total: ${((selected.salary * selected.years) / 1000).toFixed(2)}M
                </p>
                <div className="mt-3 flex gap-2">
                  <Button onClick={handleSign}>Sign Contract</Button>
                  <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => { setGenerated(false); setOffers([]); }}>
                Decline All
              </Button>
              <Button variant="ghost" size="sm" onClick={handleGenerate}>
                Refresh Offers
              </Button>
            </div>
          </div>
        )}

        {signed && (
          <div className="p-6 rounded-lg border-2 border-gold text-center" style={{ backgroundColor: '#d4a84318' }}>
            <p className="font-display text-2xl text-gold tracking-wide uppercase">Contract Signed!</p>
            <p className="text-cream-dim font-mono text-sm mt-2">Returning to dashboard...</p>
          </div>
        )}

        {/* Free agency tips */}
        <Panel title="Free Agency Guide">
          <ul className="space-y-1 text-cream-dim text-xs font-mono">
            <li>• Offers generate fresh each time — refresh for different teams.</li>
            <li>• Longer contracts provide security but less flexibility to re-sign.</li>
            <li>• Signing with a new team changes your currentTeam on the dashboard.</li>
            <li>• After your career ends, contract value contributes to HOF case.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
