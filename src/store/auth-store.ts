import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types matching the Prisma User model
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'ORGANIZER' | 'FACULTY' | 'ADMIN';
  department: string | null;
  usn: string | null;
  phone: string | null;
  avatar: string | null;
}

interface LoginResponse {
  user: AuthUser;
  token: string;
}

interface RegisterData {
  email: string;
  name: string;
  password: string;
  role?: string;
  department?: string;
  usn?: string;
  phone?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const data: LoginResponse = await res.json();
          if (!res.ok) {
            throw new Error((data as any).error || 'Login failed');
          }

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Login failed',
          });
          throw err;
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

          const responseData: LoginResponse = await res.json();
          if (!res.ok) {
            throw new Error((responseData as any).error || 'Registration failed');
          }

          set({
            user: responseData.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Registration failed',
          });
          throw err;
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      checkAuth: () => {
        // The persist middleware will rehydrate the state from localStorage.
        // We just need to verify that the user is still present.
        const { user } = get();
        if (user) {
          set({ isAuthenticated: true });
        } else {
          set({ isAuthenticated: false });
        }
      },

      updateProfile: async (data: Partial<AuthUser>) => {
        const { user } = get();
        if (!user) return;

        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/users/me', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': user.id,
            },
            body: JSON.stringify(data),
          });

          const responseData = await res.json();
          if (!res.ok) {
            throw new Error(responseData.error || 'Update failed');
          }

          set({
            user: responseData.user || responseData,
            isLoading: false,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Update failed',
          });
          throw err;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'nexevent-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
