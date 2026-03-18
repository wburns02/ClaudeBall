// ── AtBatOverlay.tsx ──────────────────────────────────────────────────────────
// Semi-transparent React overlay displayed OVER the diamond canvas during
// at-bat zoom. Shows pitch info, count, batter/pitcher names, and result flash.
// Fades in when zoomed to at-bat view, fades out when zooming back.

import { useEffect, useRef, useState } from 'react';

// ── Pitch type display config ─────────────────────────────────────────────────

const PITCH_COLORS: Record<string, string> = {
  fastball:    '#ef4444', // red
  sinker:      '#f97316', // orange
  cutter:      '#fb923c', // orange-light
  slider:      '#3b82f6', // blue
  curveball:   '#22c55e', // green
  changeup:    '#eab308', // yellow
  splitter:    '#a855f7', // purple
  knuckleball: '#ec4899', // pink
};

const PITCH_DISPLAY_NAMES: Record<string, string> = {
  fastball:    'FASTBALL',
  sinker:      'SINKER',
  cutter:      'CUTTER',
  slider:      'SLIDER',
  curveball:   'CURVEBALL',
  changeup:    'CHANGEUP',
  splitter:    'SPLITTER',
  knuckleball: 'KNUCKLEBALL',
};

const RESULT_COLORS: Record<string, string> = {
  'STRIKE!':   '#ef4444',
  'BALL!':     '#3b82f6',
  'FOUL!':     '#eab308',
  'IN PLAY!':  '#22c55e',
  'STRIKEOUT!':'#ef4444',
  'WALK!':     '#3b82f6',
  'HOME RUN!': '#d4a843',
  'HIT!':      '#22c55e',
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AtBatOverlayState {
  /** Whether the at-bat close-up zoom is active — controls fade in/out. */
  visible: boolean;
  /** Current pitch type (e.g. "fastball"). Empty string = no pitch yet. */
  pitchType: string;
  /** Pitch speed in MPH. 0 = hide. */
  pitchSpeedMph: number;
  /** Result text to flash briefly ("STRIKE!", "BALL!", etc.) or empty. */
  resultText: string;
  /** Balls count (0–3). */
  balls: number;
  /** Strikes count (0–2). */
  strikes: number;
  /** Batter name. */
  batterName: string;
  /** Pitcher name. */
  pitcherName: string;
  /** Number of pitches thrown by pitcher this game. */
  pitchCount: number;
}

interface AtBatOverlayProps {
  state: AtBatOverlayState;
}

// ── Strike zone mini display ───────────────────────────────────────────────────

function MiniStrikeZone({ balls, strikes }: { balls: number; strikes: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {/* Count */}
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(232,224,212,0.55)', letterSpacing: '0.05em' }}>
        COUNT
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {/* Balls */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(232,224,212,0.4)', marginBottom: 3 }}>B</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: i < balls ? '#3b82f6' : 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </div>
        </div>
        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)' }} />
        {/* Strikes */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(232,224,212,0.4)', marginBottom: 3 }}>S</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: i < strikes ? '#ef4444' : 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export function AtBatOverlay({ state }: AtBatOverlayProps) {
  const [containerAlpha, setContainerAlpha] = useState(0);
  const [pitchInfoAlpha, setPitchInfoAlpha] = useState(0);
  const [resultAlpha, setResultAlpha] = useState(0);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Container fade in/out based on visible ──────────────────────────────
  useEffect(() => {
    if (state.visible) {
      setContainerAlpha(1);
    } else {
      setContainerAlpha(0);
    }
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [state.visible]);

  // ── Pitch type flash (appears for 700ms then fades) ─────────────────────
  useEffect(() => {
    if (!state.pitchType || state.pitchSpeedMph === 0) return;

    setPitchInfoAlpha(1);
    if (pitchTimerRef.current) clearTimeout(pitchTimerRef.current);
    pitchTimerRef.current = setTimeout(() => {
      setPitchInfoAlpha(0);
    }, 700);

    return () => {
      if (pitchTimerRef.current) clearTimeout(pitchTimerRef.current);
    };
  }, [state.pitchType, state.pitchSpeedMph]);

  // ── Result flash ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.resultText) return;

    setResultAlpha(1);
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => {
      setResultAlpha(0);
    }, 900);

    return () => {
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, [state.resultText]);

  if (!state.visible && containerAlpha === 0) return null;

  const pitchColor = PITCH_COLORS[state.pitchType] ?? '#e8e0d4';
  const resultColor = RESULT_COLORS[state.resultText] ?? '#e8e0d4';
  const pitchDisplayName = PITCH_DISPLAY_NAMES[state.pitchType] ?? state.pitchType.toUpperCase();

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: containerAlpha,
        transition: 'opacity 0.35s ease',
        zIndex: 5,
      }}
    >

      {/* ── TOP CENTER: Pitch type + speed flash ── */}
      <div
        style={{
          position: 'absolute',
          top: '18%',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          opacity: pitchInfoAlpha,
          transition: 'opacity 0.25s ease',
        }}
      >
        <div
          style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: pitchColor,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textShadow: `0 0 20px ${pitchColor}88, 0 2px 8px rgba(0,0,0,0.8)`,
          }}
        >
          {pitchDisplayName}
        </div>
        {state.pitchSpeedMph > 0 && (
          <div
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 18,
              color: '#e8e0d4',
              opacity: 0.85,
              marginTop: 2,
              textShadow: '0 2px 6px rgba(0,0,0,0.7)',
            }}
          >
            {state.pitchSpeedMph} MPH
          </div>
        )}
      </div>

      {/* ── CENTER: Result flash ── */}
      <div
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: resultAlpha,
          transition: 'opacity 0.15s ease',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: 42,
            fontWeight: 700,
            color: resultColor,
            letterSpacing: '0.08em',
            textShadow: `0 0 30px ${resultColor}99, 0 0 60px ${resultColor}44, 0 3px 10px rgba(0,0,0,0.9)`,
            whiteSpace: 'nowrap',
          }}
        >
          {state.resultText}
        </div>
      </div>

      {/* ── BOTTOM LEFT: Batter info ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(10,15,26,0.75)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(212,168,67,0.2)',
          borderRadius: 6,
          padding: '8px 14px',
          minWidth: 140,
        }}
      >
        <div
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 9,
            color: 'rgba(232,224,212,0.45)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}
        >
          BATTER
        </div>
        <div
          style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: 16,
            fontWeight: 600,
            color: '#e8e0d4',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {state.batterName || '—'}
        </div>
      </div>

      {/* ── BOTTOM CENTER: Count display ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(10,15,26,0.75)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(232,224,212,0.12)',
          borderRadius: 6,
          padding: '8px 16px',
        }}
      >
        <MiniStrikeZone balls={state.balls} strikes={state.strikes} />
      </div>

      {/* ── BOTTOM RIGHT: Pitcher info ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          background: 'rgba(10,15,26,0.75)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(212,168,67,0.2)',
          borderRadius: 6,
          padding: '8px 14px',
          minWidth: 140,
          textAlign: 'right',
        }}
      >
        <div
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 9,
            color: 'rgba(232,224,212,0.45)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}
        >
          PITCHER
        </div>
        <div
          style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: 16,
            fontWeight: 600,
            color: '#e8e0d4',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {state.pitcherName || '—'}
        </div>
        {state.pitchCount > 0 && (
          <div
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 10,
              color: 'rgba(212,168,67,0.6)',
              marginTop: 2,
            }}
          >
            {state.pitchCount}P
          </div>
        )}
      </div>

    </div>
  );
}
