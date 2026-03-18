import type { Team } from '@/engine/types/team.ts';

interface TeamCardProps {
  team: Team;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

function getTeamRating(team: Team): number {
  const posPlayers = team.roster.players.filter(p => p.position !== 'P');
  const pitchers = team.roster.players.filter(p => p.position === 'P');

  const batAvg = posPlayers.length === 0 ? 50 : posPlayers.reduce((sum, p) => {
    const b = p.batting;
    return sum + (b.contact_L + b.contact_R + b.power_L + b.power_R + b.eye + b.avoid_k) / 6;
  }, 0) / posPlayers.length;

  const pitAvg = pitchers.length === 0 ? 50 : pitchers.reduce((sum, p) => {
    const pt = p.pitching;
    return sum + (pt.stuff + pt.movement + pt.control) / 3;
  }, 0) / pitchers.length;

  return Math.round((batAvg * 0.55 + pitAvg * 0.45));
}

function getKeyPlayers(team: Team): string[] {
  const lineupIds = new Set(team.lineup.map(l => l.playerId));
  const posPlayers = team.roster.players
    .filter(p => lineupIds.has(p.id))
    .sort((a, b) => {
      const ratingA = (a.batting.power_L + a.batting.power_R + a.batting.contact_L + a.batting.contact_R) / 4;
      const ratingB = (b.batting.power_L + b.batting.power_R + b.batting.contact_L + b.batting.contact_R) / 4;
      return ratingB - ratingA;
    })
    .slice(0, 2)
    .map(p => `${p.firstName[0]}. ${p.lastName}`);

  const sp = team.roster.players.find(p => p.id === team.pitcherId);
  if (sp) {
    posPlayers.push(`${sp.firstName[0]}. ${sp.lastName} (SP)`);
  }
  return posPlayers;
}

export function TeamCard({ team, selected, onClick, compact }: TeamCardProps) {
  const rating = getTeamRating(team);
  const keyPlayers = getKeyPlayers(team);
  const ratingColor = rating >= 70 ? '#5cb85c' : rating >= 60 ? '#f0ad4e' : '#c0392b';

  if (compact) {
    return (
      <button
        onClick={onClick}
        style={{
          background: selected ? `${team.primaryColor}33` : 'rgba(26,34,53,0.85)',
          border: `2px solid ${selected ? team.secondaryColor : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8,
          padding: '10px 14px',
          textAlign: 'left',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
        onMouseEnter={e => {
          if (!selected && onClick) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = team.primaryColor;
            (e.currentTarget as HTMLButtonElement).style.background = `${team.primaryColor}22`;
          }
        }}
        onMouseLeave={e => {
          if (!selected && onClick) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26,34,53,0.85)';
          }
        }}
      >
        {/* Color swatch */}
        <div
          style={{
            width: 8,
            height: 36,
            borderRadius: 4,
            background: `linear-gradient(to bottom, ${team.primaryColor}, ${team.secondaryColor})`,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(232,224,212,0.5)', letterSpacing: '0.08em' }}>
              {team.abbreviation}
            </span>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, color: '#e8e0d4', letterSpacing: '0.05em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {team.city} {team.name}
            </span>
          </div>
        </div>
        {/* Rating badge */}
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 12,
          fontWeight: 600,
          color: ratingColor,
          background: `${ratingColor}1a`,
          border: `1px solid ${ratingColor}44`,
          borderRadius: 4,
          padding: '2px 6px',
          flexShrink: 0,
        }}>
          {rating}
        </div>
        {/* Selected checkmark */}
        {selected && (
          <div style={{ color: team.secondaryColor, fontSize: 16, flexShrink: 0 }}>✓</div>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      style={{
        background: selected
          ? `linear-gradient(135deg, ${team.primaryColor}55, ${team.primaryColor}22)`
          : 'rgba(26,34,53,0.9)',
        border: `2px solid ${selected ? team.secondaryColor : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 12,
        padding: '0',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        overflow: 'hidden',
        width: '100%',
        boxShadow: selected
          ? `0 0 20px ${team.primaryColor}44, 0 4px 16px rgba(0,0,0,0.4)`
          : '0 2px 8px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={e => {
        if (!selected && onClick) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = team.primaryColor;
          el.style.background = `linear-gradient(135deg, ${team.primaryColor}33, ${team.primaryColor}11)`;
          el.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={e => {
        if (!selected && onClick) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = 'rgba(255,255,255,0.1)';
          el.style.background = 'rgba(26,34,53,0.9)';
          el.style.transform = 'none';
        }
      }}
    >
      {/* Color bar header */}
      <div style={{
        height: 6,
        background: `linear-gradient(to right, ${team.primaryColor}, ${team.secondaryColor})`,
      }} />

      <div style={{ padding: '16px 18px' }}>
        {/* Abbr + Name */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 10,
              color: 'rgba(232,224,212,0.45)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}>
              {team.city}
            </div>
            <div style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: 20,
              color: '#e8e0d4',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              lineHeight: 1.1,
            }}>
              {team.name}
            </div>
          </div>
          {/* Overall rating */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(232,224,212,0.4)', letterSpacing: '0.1em', marginBottom: 2 }}>OVR</div>
            <div style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 24,
              fontWeight: 700,
              color: ratingColor,
              lineHeight: 1,
            }}>
              {rating}
            </div>
          </div>
        </div>

        {/* Key players */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(232,224,212,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>
            Key Players
          </div>
          {keyPlayers.map((name, i) => (
            <div key={i} style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 11,
              color: 'rgba(232,224,212,0.7)',
              marginBottom: 2,
            }}>
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* Selected indicator */}
      {selected && (
        <div style={{
          position: 'absolute' as const,
          top: 10,
          right: 10,
          width: 22,
          height: 22,
          background: team.secondaryColor,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: '#0a0f1a',
          fontWeight: 700,
        }}>
          ✓
        </div>
      )}
    </button>
  );
}
