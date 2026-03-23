import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useCoachingStore } from '@/stores/coachingStore.ts';
import {
  ROLE_LABELS, ROLE_ORDER, overallRating, ratingColor, ratingLabel,
  personalityIcon, personalityColor, totalStaffSalary, type Coach, type CoachRole, type StaffBonus,
} from '@/engine/staff/CoachingStaff.ts';
import { cn } from '@/lib/cn.ts';

// ── Rating bar ──────────────────────────────────────────────────
function RatingBar({ label, value }: { label: string; value: number }) {
  const color = ratingColor(value);
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-cream-dim/60 w-16 shrink-0 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-1.5 bg-navy-lighter/30 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono text-[10px] font-bold w-6 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

// ── Coach card ──────────────────────────────────────────────────
function CoachCard({
  coach,
  onFire,
  onReplace,
  compact,
}: {
  coach: Coach;
  onFire?: () => void;
  onReplace?: () => void;
  compact?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const [confirmFire, setConfirmFire] = useState(false);
  const ovr = overallRating(coach);
  const ovrColor = ratingColor(ovr);

  return (
    <div className={cn(
      'rounded-xl border transition-all duration-200',
      'bg-gradient-to-br from-navy-light/80 to-navy/80',
      'border-navy-lighter/40 hover:border-gold/30',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
      compact ? 'p-3' : 'p-4',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] text-gold/60 uppercase tracking-widest">{ROLE_LABELS[coach.role]}</p>
          <h3 className={cn('font-display tracking-wide uppercase truncate', compact ? 'text-lg' : 'text-xl')} style={{ color: ovrColor }}>
            {coach.firstName} {coach.lastName}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="font-mono text-[10px] text-cream-dim">Age {coach.age}</span>
            <span className="font-mono text-[10px] text-cream-dim/50">·</span>
            <span className="font-mono text-[10px] text-cream-dim">{coach.experience}yr exp</span>
            <span className="font-mono text-[10px] text-cream-dim/50">·</span>
            <span className="font-mono text-[10px] text-cream-dim">${(coach.salary / 1000).toFixed(1)}M/yr</span>
            <span className="font-mono text-[10px] text-cream-dim/50">·</span>
            <span className="font-mono text-[10px] text-cream-dim">{coach.contractYears}yr left</span>
          </div>
        </div>
        {/* OVR badge */}
        <div className="text-center shrink-0">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center border"
            style={{ borderColor: `${ovrColor}40`, backgroundColor: `${ovrColor}15` }}
          >
            <span className="font-display text-xl font-bold" style={{ color: ovrColor }}>{ovr}</span>
          </div>
          <p className="font-mono text-[8px] mt-0.5" style={{ color: `${ovrColor}99` }}>{ratingLabel(ovr)}</p>
        </div>
      </div>

      {/* Specialty & personality */}
      <div className="flex items-center gap-2 mb-3">
        <span className="px-2 py-0.5 rounded bg-gold/10 border border-gold/20 font-mono text-[10px] text-gold">
          {coach.specialty}
        </span>
        <span
          className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border"
          style={{ color: personalityColor(coach.personality), borderColor: `${personalityColor(coach.personality)}40`, backgroundColor: `${personalityColor(coach.personality)}10` }}
          title={coach.personality}
        >
          {personalityIcon(coach.personality)} {coach.personality}
        </span>
      </div>

      {/* Ratings */}
      <div className="space-y-1.5">
        <RatingBar label="Teach" value={coach.ratings.teaching} />
        <RatingBar label="Strategy" value={coach.ratings.strategy} />
        <RatingBar label="Motivate" value={coach.ratings.motivation} />
        <RatingBar label="Evaluate" value={coach.ratings.evaluation} />
      </div>

      {/* Actions */}
      {(onFire || onReplace) && (
        <div className="mt-3 pt-3 border-t border-navy-lighter/30">
          {confirmFire ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-red-400">Fire {coach.lastName}?</span>
              <Button size="sm" variant="primary" onClick={() => { onFire?.(); setConfirmFire(false); }}>Yes</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmFire(false)}>Cancel</Button>
            </div>
          ) : showActions ? (
            <div className="flex gap-2">
              {onReplace && <Button size="sm" variant="secondary" onClick={onReplace}>Replace</Button>}
              {onFire && <Button size="sm" variant="ghost" className="text-red-400/70 hover:text-red-400" onClick={() => setConfirmFire(true)}>Fire</Button>}
              <Button size="sm" variant="ghost" onClick={() => setShowActions(false)}>Cancel</Button>
            </div>
          ) : (
            <button
              onClick={() => setShowActions(true)}
              className="font-mono text-[10px] text-gold/40 hover:text-gold hover:bg-gold/10 px-2 py-1 rounded border border-gold/20 hover:border-gold/40 transition-all cursor-pointer"
            >
              Manage Coach
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty slot ──────────────────────────────────────────────────
function EmptySlot({ role, onHire }: { role: CoachRole; onHire: () => void }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-navy-lighter/40 p-4 flex flex-col items-center justify-center gap-3 min-h-[200px] hover:border-gold/30 hover:bg-gold/[0.02] transition-all duration-200">
      <p className="font-mono text-[10px] text-gold/60 uppercase tracking-widest">{ROLE_LABELS[role]}</p>
      <p className="font-mono text-cream-dim/30 text-sm">Position Vacant</p>
      <Button size="sm" variant="secondary" onClick={onHire}>Hire Coach</Button>
    </div>
  );
}

// ── Bonus summary ───────────────────────────────────────────────
function BonusSummary({ bonus }: { bonus: StaffBonus }) {
  const items = [
    { label: 'Batting Dev', value: bonus.battingDev, suffix: '%', abbr: 'BAT', tip: 'Bonus to hitter development during sim' },
    { label: 'Pitching Dev', value: bonus.pitchingDev, suffix: '%', abbr: 'PIT', tip: 'Bonus to pitcher development during sim' },
    { label: 'Morale', value: bonus.morale, suffix: '', abbr: 'MOR', tip: 'Flat boost to team morale each day' },
    { label: 'Strategy', value: bonus.gameStrategy, suffix: '%', abbr: 'STR', tip: 'Improves in-game decision quality' },
    { label: 'Scouting', value: bonus.scoutAccuracy, suffix: '%', abbr: 'SCT', tip: 'Improves scouting report accuracy' },
  ];

  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {items.map(({ label, value, suffix, abbr, tip }) => (
        <div key={label} className="text-center p-2 rounded-lg bg-navy-lighter/15 border border-navy-lighter/30" title={tip}>
          <p className="font-mono text-[10px] text-gold/50 tracking-widest mb-1">{abbr}</p>
          <p className={cn(
            'font-display text-lg font-bold',
            value >= 10 ? 'text-gold' : value >= 5 ? 'text-green-light' : 'text-cream-dim',
          )}>
            +{value}{suffix}
          </p>
          <p className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Hiring modal ────────────────────────────────────────────────
function HiringModal({
  role,
  candidates,
  onHire,
  onClose,
}: {
  role: CoachRole;
  candidates: Coach[];
  onHire: (id: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-navy-light border border-navy-lighter rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl text-gold uppercase tracking-wide">Hire {ROLE_LABELS[role]}</h2>
            <p className="font-mono text-cream-dim text-xs mt-1">Interview candidates and choose your new coach</p>
          </div>
          <button onClick={onClose} className="text-cream-dim/50 hover:text-cream-dim font-mono text-xl leading-none cursor-pointer" aria-label="Close">✕</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 max-h-[50vh] overflow-y-auto">
          {candidates.map(c => (
            <div
              key={c.id}
              className={cn(
                'cursor-pointer transition-all duration-200',
                selected === c.id ? 'ring-2 ring-gold rounded-xl' : '',
              )}
              onClick={() => setSelected(c.id)}
            >
              <CoachCard coach={c} compact />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-navy-lighter/30">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!selected}
            onClick={() => selected && onHire(selected)}
          >
            Hire {selected ? candidates.find(c => c.id === selected)?.lastName : 'Coach'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export function CoachingStaffPage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId } = useFranchiseStore();
  const {
    staff, staffBonus, hiringPool, hiringRole,
    initStaff, hireCoach, fireCoach, openHiring, closeHiring,
  } = useCoachingStore();

  const team = useMemo(() => {
    if (!engine || !userTeamId) return null;
    return engine.getTeam(userTeamId) ?? null;
  }, [engine, userTeamId]);

  // Auto-initialize staff on first visit
  useEffect(() => {
    if (team && staff.length === 0) {
      initStaff(Date.now());
    }
  }, [team, staff.length, initStaff]);

  if (!team || !season) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="font-display text-gold text-xl">Coaching Staff</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          Manage your coaching staff to boost player development, game strategy, and team morale.
        </p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const totalSalary = totalStaffSalary(staff);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Coaching Staff</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {team.city} {team.name} · {staff.length} coaches · ${(totalSalary / 1000).toFixed(1)}M total payroll
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise')}>← Dashboard</Button>
      </div>

      {/* Staff Bonus Summary */}
      <Panel title="Staff Impact Bonuses">
        <BonusSummary bonus={staffBonus} />
        <p className="font-mono text-[10px] text-cream-dim/40 text-center mt-3">
          Bonuses from your coaching staff's combined ratings — hire better coaches for bigger bonuses
        </p>
      </Panel>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ROLE_ORDER.map(role => {
          const coach = staff.find(c => c.role === role);
          if (coach) {
            return (
              <CoachCard
                key={role}
                coach={coach}
                onFire={() => fireCoach(role)}
                onReplace={() => openHiring(role, Date.now())}
              />
            );
          }
          return (
            <EmptySlot
              key={role}
              role={role}
              onHire={() => openHiring(role, Date.now())}
            />
          );
        })}
      </div>

      {/* Staff Overview Table */}
      <Panel title="Staff Overview">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-lighter/30">
                <th className="text-left font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider py-2 px-2">Role</th>
                <th className="text-left font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider py-2 px-2">Name</th>
                <th className="text-center font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider py-2 px-1">OVR</th>
                <th className="text-center font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider py-2 px-1">TCH</th>
                <th className="text-center font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider py-2 px-1">STR</th>
                <th className="text-center font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider py-2 px-1">MOT</th>
                <th className="text-center font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider py-2 px-1">EVL</th>
                <th className="text-right font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider py-2 px-2">Salary</th>
              </tr>
            </thead>
            <tbody>
              {staff.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)).map(c => {
                const ovr = overallRating(c);
                return (
                  <tr key={c.id} className="border-b border-navy-lighter/15 hover:bg-navy-lighter/10 transition-colors">
                    <td className="py-2 px-2 font-mono text-[10px] text-gold/60 uppercase">{ROLE_LABELS[c.role]}</td>
                    <td className="py-2 px-2 font-body text-sm text-cream">{c.firstName} {c.lastName}</td>
                    <td className="py-2 px-1 text-center font-mono text-xs font-bold" style={{ color: ratingColor(ovr) }}>{ovr}</td>
                    <td className="py-2 px-1 text-center font-mono text-xs" style={{ color: ratingColor(c.ratings.teaching) }}>{c.ratings.teaching}</td>
                    <td className="py-2 px-1 text-center font-mono text-xs" style={{ color: ratingColor(c.ratings.strategy) }}>{c.ratings.strategy}</td>
                    <td className="py-2 px-1 text-center font-mono text-xs" style={{ color: ratingColor(c.ratings.motivation) }}>{c.ratings.motivation}</td>
                    <td className="py-2 px-1 text-center font-mono text-xs" style={{ color: ratingColor(c.ratings.evaluation) }}>{c.ratings.evaluation}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs text-cream-dim">${(c.salary / 1000).toFixed(1)}M</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Hiring Modal */}
      {hiringRole && hiringPool.length > 0 && (
        <HiringModal
          role={hiringRole}
          candidates={hiringPool}
          onHire={(id: string) => { hireCoach(id); import('@/stores/achievementStore.ts').then(m => m.useAchievementStore.getState().unlock('coaching-hire')); }}
          onClose={closeHiring}
        />
      )}
    </div>
  );
}
