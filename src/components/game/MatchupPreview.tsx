import type { Team } from '@/engine/types/team.ts';
import type { BallparkFactors } from '@/engine/types/ballpark.ts';

interface MatchupPreviewProps {
  awayTeam: Team;
  homeTeam: Team;
  ballpark: BallparkFactors;
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
  return Math.round(batAvg * 0.55 + pitAvg * 0.45);
}

function getStartingPitcher(team: Team): string {
  const sp = team.roster.players.find(p => p.id === team.pitcherId);
  if (!sp) return 'TBD';
  const vel = sp.pitching.velocity;
  const rep = sp.pitching.repertoire.join(', ');
  return `${sp.firstName} ${sp.lastName} — ${vel} mph | ${rep}`;
}

function getOffRating(team: Team): number {
  const posPlayers = team.roster.players.filter(p => p.position !== 'P').slice(0, 9);
  if (!posPlayers.length) return 50;
  return Math.round(posPlayers.reduce((sum, p) => {
    return sum + (p.batting.contact_L + p.batting.contact_R + p.batting.power_L + p.batting.power_R) / 4;
  }, 0) / posPlayers.length);
}

function getPitRating(team: Team): number {
  const sps = team.roster.players.filter(p => p.position === 'P').slice(0, 3);
  if (!sps.length) return 50;
  return Math.round(sps.reduce((sum, p) => {
    return sum + (p.pitching.stuff + p.pitching.movement + p.pitching.control) / 3;
  }, 0) / sps.length);
}

function getDefRating(team: Team): number {
  const lineupIds = new Set(team.lineup.map(l => l.playerId));
  const posPlayers = team.roster.players.filter(p => lineupIds.has(p.id) && p.position !== 'P' && p.position !== 'DH');
  if (!posPlayers.length) return 50;
  return Math.round(posPlayers.reduce((sum, p) => {
    const f = p.fielding[0];
    return sum + (f.range + f.arm_strength + f.arm_accuracy) / 3;
  }, 0) / posPlayers.length);
}

