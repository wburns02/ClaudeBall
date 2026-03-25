import type { EventBus } from '../ecs/EventBus.ts';
import type { SeasonPhaseChangedEvent } from '../ecs/types.ts';

export type SeasonPhase =
  | 'spring_training'
  | 'regular_season'
  | 'trade_deadline'
  | 'playoffs'
  | 'world_series'
  | 'season_review'
  | 'awards'
  | 'offseason'
  | 'preseason';

export interface OffseasonMonth {
  name: string;
  events: string[];
}

export const OFFSEASON_TIMELINE: OffseasonMonth[] = [
  { name: 'October', events: ['World Series', 'Season Review', 'Awards Ceremony', 'Player Opt-outs'] },
  { name: 'November', events: ['GM Meetings', 'Non-tender deadline', 'Qualifying Offers', 'Rule 5 Draft'] },
  { name: 'December', events: ['Winter Meetings', 'Free agency heats up', 'Major signings', 'Trade peak'] },
  { name: 'January', events: ['Arbitration filings', 'Remaining FA signings', 'International signings'] },
  { name: 'February', events: ['Arbitration hearings', 'Spring Training invites', 'Final roster moves'] },
  { name: 'March', events: ['Spring Training games', 'Opening Day roster cuts', 'Season begins'] },
];

export interface PhaseState {
  currentPhase: SeasonPhase;
  offseasonWeek: number;     // 0-based, ~24 weeks Oct-Mar
  offseasonMonth: number;    // 0-5 index into OFFSEASON_TIMELINE
  seasonDay: number;
  year: number;
}

/**
 * Orchestrates the season/offseason timeline.
 * Manages phase transitions and emits SeasonPhaseChanged events.
 */
export class PhaseRunner {
  private state: PhaseState;
  private bus: EventBus;

  constructor(bus: EventBus, year = 2026) {
    this.bus = bus;
    this.state = {
      currentPhase: 'preseason',
      offseasonWeek: 0,
      offseasonMonth: 0,
      seasonDay: 0,
      year,
    };
  }

  getState(): PhaseState {
    return { ...this.state };
  }

  getCurrentPhase(): SeasonPhase {
    return this.state.currentPhase;
  }

  /** Transition to a new phase, emitting an event. */
  transitionTo(newPhase: SeasonPhase): void {
    const oldPhase = this.state.currentPhase;
    if (oldPhase === newPhase) return;

    this.state.currentPhase = newPhase;

    if (newPhase === 'offseason') {
      this.state.offseasonWeek = 0;
      this.state.offseasonMonth = 0;
    }

    const event: SeasonPhaseChangedEvent = {
      type: 'SeasonPhaseChanged',
      timestamp: Date.now(),
      data: { from: oldPhase, to: newPhase },
    };
    this.bus.emit(event);
  }

  /** Advance offseason by one week. Returns the current month info. */
  advanceOffseasonWeek(): OffseasonMonth {
    this.state.offseasonWeek++;
    // ~4 weeks per month, 6 months
    this.state.offseasonMonth = Math.min(5, Math.floor(this.state.offseasonWeek / 4));
    return OFFSEASON_TIMELINE[this.state.offseasonMonth];
  }

  /** Check if offseason is complete (24 weeks = 6 months) */
  isOffseasonComplete(): boolean {
    return this.state.offseasonWeek >= 24;
  }

  /** Advance to next year */
  advanceYear(): void {
    this.state.year++;
    this.state.seasonDay = 0;
    this.state.offseasonWeek = 0;
    this.state.offseasonMonth = 0;
    this.transitionTo('spring_training');
  }

  /** Standard season progression: preseason → spring → regular → playoffs → offseason */
  getNextPhase(): SeasonPhase {
    switch (this.state.currentPhase) {
      case 'preseason': return 'spring_training';
      case 'spring_training': return 'regular_season';
      case 'regular_season': return 'trade_deadline';
      case 'trade_deadline': return 'regular_season'; // back to regular after deadline passes
      case 'playoffs': return 'world_series';
      case 'world_series': return 'season_review';
      case 'season_review': return 'awards';
      case 'awards': return 'offseason';
      case 'offseason': return 'preseason';
      default: return 'preseason';
    }
  }

  /** Serialize for save system */
  serialize(): PhaseState {
    return { ...this.state };
  }

  /** Restore from save */
  static deserialize(bus: EventBus, state: PhaseState): PhaseRunner {
    const runner = new PhaseRunner(bus, state.year);
    runner.state = { ...state };
    return runner;
  }
}
