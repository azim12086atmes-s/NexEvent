import { create } from 'zustand';

// Types matching the Prisma Event model
export type EventCategory =
  | 'TECHNICAL'
  | 'CULTURAL'
  | 'SPORTS'
  | 'WORKSHOP'
  | 'SEMINAR'
  | 'HACKATHON'
  | 'SOCIAL'
  | 'OTHER';

export type EventStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'LIVE'
  | 'COMPLETED'
  | 'CANCELLED';

export type RegistrationStatus =
  | 'REGISTERED'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'WAITLISTED';

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  poster: string | null;
  category: EventCategory;
  status: EventStatus;
  venue: string;
  venueLat: number | null;
  venueLng: number | null;
  geoFenceRadius: number | null;
  startDate: string;
  endDate: string;
  registrationDeadline: string | null;
  maxParticipants: number | null;
  isPublic: boolean;
  requiresApproval: boolean;
  tags: string;
  organizerId: string;
  clubId: string | null;
  approverId: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated relations
  organizer?: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  club?: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  } | null;
  registrations?: EventRegistration[];
  _count?: {
    registrations: number;
  };
}

export interface EventRegistration {
  id: string;
  eventId: string;
  userId: string;
  status: RegistrationStatus;
  qrCode: string | null;
  registeredAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
}

interface EventFilters {
  category: EventCategory | null;
  status: EventStatus | null;
  search: string;
  upcoming: boolean;
  clubId: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

interface CreateEventData {
  title: string;
  description: string;
  category: EventCategory;
  venue: string;
  venueLat?: number;
  venueLng?: number;
  geoFenceRadius?: number;
  startDate: string;
  endDate: string;
  registrationDeadline?: string;
  maxParticipants?: number;
  isPublic?: boolean;
  requiresApproval?: boolean;
  tags?: string;
  clubId?: string;
}

interface EventState {
  events: Event[];
  currentEvent: Event | null;
  filters: EventFilters;
  pagination: Pagination;
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;

  fetchEvents: (filters?: Partial<EventFilters>) => Promise<void>;
  fetchEventById: (id: string) => Promise<void>;
  createEvent: (data: CreateEventData) => Promise<Event>;
  updateEvent: (id: string, data: Partial<CreateEventData>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  registerForEvent: (eventId: string) => Promise<void>;
  cancelRegistration: (eventId: string) => Promise<void>;
  approveEvent: (
    eventId: string,
    action: 'approve' | 'reject',
    reason?: string
  ) => Promise<void>;
  setFilters: (filters: Partial<EventFilters>) => void;
  clearFilters: () => void;
  clearCurrentEvent: () => void;
  clearError: () => void;
}

const defaultFilters: EventFilters = {
  category: null,
  status: null,
  search: '',
  upcoming: false,
  clubId: null,
};

const defaultPagination: Pagination = {
  page: 1,
  limit: 12,
  total: 0,
};

function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('nexevent-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.user?.id ?? null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export const useEventStore = create<EventState>()((set, get) => ({
  events: [],
  currentEvent: null,
  filters: { ...defaultFilters },
  pagination: { ...defaultPagination },
  isLoading: false,
  isCreating: false,
  error: null,

  fetchEvents: async (filters?: Partial<EventFilters>) => {
    set({ isLoading: true, error: null });
    try {
      const currentFilters = filters
        ? { ...get().filters, ...filters }
        : get().filters;
      const { pagination } = get();

      const params = new URLSearchParams();
      if (currentFilters.category) params.set('category', currentFilters.category);
      if (currentFilters.status) params.set('status', currentFilters.status);
      if (currentFilters.search) params.set('search', currentFilters.search);
      if (currentFilters.upcoming) params.set('upcoming', 'true');
      if (currentFilters.clubId) params.set('clubId', currentFilters.clubId);
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());

      const headers: HeadersInit = {};
      const userId = getUserId();
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`/api/events?${params.toString()}`, { headers });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch events');
      }

      const data = await res.json();
      set({
        events: data.events ?? data,
        pagination: data.pagination
          ? {
              page: data.pagination.page ?? pagination.page,
              limit: data.pagination.limit ?? pagination.limit,
              total: data.pagination.total ?? 0,
            }
          : pagination,
        filters: currentFilters,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch events',
      });
    }
  },

  fetchEventById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const headers: HeadersInit = {};
      const userId = getUserId();
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`/api/events/${id}`, { headers });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch event');
      }

      const data = await res.json();
      set({ currentEvent: data.event || data, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch event',
      });
    }
  },

  createEvent: async (data: CreateEventData) => {
    set({ isCreating: true, error: null });
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const userId = getUserId();
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch('/api/events', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const responseData = await res.json();
        throw new Error(responseData.error || 'Failed to create event');
      }

      const event: Event = await res.json();
      set((state) => ({
        events: [event, ...state.events],
        isCreating: false,
      }));
      return event;
    } catch (err) {
      set({
        isCreating: false,
        error: err instanceof Error ? err.message : 'Failed to create event',
      });
      throw err;
    }
  },

  updateEvent: async (id: string, data: Partial<CreateEventData>) => {
    set({ isLoading: true, error: null });
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const userId = getUserId();
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const responseData = await res.json();
        throw new Error(responseData.error || 'Failed to update event');
      }

      const updatedEvent: Event = await res.json();
      set((state) => ({
        events: state.events.map((e) => (e.id === id ? updatedEvent : e)),
        currentEvent:
          state.currentEvent?.id === id ? updatedEvent : state.currentEvent,
        isLoading: false,
      }));
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to update event',
      });
      throw err;
    }
  },

  deleteEvent: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const headers: HeadersInit = {};
      const userId = getUserId();
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete event');
      }

      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
        currentEvent: state.currentEvent?.id === id ? null : state.currentEvent,
        isLoading: false,
      }));
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to delete event',
      });
      throw err;
    }
  },

  registerForEvent: async (eventId: string) => {
    set({ isLoading: true, error: null });
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const userId = getUserId();
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`/api/events/${eventId}/register`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to register for event');
      }

      // Refresh the event to get updated registration count
      await get().fetchEventById(eventId);
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to register',
      });
      throw err;
    }
  },

  cancelRegistration: async (eventId: string) => {
    set({ isLoading: true, error: null });
    try {
      const headers: HeadersInit = {};
      const userId = getUserId();
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`/api/events/${eventId}/register`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel registration');
      }

      // Refresh the event to get updated registration count
      await get().fetchEventById(eventId);
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error
          ? err.message
          : 'Failed to cancel registration',
      });
      throw err;
    }
  },

  approveEvent: async (
    eventId: string,
    action: 'approve' | 'reject',
    reason?: string
  ) => {
    set({ isLoading: true, error: null });
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const userId = getUserId();
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch(`/api/events/${eventId}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process approval');
      }

      // Refresh the event
      await get().fetchEventById(eventId);
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error
          ? err.message
          : 'Failed to process approval',
      });
      throw err;
    }
  },

  setFilters: (filters: Partial<EventFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 }, // Reset to page 1 on filter change
    }));
  },

  clearFilters: () => {
    set({
      filters: { ...defaultFilters },
      pagination: { ...defaultPagination },
    });
  },

  clearCurrentEvent: () => set({ currentEvent: null }),

  clearError: () => set({ error: null }),
}));
