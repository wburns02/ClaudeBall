/**
 * Multiplayer Dynasty System — shared world state for 2+ players.
 * Modes: Co-op, Rivalry, Family Dynasty, League Dynasty.
 * Turn-based or real-time async (like Civ multiplayer).
 * Each player has their own phone, feed, events — overlap in Big Game Moments.
 */

export type MultiplayerMode = 'coop' | 'rivalry' | 'family' | 'league';

export interface MultiplayerSession {
  id: string;
  mode: MultiplayerMode;
  hostPlayerId: string;
  players: MultiplayerPlayer[];
  worldState: SharedWorldState;
  currentSeason: number;
  currentDay: number;
  turnOrder: string[];           // Player IDs in turn order
  activeTurnPlayerId: string;
  isAsync: boolean;              // True = real-time async, false = turn-based
  createdAt: number;
  lastActivity: number;
  settings: MultiplayerSettings;
}

export interface MultiplayerPlayer {
  id: string;
  displayName: string;
  characterName: string;
  characterId: string;           // ECS entity ID
  teamId: string;
  role: 'player' | 'gm' | 'owner' | 'coach';
  isHost: boolean;
  isOnline: boolean;
  lastSeen: number;
  pendingEvents: PendingEvent[];
  messages: PlayerMessage[];
}

export interface SharedWorldState {
  leagueId: string;
  season: number;
  standings: Record<string, { wins: number; losses: number }>;
  trades: TradeRecord[];
  freeAgents: string[];          // Player names available
  headlines: string[];           // Shared news feed
  bigGameMoments: SharedMoment[];
}

export interface SharedMoment {
  id: string;
  season: number;
  day: number;
  involvedPlayers: string[];     // MultiplayerPlayer IDs who are in this moment
  title: string;
  description: string;
  resolved: boolean;
  results: Record<string, 'success' | 'failure'>;
}

export interface PendingEvent {
  id: string;
  type: 'turn_notification' | 'trade_offer' | 'message' | 'big_game' | 'rivalry_matchup';
  title: string;
  description: string;
  fromPlayerId?: string;
  requiresAction: boolean;
  data: Record<string, unknown>;
}

export interface PlayerMessage {
  id: string;
  fromPlayerId: string;
  fromName: string;
  content: string;
  timestamp: number;
  isRead: boolean;
  channel: 'direct' | 'league' | 'trade_negotiation';
}

export interface TradeRecord {
  id: string;
  proposerId: string;
  receiverId: string;
  playersOffered: string[];
  playersRequested: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  messages: string[];
  timestamp: number;
}

export interface MultiplayerSettings {
  maxPlayers: number;
  turnTimeLimit: number;         // Seconds per turn (0 = unlimited)
  autoSimOnTimeout: boolean;
  allowTradesBetweenPlayers: boolean;
  rivalryIntensity: 'casual' | 'heated' | 'blood_feud';
  sharedBigGameMoments: boolean; // Both players play same at-bat
}

const MODE_CONFIGS: Record<MultiplayerMode, {
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  defaultSettings: Partial<MultiplayerSettings>;
}> = {
  coop: {
    name: 'Co-op Dynasty',
    description: 'Two players in the same league — one player and one GM, or both players on different teams. Face each other in Big Game Moments. Real negotiation.',
    minPlayers: 2,
    maxPlayers: 2,
    defaultSettings: { allowTradesBetweenPlayers: true, sharedBigGameMoments: true },
  },
  rivalry: {
    name: 'Rivalry Dynasty',
    description: 'Two characters designed to be rivals. Drafted by division rivals. Every head-to-head is a Big Game Moment. The rivalry spans decades.',
    minPlayers: 2,
    maxPlayers: 2,
    defaultSettings: { rivalryIntensity: 'heated', sharedBigGameMoments: true },
  },
  family: {
    name: 'Family Dynasty',
    description: 'One player is the father, the other is the daughter. Play simultaneously in different eras. The father\'s decisions affect the daughter\'s starting conditions.',
    minPlayers: 2,
    maxPlayers: 2,
    defaultSettings: { sharedBigGameMoments: false, allowTradesBetweenPlayers: false },
  },
  league: {
    name: 'League Dynasty',
    description: 'Full CK2 multiplayer: 4-8 players each control a character. Alliances, betrayals, trade wars, free agency bidding. Political maneuvering between real humans.',
    minPlayers: 4,
    maxPlayers: 8,
    defaultSettings: { allowTradesBetweenPlayers: true, sharedBigGameMoments: true, rivalryIntensity: 'blood_feud' },
  },
};

let sessionIdCounter = 0;
let eventIdCounter = 0;
let messageIdCounter = 0;

/** Get available multiplayer modes */
export function getMultiplayerModes(): { id: MultiplayerMode; name: string; description: string; minPlayers: number; maxPlayers: number }[] {
  return Object.entries(MODE_CONFIGS).map(([id, config]) => ({
    id: id as MultiplayerMode,
    name: config.name,
    description: config.description,
    minPlayers: config.minPlayers,
    maxPlayers: config.maxPlayers,
  }));
}

