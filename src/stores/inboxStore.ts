import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type InboxItemType =
  | 'injury'
  | 'return'
  | 'trade_offer'
  | 'trade_result'
  | 'waiver'
  | 'fa_signing'
  | 'milestone'
  | 'callup'
  | 'standings'
  | 'contract'
  | 'record'
  | 'general';

export interface InboxItem {
  id: string;
  type: InboxItemType;
  title: string;
  body: string;
  day: number;
  read: boolean;
  urgent: boolean;
  linkedUrl?: string;
  createdAt: string;
}

interface InboxState {
  items: InboxItem[];
  /** Track which trade proposal IDs we've already notified about */
  seenTradeProposalIds: string[];

  addItem: (item: Omit<InboxItem, 'id' | 'createdAt' | 'read'>) => void;
  addItems: (items: Omit<InboxItem, 'id' | 'createdAt' | 'read'>[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  getUnreadCount: () => number;
  markProposalSeen: (id: string) => void;
  hasSeenProposal: (id: string) => boolean;
  reset: () => void;
}

export const useInboxStore = create<InboxState>()(
  persist(
    (set, get) => ({
      items: [],
      seenTradeProposalIds: [],

      addItem: (item) => {
        const newItem: InboxItem = {
          ...item,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          createdAt: new Date().toISOString(),
          read: false,
        };
        set(s => ({ items: [newItem, ...s.items].slice(0, 300) }));
      },

      addItems: (items) => {
        if (items.length === 0) return;
        const now = Date.now();
        const newItems: InboxItem[] = items.map((item, i) => ({
          ...item,
          id: `${now}-${i}-${Math.random().toString(36).slice(2)}`,
          createdAt: new Date().toISOString(),
          read: false,
        }));
        set(s => ({ items: [...newItems, ...s.items].slice(0, 300) }));
      },

      markRead: (id) => {
        set(s => ({ items: s.items.map(i => i.id === id ? { ...i, read: true } : i) }));
      },

      markAllRead: () => {
        set(s => ({ items: s.items.map(i => ({ ...i, read: true })) }));
      },

      getUnreadCount: () => get().items.filter(i => !i.read).length,

      markProposalSeen: (id) => {
        set(s => ({ seenTradeProposalIds: [...s.seenTradeProposalIds, id] }));
      },

      hasSeenProposal: (id) => get().seenTradeProposalIds.includes(id),

      reset: () => set({ items: [], seenTradeProposalIds: [] }),
    }),
    { name: 'claudeball-inbox-v1' }
  )
);
