import { create } from 'zustand';

export type ViewName =
  | 'landing'
  | 'feed'
  | 'event-detail'
  | 'dashboard'
  | 'student-dashboard'
  | 'hod-dashboard'
  | 'admin'
  | 'profile'
  | 'clubs'
  | 'club-detail'
  | 'my-events'
  | 'create-event'
  | 'scan-qr'
  | 'judge-scoring'
  | 'results'
  | 'certificates'
  | 'login'
  | 'register';

interface UIState {
  currentView: ViewName;
  previousView: ViewName | null;
  selectedEventId: string | null;
  selectedClubId: string | null;
  sidebarOpen: boolean;
  searchQuery: string;
  theme: 'light' | 'dark';
  showAuthModal: boolean;
  authMode: 'login' | 'register';
  navigate: (view: ViewName, id?: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleTheme: () => void;
  showLogin: () => void;
  showRegister: () => void;
  closeAuthModal: () => void;
}

export const useUIStore = create<UIState>()((set, get) => ({
  currentView: 'landing',
  previousView: null,
  selectedEventId: null,
  selectedClubId: null,
  sidebarOpen: false,
  searchQuery: '',
  theme: 'light',
  showAuthModal: false,
  authMode: 'login',

  navigate: (view: ViewName, id?: string) => {
    const state = get();
    set({
      previousView: state.currentView,
      currentView: view,
      selectedEventId: ['event-detail', 'judge-scoring', 'results', 'certificates'].includes(view) ? (id || state.selectedEventId) : null,
      selectedClubId: view === 'club-detail' ? (id || state.selectedClubId) : null,
      sidebarOpen: false,
    });
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  toggleTheme: () => set((s) => {
    const newTheme = s.theme === 'light' ? 'dark' : 'light';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    }
    return { theme: newTheme };
  }),

  showLogin: () => set({ showAuthModal: true, authMode: 'login' }),
  showRegister: () => set({ showAuthModal: true, authMode: 'register' }),
  closeAuthModal: () => set({ showAuthModal: false }),
}));