function StatBar({ label, awayVal, homeVal }: { label: string; awayVal: number; homeVal: number }) {
  const total = awayVal + homeVal;
  const awayPct = total === 0 ? 50 : (awayVal / total) * 100;
  const awayWins = awayVal >= homeVal;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      {/* Away val */}
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 13,
        fontWeight: awayWins ? 700 : 400,
        color: awayWins ? '#d4a843' : 'rgba(232,224,212,0.5)',
        width: 32,
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {awayVal}
      </div>
      {/* Bar */}
      <div style={{ flex: 1, position: 'relative', height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${awayPct}%`,
          background: 'rgba(212,168,67,0.6)',
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }} />
      </div>
      {/* Label */}
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 9,
        color: 'rgba(232,224,212,0.35)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        width: 36,
        textAlign: 'center',
        flexShrink: 0,
      }}>
        {label}
      </div>
      {/* Reversed bar (home side) */}
      <div style={{ flex: 1, position: 'relative', height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: '100%',
          width: `${100 - awayPct}%`,
          background: 'rgba(94,179,212,0.5)',
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }} />
      </div>
      {/* Home val */}
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 13,
        fontWeight: !awayWins ? 700 : 400,
        color: !awayWins ? '#5eb3d4' : 'rgba(232,224,212,0.5)',
        width: 32,
        textAlign: 'left',
        flexShrink: 0,
      }}>
        {homeVal}
      </div>
    </div>
  );
}

function ballparkFactor(value: number, label: string): { label: string; desc: string; color: string } {
  if (value > 1.1) return { label, desc: `+${Math.round((value - 1) * 100)}% favors hitters`, color: '#e74c3c' };
  if (value < 0.9) return { label, desc: `${Math.round((value - 1) * 100)}% favors pitchers`, color: '#27ae60' };
  return { label, desc: 'neutral', color: 'rgba(232,224,212,0.4)' };
}

export function MatchupPreview({ awayTeam, homeTeam, ballpark }: MatchupPreviewProps) {
  const awayRating = getTeamRating(awayTeam);
  const homeRating = getTeamRating(homeTeam);
  const awayOff = getOffRating(awayTeam);
  const homeOff = getOffRating(homeTeam);
  const awayPit = getPitRating(awayTeam);
  const homePit = getPitRating(homeTeam);
  const awayDef = getDefRating(awayTeam);
  const homeDef = getDefRating(homeTeam);
  const awaySP = getStartingPitcher(awayTeam);
  const homeSP = getStartingPitcher(homeTeam);
  const hrFactor = ballparkFactor(ballpark.hr, 'HR');
  const hitFactor = ballparkFactor(ballpark.doubles, 'XBH');

  return (
    <div style={{
      background: 'rgba(10,15,26,0.95)',
      border: '1px solid rgba(212,168,67,0.15)',
      borderRadius: 14,
      overflow: 'hidden',
      maxWidth: 700,
      width: '100%',
    }}>
      {/* Header bands */}
      <div style={{ display: 'flex', height: 6 }}>
        <div style={{ flex: 1, background: `linear-gradient(to right, ${awayTeam.primaryColor}, ${awayTeam.secondaryColor})` }} />
        <div style={{ flex: 1, background: `linear-gradient(to left, ${homeTeam.primaryColor}, ${homeTeam.secondaryColor})` }} />
      </div>

      {/* Main matchup row */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '24px 28px', gap: 20 }}>
        {/* Away */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(232,224,212,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
            Away · {awayTeam.city}
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, color: '#e8e0d4', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>
            {awayTeam.name}
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: awayTeam.secondaryColor, marginTop: 4 }}>
            {awayTeam.abbreviation}
          </div>
          <div style={{
            display: 'inline-block',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 28,
            fontWeight: 700,
            color: awayRating >= homeRating ? '#d4a843' : 'rgba(232,224,212,0.6)',
            marginTop: 8,
          }}>
            {awayRating}
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(232,224,212,0.3)', letterSpacing: '0.1em' }}>OVR</div>
        </div>

        {/* VS */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: 32,
            color: 'rgba(212,168,67,0.4)',
            letterSpacing: '0.08em',
            lineHeight: 1,
          }}>VS</div>
        </div>

        {/* Home */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(232,224,212,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
            Home · {homeTeam.city}
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, color: '#e8e0d4', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>
            {homeTeam.name}
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: homeTeam.secondaryColor, marginTop: 4 }}>
            {homeTeam.abbreviation}
          </div>
          <div style={{
            display: 'inline-block',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 28,
            fontWeight: 700,
            color: homeRating >= awayRating ? '#5eb3d4' : 'rgba(232,224,212,0.6)',
            marginTop: 8,
          }}>
            {homeRating}
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(232,224,212,0.3)', letterSpacing: '0.1em' }}>OVR</div>
        </div>
      </div>

      {/* Stats comparison */}
      <div style={{ padding: '0 28px 16px' }}>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginBottom: 4 }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(232,224,212,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>
            Team Ratings
          </div>
          <StatBar label="OFF" awayVal={awayOff} homeVal={homeOff} />
          <StatBar label="PIT" awayVal={awayPit} homeVal={homePit} />
          <StatBar label="DEF" awayVal={awayDef} homeVal={homeDef} />
        </div>
      </div>

      {/* Starting pitchers */}
      <div style={{ padding: '0 28px 20px' }}>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(232,224,212,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            Starting Pitchers
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: awayTeam.secondaryColor, marginBottom: 2 }}>
                {awayTeam.abbreviation}
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(232,224,212,0.7)', lineHeight: 1.4 }}>
                {awaySP}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: homeTeam.secondaryColor, marginBottom: 2 }}>
                {homeTeam.abbreviation}
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(232,224,212,0.7)', lineHeight: 1.4 }}>
                {homeSP}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ballpark */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 28px',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
      }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(232,224,212,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
            Venue
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: '#e8e0d4', letterSpacing: '0.04em' }}>
            {ballpark.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, marginLeft: 'auto' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: hrFactor.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{hrFactor.desc}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: hitFactor.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{hitFactor.desc}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
