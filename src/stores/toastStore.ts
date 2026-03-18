import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  fadingOut?: boolean;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  beginFadeOut: (id: string) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (message, type = 'info') => {
    const id = String(nextId++);
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }));

    // Begin fade-out at 2.7s, remove at 3s
    setTimeout(() => {
      set(state => ({
        toasts: state.toasts.map(t => t.id === id ? { ...t, fadingOut: true } : t),
      }));
    }, 2700);

    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 3000);
  },

  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },

  beginFadeOut: (id) => {
    set(state => ({
      toasts: state.toasts.map(t => t.id === id ? { ...t, fadingOut: true } : t),
    }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 300);
  },
}));

/** Convenience helper — callable outside React components */
export const addToast = (message: string, type: ToastType = 'info') =>
  useToastStore.getState().addToast(message, type);
