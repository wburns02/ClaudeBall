import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import { Panel } from '@/components/ui/Panel.tsx';
import { useSaveStore } from '@/stores/saveStore.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { SaveSlot } from '@/stores/saveStore.ts';

type Tab = 'save' | 'load';

// ---- Helpers -------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getDayLabel(day: number): string {
  if (day === 0) return 'Pre-Season';
  return `Day ${day}`;
}

// ---- Save Slot Card ------------------------------------------------------

interface SlotCardProps {
  slot: SaveSlot | null;
  slotIndex: number;
  mode: Tab;
  onSave: (slotId: string | undefined) => void;
  onLoad: (slotId: string) => void;
  onDelete: (slotId: string) => void;
}

function SlotCard({ slot, slotIndex, mode, onSave, onLoad, onDelete }: SlotCardProps) {
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSaveClick = () => {
    if (slot) {
      setConfirmOverwrite(true);
    } else {
      onSave(undefined);
    }
  };

  const handleConfirmOverwrite = () => {
    setConfirmOverwrite(false);
    onSave(slot?.id);
  };

  const handleDeleteClick = () => {
    setConfirmDelete(true);
  };

  const handleConfirmDelete = () => {
    setConfirmDelete(false);
    if (slot) onDelete(slot.id);
  };

  return (
    <div
      className={cn(
        'rounded-md border transition-all duration-150 p-4',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        slot
          ? 'bg-[#111928] border-navy-lighter hover:border-gold/40 hover:bg-[#131d2e]'
          : 'bg-[#0a0f1a] border-navy-lighter/50 border-dashed',
      )}
    >
      {slot ? (
        <div className="space-y-2">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display text-gold text-sm uppercase tracking-wide truncate">
                {slot.name}
              </div>
              <div className="font-mono text-xs text-cream-dim mt-0.5">
                {slot.teamCity} {slot.teamName} — Season {slot.season}, {getDayLabel(slot.day)}
              </div>
            </div>
            <span className="font-mono text-[10px] text-cream-dim/40 whitespace-nowrap flex-shrink-0 mt-0.5">
              Slot {slotIndex + 1}
            </span>
          </div>

          {/* Date */}
          <div className="font-mono text-[10px] text-cream-dim/50">
            {formatDate(slot.date)}
          </div>

          {/* Actions */}
          {confirmOverwrite ? (
            <div className="flex items-center gap-2 pt-1">
              <span className="font-mono text-xs text-gold/80">Overwrite?</span>
              <Button size="sm" variant="primary" onClick={handleConfirmOverwrite}>Yes</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmOverwrite(false)}>Cancel</Button>
            </div>
          ) : confirmDelete ? (
            <div className="flex items-center gap-2 pt-1">
              <span className="font-mono text-xs text-red-400/90">Delete save?</span>
              <Button size="sm" variant="primary" onClick={handleConfirmDelete}>Delete</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex gap-2 pt-1">
              {mode === 'save' ? (
                <Button size="sm" variant="secondary" onClick={handleSaveClick}>
                  Overwrite
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={() => onLoad(slot.id)}>
                  Load
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleDeleteClick} className="text-red-400/70 hover:text-red-400">
                Delete
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="font-mono text-xs text-cream-dim/30 uppercase tracking-wide">
              Empty Slot {slotIndex + 1}
            </div>
            <div className="font-mono text-[10px] text-cream-dim/20">No save data</div>
          </div>
          {mode === 'save' && (
            <Button size="sm" variant="secondary" onClick={() => onSave(undefined)}>
              Save Here
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Save Name Modal -----------------------------------------------------

interface SaveNameModalProps {
  onConfirm: (name: string) => void;
  onCancel: () => void;
  defaultName?: string;
}

function SaveNameModal({ onConfirm, onCancel, defaultName = '' }: SaveNameModalProps) {
  const [value, setValue] = useState(defaultName);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <Panel className="w-80">
        <div className="space-y-4">
          <h3 className="font-display text-gold text-xl uppercase tracking-wide">Name Your Save</h3>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onConfirm(value.trim()); }}
            placeholder="e.g. Post-All Star"
            className={cn(
              'w-full px-3 py-2 rounded-md',
              'bg-[#0d1625] border border-navy-lighter',
              'font-mono text-sm text-cream placeholder-cream-dim/70',
              'focus:outline-none focus:border-gold/60',
            )}
            autoFocus
            maxLength={40}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!value.trim()}
              onClick={() => value.trim() && onConfirm(value.trim())}
            >
              Save
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ---- Main Page -----------------------------------------------------------

const MAX_SLOTS = 10;

export function SaveLoadPage() {
  const navigate = useNavigate();
  const saveStore = useSaveStore();
  const franchise = useFranchiseStore();
  const [tab, setTab] = useState<Tab>(franchise.isInitialized ? 'save' : 'load');
  const [pendingSaveSlotId, setPendingSaveSlotId] = useState<string | undefined | null>(null); // null = closed, undefined = new slot
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const saves = saveStore.listSaves();

  // Build array of 10 slots (sparse — fill gaps with null)
  const slots: (SaveSlot | null)[] = Array.from({ length: MAX_SLOTS }, (_, i) => saves[i] ?? null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSave = (slotId: string | undefined) => {
    // Open the name modal (pendingSaveSlotId = slotId | undefined for new)
    setPendingSaveSlotId(slotId ?? undefined);
  };

  const handleNameConfirm = (name: string) => {
    const slot = saveStore.saveGame(name, pendingSaveSlotId ?? undefined);
    setPendingSaveSlotId(null);
    if (slot) {
      showToast(`Saved: "${slot.name}"`);
    } else {
      showToast('Save failed — no active franchise.');
    }
  };

  const handleLoad = (slotId: string) => {
    const ok = saveStore.loadGame(slotId);
    if (ok) {
      showToast('Game loaded!');
      setTimeout(() => navigate('/franchise'), 800);
    } else {
      showToast('Failed to load save.');
    }
  };

  const handleDelete = (slotId: string) => {
    saveStore.deleteSave(slotId);
    showToast('Save deleted.');
  };

  const hasFranchise = franchise.isInitialized;

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Save / Load</h1>
          <p className="font-mono text-xs text-cream-dim/50 mt-1">
            {saves.length} of {MAX_SLOTS} slots used
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          ← Back
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-navy-lighter pb-0">
        {(['save', 'load'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'px-6 py-2.5 font-mono text-sm uppercase tracking-wide transition-all duration-150',
              'border-b-2 -mb-px',
              tab === t
                ? 'text-gold border-gold'
                : 'text-cream-dim/50 border-transparent hover:text-cream-dim hover:border-navy-lighter',
            )}
          >
            {t === 'save' ? 'Save Game' : 'Load Game'}
          </button>
        ))}
      </div>

      {/* Current game info (save tab) */}
      {tab === 'save' && (
        <Panel>
          {hasFranchise && franchise.season ? (
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <div>
                <div className="font-display text-gold text-sm uppercase tracking-wide">
                  Active Franchise
                </div>
                <div className="font-mono text-xs text-cream-dim mt-0.5">
                  {franchise.teams.find(t => t.id === franchise.userTeamId)?.city}{' '}
                  {franchise.teams.find(t => t.id === franchise.userTeamId)?.name}
                  {' '}— Season {franchise.season.year as number}, {getDayLabel(franchise.season.currentDay as number)}
                </div>
              </div>
            </div>
          ) : (
            <div className="font-mono text-sm text-cream-dim/50 text-center py-2">
              No active franchise — start a New Franchise first.
            </div>
          )}
        </Panel>
      )}

      {/* Slots grid */}
      <div className="space-y-3">
        {tab === 'save' && !hasFranchise ? (
          <div className="text-center py-12 font-mono text-cream-dim/30 text-sm">
            No franchise loaded. Nothing to save.
          </div>
        ) : tab === 'load' && saves.length === 0 ? (
          <div className="text-center py-12 font-mono text-cream-dim/30 text-sm">
            No saved games yet. Start a franchise and save your progress.
          </div>
        ) : (
          <>
            {slots.map((slot, i) => (
              // Only show occupied slots in Load tab; show all 10 in Save tab
              (tab === 'save' || slot !== null) ? (
                <SlotCard
                  key={slot?.id ?? `empty-${i}`}
                  slot={slot}
                  slotIndex={i}
                  mode={tab}
                  onSave={handleSave}
                  onLoad={handleLoad}
                  onDelete={handleDelete}
                />
              ) : null
            ))}
          </>
        )}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
          'bg-navy-light border border-gold/40 rounded-lg',
          'px-6 py-3 font-mono text-sm text-gold shadow-xl',
          'animate-in fade-in slide-in-from-bottom-2 duration-200',
        )}>
          {toastMsg}
        </div>
      )}

      {/* Save name modal */}
      {pendingSaveSlotId !== null && (
        <SaveNameModal
          onConfirm={handleNameConfirm}
          onCancel={() => setPendingSaveSlotId(null)}
          defaultName={
            pendingSaveSlotId !== undefined
              ? (saves.find(s => s.id === pendingSaveSlotId)?.name ?? '')
              : `Save ${saves.length + 1}`
          }
        />
      )}
    </div>
  );
}
