import type { EntityId, DynastyEvent } from '../ecs/types.ts';

export type InboxItemType = 'actionable' | 'informational' | 'decision' | 'personal';
export type InboxPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface InboxItem {
  id: string;
  type: InboxItemType;
  priority: InboxPriority;
  title: string;
  description: string;
  fromEntityId?: EntityId;
  fromName?: string;
  actionRoute?: string;         // Route to navigate to for action
  triggeredBy?: string;         // Event type that created this
  isRead: boolean;
  isActedOn: boolean;
  week: number;                 // Offseason week when this arrived
  timestamp: number;
}

let nextInboxId = 1;

/**
 * Offseason inbox — central interface for Hot Stove events.
 * Events arrive chronologically; the world moves whether or not the player engages.
 */
export class OffseasonInbox {
  private items: InboxItem[] = [];

  /** Add an item to the inbox */
  addItem(item: Omit<InboxItem, 'id' | 'isRead' | 'isActedOn' | 'timestamp'>): InboxItem {
    const full: InboxItem = {
      ...item,
      id: `inbox_${nextInboxId++}`,
      isRead: false,
      isActedOn: false,
      timestamp: Date.now(),
    };
    this.items.push(full);
    return full;
  }

  /** Get all items, newest first */
  getAll(): InboxItem[] {
    return [...this.items].reverse();
  }

  /** Get unread items */
  getUnread(): InboxItem[] {
    return this.items.filter(i => !i.isRead).reverse();
  }

  /** Get items needing action */
  getActionable(): InboxItem[] {
    return this.items.filter(i => i.type === 'actionable' && !i.isActedOn).reverse();
  }

  /** Mark an item as read */
  markRead(id: string): void {
    const item = this.items.find(i => i.id === id);
    if (item) item.isRead = true;
  }

  /** Mark an item as acted on */
  markActedOn(id: string): void {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.isActedOn = true;
      item.isRead = true;
    }
  }

  /** Get count of unread items */
  get unreadCount(): number {
    return this.items.filter(i => !i.isRead).length;
  }

  /** Get count of items needing action */
  get actionCount(): number {
    return this.items.filter(i => i.type === 'actionable' && !i.isActedOn).length;
  }

  /** Generate inbox items from a dynasty event */
  generateFromEvent(event: DynastyEvent, week: number): InboxItem | null {
    switch (event.type) {
      case 'PlayerTraded':
        return this.addItem({
          type: 'informational', priority: 'normal', week,
          title: `Trade: ${event.data?.playerId} moved`,
          description: `${event.data?.playerId} traded from ${event.data?.fromTeamId} to ${event.data?.toTeamId}`,
        });
      case 'ContractSigned':
        return this.addItem({
          type: 'informational', priority: 'normal', week,
          title: `Signing: ${event.data?.playerId}`,
          description: `${event.data?.playerId} signed with ${event.data?.teamId} for ${event.data?.years}yr/$${((event.data?.salary as number) / 1000).toFixed(0)}M`,
        });
      case 'PlayerRetired':
        return this.addItem({
          type: 'informational', priority: 'low', week,
          title: `Retirement: ${event.data?.playerId}`,
          description: `${event.data?.playerId} has announced retirement at age ${event.data?.age}`,
        });
      case 'AwardWon':
        return this.addItem({
          type: 'informational', priority: 'high', week,
          title: `${event.data?.award}: ${event.data?.playerId}`,
          description: `${event.data?.playerId} wins ${event.data?.league} ${event.data?.award}`,
        });
      default:
        return null;
    }
  }

  /** Clear all items (new season) */
  clear(): void {
    this.items = [];
  }

  /** Serialize for save */
  serialize(): InboxItem[] {
    return [...this.items];
  }

  /** Restore from save */
  restore(items: InboxItem[]): void {
    this.items = [...items];
  }
}
