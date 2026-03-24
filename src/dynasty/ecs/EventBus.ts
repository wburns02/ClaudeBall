import type { DynastyEvent } from './types.ts';

type EventHandler = (event: DynastyEvent) => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private wildcardHandlers = new Set<EventHandler>();
  private history: DynastyEvent[] = [];
  private maxHistory: number;

  constructor(maxHistory = 5000) {
    this.maxHistory = maxHistory;
  }

  /** Subscribe to a specific event type. Returns unsubscribe function. */
  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => { this.handlers.get(eventType)?.delete(handler); };
  }

  /** Subscribe to all events. Returns unsubscribe function. */
  onAny(handler: EventHandler): () => void {
    this.wildcardHandlers.add(handler);
    return () => { this.wildcardHandlers.delete(handler); };
  }

  /** Emit an event to all matching subscribers. */
  emit(event: DynastyEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const h of handlers) h(event);
    }
    for (const h of this.wildcardHandlers) h(event);
  }

  /** Get event history, optionally filtered by type. */
  getHistory(eventType?: string): DynastyEvent[] {
    if (eventType) return this.history.filter(e => e.type === eventType);
    return [...this.history];
  }

  /** Clear event history. */
  clearHistory(): void {
    this.history = [];
  }
}
