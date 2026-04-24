import { create } from 'zustand';

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo: string | null;
  coverImage: string | null;
  category: string;
  isActive: boolean;
  foundedYear: number | null;
  facultyAdvisorId: string | null;
  // Club page fields
  mission: string | null;
  vision: string | null;
  highlights: string | null;
  socialLinks: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated relations
  facultyAdvisor?: { id: string; name: string; email: string } | null;
  members?: { id: string; role: string; user: { id: string; name: string; email: string; avatar: string | null } }[];
  events?: any[];
  roles?: ClubRole[];
  achievements?: ClubAchievement[];
  roleAssignments?: any[];
  _count?: { members: number; events: number };
}

export interface ClubRole {
  id: string;
  clubId: string;
  name: string;
  description: string | null;
  permissions: string; // JSON string
  isDefault: boolean;
  color: string | null;
  createdBy: string;
  createdAt: string;
  assignments?: ClubRoleAssignment[];
  creator?: { id: string; name: string };
}

export interface ClubRoleAssignment {
  id: string;
  clubRoleId: string;
  userId: string;
  clubId: string;
  assignedBy: string;
  assignedAt: string;
  user?: { id: string; name: string; email: string; avatar: string | null };
  role?: ClubRole;
}

export interface ClubAchievement {
  id: string;
  clubId: string;
  title: string;
  description: string | null;
  date: string;
  icon: string | null;
  category: string | null;
  createdBy: string;
  createdAt: string;
  creator?: { id: string; name: string };
}

interface ClubState {
  clubs: Club[];
  currentClub: Club | null;
  isLoading: boolean;
  error: string | null;
  fetchClubs: () => Promise<void>;
  fetchClubById: (id: string) => Promise<void>;
  createClub: (data: any) => Promise<void>;
  joinClub: (clubId: string) => Promise<void>;
  leaveClub: (clubId: string) => Promise<void>;
  // Club page
  updateClubPage: (clubId: string, data: any) => Promise<void>;
  // Roles
  createClubRole: (clubId: string, data: any) => Promise<void>;
  updateClubRole: (clubId: string, roleId: string, data: any) => Promise<void>;
  deleteClubRole: (clubId: string, roleId: string) => Promise<void>;
  assignClubRole: (clubId: string, roleId: string, targetUserId: string) => Promise<void>;
  revokeClubRole: (clubId: string, roleId: string, targetUserId: string) => Promise<void>;
  // Achievements
  createAchievement: (clubId: string, data: any) => Promise<void>;
  deleteAchievement: (clubId: string, achievementId: string) => Promise<void>;
  clearCurrentClub: () => void;
}

function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('nexevent-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.user?.id ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

export const useClubStore = create<ClubState>()((set, get) => ({
  clubs: [],
  currentClub: null,
  isLoading: false,
  error: null,

  fetchClubs: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/clubs');
      if (!res.ok) throw new Error('Failed to fetch clubs');
      const data = await res.json();
      set({ clubs: data.clubs, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to fetch clubs' });
    }
  },

  fetchClubById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/clubs/${id}`);
      if (!res.ok) throw new Error('Failed to fetch club');
      const data = await res.json();
      set({ currentClub: data.club, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to fetch club' });
    }
  },

  createClub: async (data: any) => {
    set({ isLoading: true, error: null });
    try {
      const userId = getUserId();
      const res = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
        body: JSON.stringify({ ...data, userId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create club');
      }
      await get().fetchClubs();
      set({ isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to create club' });
      throw err;
    }
  },

  joinClub: async (clubId: string) => {
    try {
      const userId = getUserId();
      const res = await fetch(`/api/clubs/${clubId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to join club');
      }
      await get().fetchClubById(clubId);
    } catch (err) {
      throw err;
    }
  },

  leaveClub: async (clubId: string) => {
    try {
      const userId = getUserId();
      const res = await fetch(`/api/clubs/${clubId}/members?userId=${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to leave club');
      }
      await get().fetchClubById(clubId);
    } catch (err) {
      throw err;
    }
  },

  // Club Page
  updateClubPage: async (clubId: string, data: any) => {
    try {
      const userId = getUserId();
      const res = await fetch(`/api/clubs/${clubId}/page`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update club page');
      }
      await get().fetchClubById(clubId);
    } catch (err) {
      throw err;
    }
  },

  // Club Roles
  createClubRole: async (clubId: string, data: any) => {
    try {
      const userId = getUserId();
      const res = await fetch(`/api/clubs/${clubId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create role');
      }
      await get().fetchClubById(clubId);
    } catch (err) {
      throw err;
    }
  },

  updateClubRole: async (clubId: string, roleId: string, data: any) => {
    try {
      const userId = getUserId();
      const res = await fetch(`/api/clubs/${clubId}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, roleId, userId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update role');
      }
      await get().fetchClubById(clubId);
    } catch (err) {
      throw err;
    }
  },

  deleteClubRole: async (clubId: string, roleId: string) => {
    try {
      const userId = getUserId();
      const res = await fetch(`/api/clubs/${clubId}/roles?roleId=${roleId}&userId=${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete role');
      }
      await get().fetchClubById(clubId);
    } catch (err) {
      throw err;
    }
  },

  assignClubRole: async (clubId: string, roleId: string, targetUserId: string) => {
    try {
      const userId = getUserId();
      const res = await fetch(`/api/clubs/${clubId}/roles/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubRoleId: roleId, userId: targetUserId, assignedBy: userId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to assign role');
      }
      await get().fetchClubById(clubId);
    } catch (err) {
      throw err;
    }
  },

  revokeClubRole: async (clubId: string, roleId: string, targetUserId: string) => {
    try {
      const userId = getUserId();
      const res = await fetch(`/api/clubs/${clubId}/roles/assign`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubRoleId: roleId, userId: targetUserId, revokedBy: userId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to revoke role');
      }
      await get().fetchClubById(clubId);
    } catch (err) {
      throw err;
    }
  },

  // Achievements
  createAchievement: async (clubId: string, data: any) => {
    try {
      const userId = getUserId();
      const res = await fetch(`/api/clubs/${clubId}/achievements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to add achievement');
      }
      await get().fetchClubById(clubId);
    } catch (err) {
      throw err;
    }
  },

  deleteAchievement: async (clubId: string, achievementId: string) => {
    try {
      const userId = getUserId();
      const res = await fetch(`/api/clubs/${clubId}/achievements?achievementId=${achievementId}&userId=${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete achievement');
      }
      await get().fetchClubById(clubId);
    } catch (err) {
      throw err;
    }
  },

  clearCurrentClub: () => set({ currentClub: null }),
}));
