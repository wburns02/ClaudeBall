/** Unique entity identifier */
export type EntityId = string;

/** Dynasty mode — determines which systems are active */
export type DynastyMode = 'classic' | 'living';

/** Base interface for all components */
export interface Component {
  readonly type: string;
}

/** Base interface for all ECS systems */
export interface System {
  readonly name: string;
  /** Which dynasty modes this system is active in */
  readonly modes: DynastyMode[];
  /** Process a tick — called by SystemRunner */
  tick(dt: number): void;
  /** Handle a specific event */
  handleEvent?(event: DynastyEvent): void;
}

/** Base dynasty event */
export interface DynastyEvent {
  readonly type: string;
  readonly timestamp: number;
  readonly entityId?: EntityId;
  readonly data?: Record<string, unknown>;
}

// ---- Core Event Types (all 21 from spec) ----

export interface GameCompletedEvent extends DynastyEvent {
  type: 'GameCompleted';
  data: { homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number };
}

export interface PlayerTradedEvent extends DynastyEvent {
  type: 'PlayerTraded';
  data: { playerId: string; fromTeamId: string; toTeamId: string; gmEntityId?: EntityId };
}

export interface PlayerSignedEvent extends DynastyEvent {
  type: 'PlayerSigned';
  data: { playerId: string; teamId: string; years: number; salary: number };
}

export interface PlayerReleasedEvent extends DynastyEvent {
  type: 'PlayerReleased';
  data: { playerId: string; teamId: string };
}

export interface PlayerRetiredEvent extends DynastyEvent {
  type: 'PlayerRetired';
  data: { playerId: string; teamId: string; age: number };
}

export interface PlayerInjuredEvent extends DynastyEvent {
  type: 'PlayerInjured';
  data: { playerId: string; teamId: string; severity: 'minor' | 'major' | 'career_ending' };
}

export interface SeasonPhaseChangedEvent extends DynastyEvent {
  type: 'SeasonPhaseChanged';
  data: { from: string; to: string };
}

export interface AwardWonEvent extends DynastyEvent {
  type: 'AwardWon';
  data: { playerId: string; award: string; league: string };
}

export interface ReputationShiftEvent extends DynastyEvent {
  type: 'ReputationShift';
  data: { entityId: EntityId; meter: 'clubhouse' | 'media' | 'fan'; delta: number; reason: string };
}

export interface RelationshipChangedEvent extends DynastyEvent {
  type: 'RelationshipChanged';
  data: { fromId: EntityId; toId: EntityId; affinityDelta: number; reason: string };
}

export interface ConversationTriggeredEvent extends DynastyEvent {
  type: 'ConversationTriggered';
  data: { situation: string; npcId: EntityId; stakes: 'routine' | 'moderate' | 'career_defining' };
}

export interface ContractOfferedEvent extends DynastyEvent {
  type: 'ContractOffered';
  data: { playerId: string; teamId: string; years: number; salary: number };
}

export interface ContractSignedEvent extends DynastyEvent {
  type: 'ContractSigned';
  data: { playerId: string; teamId: string; years: number; salary: number };
}

export interface DraftPickMadeEvent extends DynastyEvent {
  type: 'DraftPickMade';
  data: { playerId: string; teamId: string; round: number; pick: number };
}

export interface OwnerMeetingEvent extends DynastyEvent {
  type: 'OwnerMeeting';
  data: { ownerId: EntityId; gmId: EntityId; agenda: string };
}

export interface ManagerFiredEvent extends DynastyEvent {
  type: 'ManagerFired';
  data: { managerId: EntityId; teamId: string; reason: string };
}

export interface GMHiredEvent extends DynastyEvent {
  type: 'GMHired';
  data: { gmId: EntityId; teamId: string };
}

export interface GMFiredEvent extends DynastyEvent {
  type: 'GMFired';
  data: { gmId: EntityId; teamId: string; reason: string };
}

export interface FinancialEvent extends DynastyEvent {
  type: 'FinancialEvent';
  data: { entityId: EntityId; category: string; amount: number; description: string };
}

export interface LifeEventDynastyEvent extends DynastyEvent {
  type: 'LifeEvent';
  data: { entityId: EntityId; category: string; description: string };
}

export interface CareerTransitionEvent extends DynastyEvent {
  type: 'CareerTransition';
  data: { entityId: EntityId; fromRole: string; toRole: string };
}

export interface ScandalOccurredEvent extends DynastyEvent {
  type: 'ScandalOccurred';
  data: { entityId: EntityId; tier: 'minor' | 'moderate' | 'severe' | 'nuclear'; scandalType: string; description: string; suspension: number };
}

export interface TeamForSaleEvent extends DynastyEvent {
  type: 'TeamForSale';
  data: { teamId: string; reason: string; askingPrice: number };
}

export interface TeamPurchasedEvent extends DynastyEvent {
  type: 'TeamPurchased';
  data: { buyerId: EntityId; teamId: string; price: number };
}

/** Union of all event types for type-safe handlers */
export type DynastyEventMap = {
  GameCompleted: GameCompletedEvent;
  PlayerTraded: PlayerTradedEvent;
  PlayerSigned: PlayerSignedEvent;
  PlayerReleased: PlayerReleasedEvent;
  PlayerRetired: PlayerRetiredEvent;
  PlayerInjured: PlayerInjuredEvent;
  SeasonPhaseChanged: SeasonPhaseChangedEvent;
  AwardWon: AwardWonEvent;
  ReputationShift: ReputationShiftEvent;
  RelationshipChanged: RelationshipChangedEvent;
  ConversationTriggered: ConversationTriggeredEvent;
  ContractOffered: ContractOfferedEvent;
  ContractSigned: ContractSignedEvent;
  DraftPickMade: DraftPickMadeEvent;
  OwnerMeeting: OwnerMeetingEvent;
  ManagerFired: ManagerFiredEvent;
  GMHired: GMHiredEvent;
  GMFired: GMFiredEvent;
  FinancialEvent: FinancialEvent;
  LifeEvent: LifeEventDynastyEvent;
  CareerTransition: CareerTransitionEvent;
  ScandalOccurred: ScandalOccurredEvent;
  TeamForSale: TeamForSaleEvent;
  TeamPurchased: TeamPurchasedEvent;
};
