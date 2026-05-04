import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NotifItem {
  id: number;           // message_id from backend
  title: string;        // e.g. customer name / phone
  preview: string;      // message snippet
  phone: string;        // for routing
  timestamp: number;    // Date.now()
  read: boolean;
  route: string;        // where to navigate on click
}

interface NotificationState {
  lastSeenMessageId: number;
  notifications: NotifItem[];
  
  // Actions
  addNotification: (notif: NotifItem) => void;
  removeNotification: (id: number) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      lastSeenMessageId: 0,
      notifications: [],

      addNotification: (notif) => {
        set((state) => {
          // Avoid duplicates
          if (state.notifications.some((n) => n.id === notif.id)) return state;
          
          return {
            lastSeenMessageId: Math.max(state.lastSeenMessageId, notif.id),
            notifications: [notif, ...state.notifications].slice(0, 30),
          };
        });
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearAll: () => {
        set({ notifications: [] });
      },
    }),
    {
      name: 'sp_notif_history_v2', // unique name
    }
  )
);
