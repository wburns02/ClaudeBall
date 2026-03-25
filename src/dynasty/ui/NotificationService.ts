/**
 * Notification delivery service for Living Dynasty mode.
 * Manages text messages, phone calls, and press conferences.
 */

export type NotificationChannel = 'inbox' | 'text' | 'call' | 'press_conference' | 'group_chat';

export interface Notification {
  id: string;
  channel: NotificationChannel;
  fromName: string;
  fromRole: string;
  subject: string;
  body: string;
  timestamp: number;
  isRead: boolean;
  isVoice: boolean;       // Should this trigger voice playback?
  conversationId?: string; // Link to conversation if applicable
}

let nextNotifId = 1;

export class NotificationService {
  private notifications: Notification[] = [];
  private textThread: Map<string, Notification[]> = new Map(); // contactName → messages

  /** Queue a new notification */
  send(params: Omit<Notification, 'id' | 'timestamp' | 'isRead'>): Notification {
    const notif: Notification = {
      ...params,
      id: `notif_${nextNotifId++}`,
      timestamp: Date.now(),
      isRead: false,
    };
    this.notifications.push(notif);

    // Add to text thread if it's a text message
    if (params.channel === 'text') {
      const thread = this.textThread.get(params.fromName) ?? [];
      thread.push(notif);
      this.textThread.set(params.fromName, thread);
    }

    return notif;
  }

  /** Get all notifications, newest first */
  getAll(): Notification[] {
    return [...this.notifications].reverse();
  }

  /** Get unread notifications */
  getUnread(): Notification[] {
    return this.notifications.filter(n => !n.isRead).reverse();
  }

  /** Get text thread for a contact */
  getTextThread(contactName: string): Notification[] {
    return this.textThread.get(contactName) ?? [];
  }

  /** Get all contacts with text threads */
  getTextContacts(): string[] {
    return [...this.textThread.keys()];
  }

  /** Mark a notification as read */
  markRead(id: string): void {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) notif.isRead = true;
  }

  /** Get count of unread */
  get unreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }

  /** Get notifications by channel */
  getByChannel(channel: NotificationChannel): Notification[] {
    return this.notifications.filter(n => n.channel === channel).reverse();
  }

  /** Clear all notifications (new season) */
  clear(): void {
    this.notifications = [];
    this.textThread.clear();
  }

  /** Serialize for save */
  serialize(): Notification[] {
    return [...this.notifications];
  }

  /** Restore from save */
  restore(notifications: Notification[]): void {
    this.notifications = [...notifications];
    this.textThread.clear();
    for (const n of this.notifications) {
      if (n.channel === 'text') {
        const thread = this.textThread.get(n.fromName) ?? [];
        thread.push(n);
        this.textThread.set(n.fromName, thread);
      }
    }
  }
}
