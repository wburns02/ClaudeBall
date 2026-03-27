import { useState, useMemo } from 'react';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';
import { getDynastyBridge } from '@/dynasty/bridge/FranchiseIntegration.ts';
import { getHatRepPenalty, getHatSavings, calculateProfitLoss, createOwnership } from '@/dynasty/components/Ownership.ts';
import type { OwnerHat, OwnershipStyle, OwnershipComponent } from '@/dynasty/components/Ownership.ts';
import type { PersonalityComponent } from '@/dynasty/components/Personality.ts';
import type { ActiveScandal } from '@/dynasty/systems/ScandalSystem.ts';

const STYLE_DESCRIPTIONS: Record<OwnershipStyle, string> = {
  hands_off: 'Delegate everything to your GM. You set the budget and watch from the luxury box.',
  active: 'Approve major trades and signings. Hire/fire all staff. Day-to-day is delegated.',
  maniac: 'You ARE the GM. Optionally the manager too. Total control. Total chaos.',
};

export function DynastyOwnerPage() {
  const bridge = getDynastyBridge();

  // Demo ownership data (real data would come from entity)
  const [ownership, setOwnership] = useState<OwnershipComponent>(() => {
    if (bridge) {
      const entities = bridge.entities.getAllEntityIds();
      for (const id of entities) {
        const o = bridge.entities.getComponent<OwnershipComponent>(id, 'Ownership');
        if (o) return o;
      }
    }
    return createOwnership('team1', 800000);
  });

  const [style, setStyle] = useState<OwnershipStyle>(ownership.style);
  const [hats, setHats] = useState<OwnerHat[]>(ownership.hats);

  const repPenalty = getHatRepPenalty(hats);
  const savings = getHatSavings(hats);
  const profitLoss = calculateProfitLoss({ ...ownership, hats });

  // Get scandal data from bridge
  const scandals: ActiveScandal[] = useMemo(() => {
    if (!bridge) return [];
    return bridge.scandals.getActiveScandals();
  }, [bridge]);

  // Get high-wildcard players
  const wildcardPlayers = useMemo(() => {
    if (!bridge) return [];
    return bridge.entities.getEntitiesWith('Personality')
      .map(id => {
        const p = bridge.entities.getComponent<PersonalityComponent>(id, 'Personality');
        return p && p.wildcard > 50 ? { id, wildcard: p.wildcard, name: `Player ${id.slice(2)}` } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.wildcard - a!.wildcard) as { id: string; wildcard: number; name: string }[];
  }, [bridge]);

  const toggleHat = (hat: OwnerHat) => {
    if (hat === 'owner') return; // Can't remove owner hat
    setHats(prev => prev.includes(hat) ? prev.filter(h => h !== hat) : [...prev, hat]);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl text-gold uppercase tracking-wide">Owner's Suite</h1>
        <p className="font-mono text-xs text-cream-dim/50 mt-1">
          Franchise Value: ${(ownership.franchiseValue / 1000).toFixed(0)}M · Year {ownership.yearsOwned + 1}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ownership Style */}
        <Panel title="Ownership Style">
          <div className="space-y-2">
            {(['hands_off', 'active', 'maniac'] as OwnershipStyle[]).map(s => (
              <button key={s} onClick={() => setStyle(s)}
                className={cn('w-full text-left rounded-lg border p-3 transition-all cursor-pointer',
                  style === s ? 'border-gold bg-gold/15' : 'border-navy-lighter hover:border-gold/30')}>
                <div className="font-mono text-sm text-cream capitalize">{s.replace('_', ' ')}</div>
                <div className="font-mono text-xs text-cream-dim/60 mt-0.5">{STYLE_DESCRIPTIONS[s]}</div>
              </button>
            ))}
          </div>
        </Panel>

        {/* Hat Selector */}
        <Panel title="Wear Multiple Hats">
          <div className="space-y-3">
            {(['owner', 'gm', 'manager'] as OwnerHat[]).map(hat => (
              <div key={hat} className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm text-cream capitalize">{hat === 'gm' ? 'General Manager' : hat}</div>
                  {hat !== 'owner' && (
                    <div className="font-mono text-[10px] text-cream-dim/50">
                      Saves ${hat === 'gm' ? '4' : '2'}M/year
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggleHat(hat)}
                  disabled={hat === 'owner'}
                  className={cn(
                    'px-3 py-1 rounded-full font-mono text-xs transition-all',
                    hats.includes(hat)
                      ? 'bg-gold/20 text-gold border border-gold/40'
                      : 'bg-navy-lighter text-cream-dim border border-navy-lighter hover:border-gold/30 cursor-pointer',
                    hat === 'owner' && 'opacity-60 cursor-not-allowed'
                  )}>
                  {hats.includes(hat) ? 'Active' : 'Take Over'}
                </button>
              </div>
            ))}

            {/* Penalty Display */}
            <div className="mt-4 pt-3 border-t border-navy-lighter">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-cream-dim">Salary Savings</span>
                <span className="text-green-light">+${(savings / 1000).toFixed(0)}M/year</span>
              </div>
              {(repPenalty.media !== 0 || repPenalty.fan !== 0) && (
                <>
                  <div className="flex justify-between font-mono text-xs mt-1">
                    <span className="text-cream-dim">Media Rep Impact</span>
                    <span className="text-red-400">{repPenalty.media}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs mt-1">
                    <span className="text-cream-dim">Fan Rep Impact</span>
                    <span className="text-red-400">{repPenalty.fan}</span>
                  </div>
                </>
              )}
              {hats.includes('manager') && hats.includes('gm') && (
                <div className="mt-2 font-mono text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
                  "OWNER NAMES HIMSELF GM AND MANAGER" — media firestorm incoming
                </div>
              )}
            </div>
          </div>
        </Panel>

        {/* Financials */}
        <Panel title="Franchise Financials">
          <div className="space-y-2 font-mono text-sm">
            <div className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-wider">Revenue</div>
            {Object.entries(ownership.revenue).map(([key, val]) => (
              <div key={key} className="flex justify-between">
                <span className="text-cream-dim capitalize">{key}</span>
                <span className="text-green-light">${(val / 1000).toFixed(0)}M</span>
              </div>
            ))}
            <div className="border-t border-navy-lighter pt-2 mt-2">
              <div className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-wider">Expenses</div>
            </div>
            {Object.entries(ownership.expenses).map(([key, val]) => (
              <div key={key} className="flex justify-between">
                <span className="text-cream-dim capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="text-red-400">-${(val / 1000).toFixed(0)}M</span>
              </div>
            ))}
            <div className="border-t border-navy-lighter pt-2 flex justify-between font-bold">
              <span className="text-cream">Profit/Loss</span>
              <span className={profitLoss >= 0 ? 'text-green-light' : 'text-red-400'}>
                {profitLoss >= 0 ? '+' : ''}${(profitLoss / 1000).toFixed(0)}M
              </span>
            </div>
          </div>
        </Panel>

        {/* Scandal Monitor */}
        <Panel title="Scandal Monitor">
          {wildcardPlayers.length > 0 ? (
            <div className="space-y-2">
              <div className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-wider mb-2">
                High-Risk Players (Wildcard &gt; 50)
              </div>
              {wildcardPlayers.slice(0, 8).map(p => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="font-mono text-xs text-cream">{p.name}</span>
                  <span className={cn('font-mono text-xs font-bold',
                    p.wildcard >= 70 ? 'text-red-400' : p.wildcard >= 60 ? 'text-orange-400' : 'text-gold'
                  )}>
                    {p.wildcard} WC
                  </span>
                </div>
              ))}
              {scandals.length > 0 && (
                <div className="mt-3 pt-3 border-t border-navy-lighter">
                  <div className="font-mono text-[10px] text-red-400 uppercase tracking-wider mb-2">
                    Active Incidents ({scandals.length})
                  </div>
                  {scandals.map((s, i) => (
                    <div key={i} className="text-xs font-mono text-cream-dim bg-red-400/5 border border-red-400/20 rounded px-2 py-1 mb-1">
                      <span className="text-red-400 uppercase">{s.tier}</span>: {s.description}
                      {s.suspension > 0 && <span className="text-cream-dim/50"> ({s.suspension}G suspension)</span>}
                    </div>
                  ))}
                </div>
              )}
              <Button size="sm" className="mt-2 w-full" variant="secondary">
                Invest in Culture ($500K/yr)
              </Button>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-cream-dim/40 font-mono text-sm">No high-risk players detected</p>
              <p className="text-cream-dim/30 font-mono text-xs mt-1">Players with Wildcard &gt; 50 appear here</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