/** Create a new multiplayer session */
export function createMultiplayerSession(
  mode: MultiplayerMode,
  hostPlayer: { id: string; displayName: string; characterName: string; characterId: string; teamId: string; role: MultiplayerPlayer['role'] },
  settings?: Partial<MultiplayerSettings>,
): MultiplayerSession {
  const modeConfig = MODE_CONFIGS[mode];
  const defaultSettings: MultiplayerSettings = {
    maxPlayers: modeConfig.maxPlayers,
    turnTimeLimit: 0,
    autoSimOnTimeout: false,
    allowTradesBetweenPlayers: true,
    rivalryIntensity: 'casual',
    sharedBigGameMoments: true,
    ...modeConfig.defaultSettings,
    ...settings,
  };

  const host: MultiplayerPlayer = {
    ...hostPlayer,
    isHost: true,
    isOnline: true,
    lastSeen: Date.now(),
    pendingEvents: [],
    messages: [],
  };

  return {
    id: `mp_${++sessionIdCounter}_${Date.now()}`,
    mode,
    hostPlayerId: hostPlayer.id,
    players: [host],
    worldState: {
      leagueId: 'shared_league',
      season: 1,
      standings: {},
      trades: [],
      freeAgents: [],
      headlines: [`${hostPlayer.displayName} created a ${modeConfig.name} session.`],
      bigGameMoments: [],
    },
    currentSeason: 1,
    currentDay: 1,
    turnOrder: [hostPlayer.id],
    activeTurnPlayerId: hostPlayer.id,
    isAsync: false,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    settings: defaultSettings,
  };
}

/** Join an existing session */
export function joinSession(
  session: MultiplayerSession,
  player: { id: string; displayName: string; characterName: string; characterId: string; teamId: string; role: MultiplayerPlayer['role'] },
): { success: boolean; error?: string } {
  if (session.players.length >= session.settings.maxPlayers) {
    return { success: false, error: 'Session is full' };
  }
  if (session.players.some(p => p.id === player.id)) {
    return { success: false, error: 'Already in session' };
  }

  session.players.push({
    ...player,
    isHost: false,
    isOnline: true,
    lastSeen: Date.now(),
    pendingEvents: [],
    messages: [],
  });
  session.turnOrder.push(player.id);
  session.worldState.headlines.push(`${player.displayName} joined the dynasty!`);
  session.lastActivity = Date.now();

  // Notify all players
  for (const p of session.players) {
    if (p.id !== player.id) {
      p.pendingEvents.push({
        id: `evt_${++eventIdCounter}`,
        type: 'turn_notification',
        title: 'New Player Joined',
        description: `${player.displayName} (${player.characterName}) has joined the dynasty as a ${player.role}.`,
        requiresAction: false,
        data: { playerId: player.id },
      });
    }
  }

  return { success: true };
}

/** Send a message between players */
export function sendMessage(
  session: MultiplayerSession,
  fromPlayerId: string,
  toPlayerId: string | 'all',
  content: string,
  channel: PlayerMessage['channel'] = 'direct',
): PlayerMessage {
  const from = session.players.find(p => p.id === fromPlayerId);
  const msg: PlayerMessage = {
    id: `msg_${++messageIdCounter}`,
    fromPlayerId,
    fromName: from?.displayName ?? 'Unknown',
    content,
    timestamp: Date.now(),
    isRead: false,
    channel,
  };

  if (toPlayerId === 'all') {
    for (const p of session.players) {
      if (p.id !== fromPlayerId) {
        p.messages.push({ ...msg });
        p.pendingEvents.push({
          id: `evt_${++eventIdCounter}`,
          type: 'message',
          title: `Message from ${msg.fromName}`,
          description: content.slice(0, 100),
          fromPlayerId,
          requiresAction: false,
          data: { messageId: msg.id },
        });
      }
    }
  } else {
    const target = session.players.find(p => p.id === toPlayerId);
    if (target) {
      target.messages.push(msg);
      target.pendingEvents.push({
        id: `evt_${++eventIdCounter}`,
        type: 'message',
        title: `Message from ${msg.fromName}`,
        description: content.slice(0, 100),
        fromPlayerId,
        requiresAction: false,
        data: { messageId: msg.id },
      });
    }
  }

  session.lastActivity = Date.now();
  return msg;
}

/** Propose a trade between players */
export function proposeTrade(
  session: MultiplayerSession,
  proposerId: string,
  receiverId: string,
  playersOffered: string[],
  playersRequested: string[],
): TradeRecord | null {
  if (!session.settings.allowTradesBetweenPlayers) return null;

  const trade: TradeRecord = {
    id: `trade_${Date.now()}`,
    proposerId,
    receiverId,
    playersOffered,
    playersRequested,
    status: 'pending',
    messages: [],
    timestamp: Date.now(),
  };

  session.worldState.trades.push(trade);

  const proposer = session.players.find(p => p.id === proposerId);
  const receiver = session.players.find(p => p.id === receiverId);
  if (receiver) {
    receiver.pendingEvents.push({
      id: `evt_${++eventIdCounter}`,
      type: 'trade_offer',
      title: `Trade Offer from ${proposer?.displayName ?? 'Unknown'}`,
      description: `Offering: ${playersOffered.join(', ')}\nRequesting: ${playersRequested.join(', ')}`,
      fromPlayerId: proposerId,
      requiresAction: true,
      data: { tradeId: trade.id },
    });
  }

  session.lastActivity = Date.now();
  return trade;
}

/** Respond to a trade */
export function respondToTrade(
  session: MultiplayerSession,
  tradeId: string,
  response: 'accepted' | 'rejected' | 'countered',
  counterOffer?: { playersOffered: string[]; playersRequested: string[] },
): boolean {
  const trade = session.worldState.trades.find(t => t.id === tradeId);
  if (!trade || trade.status !== 'pending') return false;

  trade.status = response;

  if (response === 'accepted') {
    session.worldState.headlines.push(
      `TRADE: ${trade.playersOffered.join(', ')} for ${trade.playersRequested.join(', ')}`
    );
  }

  if (response === 'countered' && counterOffer) {
    const newTrade = proposeTrade(session, trade.receiverId, trade.proposerId, counterOffer.playersOffered, counterOffer.playersRequested);
    if (newTrade) {
      trade.messages.push(`Counter-offered: ${counterOffer.playersOffered.join(', ')} for ${counterOffer.playersRequested.join(', ')}`);
    }
  }

  session.lastActivity = Date.now();
  return true;
}

/** Create a shared Big Game Moment for a rivalry matchup */
export function createSharedMoment(
  session: MultiplayerSession,
  involvedPlayerIds: string[],
  title: string,
  description: string,
): SharedMoment {
  const moment: SharedMoment = {
    id: `moment_${Date.now()}`,
    season: session.currentSeason,
    day: session.currentDay,
    involvedPlayers: involvedPlayerIds,
    title,
    description,
    resolved: false,
    results: {},
  };

  session.worldState.bigGameMoments.push(moment);

  for (const playerId of involvedPlayerIds) {
    const player = session.players.find(p => p.id === playerId);
    if (player) {
      player.pendingEvents.push({
        id: `evt_${++eventIdCounter}`,
        type: 'big_game',
        title: `Big Game Moment: ${title}`,
        description,
        requiresAction: true,
        data: { momentId: moment.id },
      });
    }
  }

  return moment;
}

/** Resolve a shared moment after both players have played it */
export function resolveSharedMoment(
  session: MultiplayerSession,
  momentId: string,
  results: Record<string, 'success' | 'failure'>,
): string {
  const moment = session.worldState.bigGameMoments.find(m => m.id === momentId);
  if (!moment) return '';

  moment.resolved = true;
  moment.results = results;

  const narratives: string[] = [];
  for (const [playerId, result] of Object.entries(results)) {
    const player = session.players.find(p => p.id === playerId);
    if (player) {
      narratives.push(`${player.characterName}: ${result === 'success' ? 'CLUTCH MOMENT' : 'fell short'}`);
    }
  }

  const headline = `${moment.title}: ${narratives.join(' | ')}`;
  session.worldState.headlines.push(headline);
  return headline;
}

/** Advance the turn to the next player */
export function advanceTurn(session: MultiplayerSession): string {
  const currentIndex = session.turnOrder.indexOf(session.activeTurnPlayerId);
  const nextIndex = (currentIndex + 1) % session.turnOrder.length;
  session.activeTurnPlayerId = session.turnOrder[nextIndex];

  // If we've cycled back to the first player, advance the day
  if (nextIndex === 0) {
    session.currentDay++;
  }

  const nextPlayer = session.players.find(p => p.id === session.activeTurnPlayerId);
  if (nextPlayer) {
    nextPlayer.pendingEvents.push({
      id: `evt_${++eventIdCounter}`,
      type: 'turn_notification',
      title: 'Your Turn',
      description: `Season ${session.currentSeason}, Day ${session.currentDay}. It's your turn.`,
      requiresAction: true,
      data: {},
    });
  }

  session.lastActivity = Date.now();
  return session.activeTurnPlayerId;
}

/** Get session summary for display */
export function getSessionSummary(session: MultiplayerSession): {
  mode: string;
  playerCount: number;
  season: number;
  day: number;
  activePlayer: string;
  recentHeadlines: string[];
  pendingTrades: number;
} {
  const modeConfig = MODE_CONFIGS[session.mode];
  const activePlayer = session.players.find(p => p.id === session.activeTurnPlayerId);
  return {
    mode: modeConfig.name,
    playerCount: session.players.length,
    season: session.currentSeason,
    day: session.currentDay,
    activePlayer: activePlayer?.displayName ?? 'Unknown',
    recentHeadlines: session.worldState.headlines.slice(-5),
    pendingTrades: session.worldState.trades.filter(t => t.status === 'pending').length,
  };
}
