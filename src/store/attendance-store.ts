import { create } from 'zustand';

interface CheckInResult {
  success: boolean;
  message: string;
  status?: string;
}

interface ReportData {
  event: any;
  stats: {
    totalRegistered: number;
    totalPresent: number;
    totalAbsent: number;
    attendanceRate: string;
  };
  attendees: any[];
}

interface AttendanceState {
  checkInResult: CheckInResult | null;
  isCheckingIn: boolean;
  eventReport: ReportData | null;
  isLoadingReport: boolean;
  checkIn: (eventId: string, qrCode: string, lat?: number, lng?: number) => Promise<void>;
  fetchReport: (eventId: string) => Promise<void>;
  generatePDF: (eventId: string) => Promise<ReportData | null>;
  clearCheckInResult: () => void;
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

export const useAttendanceStore = create<AttendanceState>()((set) => ({
  checkInResult: null,
  isCheckingIn: false,
  eventReport: null,
  isLoadingReport: false,

  checkIn: async (eventId: string, qrCode: string, lat?: number, lng?: number) => {
    set({ isCheckingIn: true, checkInResult: null });
    try {
      const userId = getUserId();
      const res = await fetch(`/api/events/${eventId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, qrCode, latitude: lat, longitude: lng }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ checkInResult: { success: false, message: data.error || 'Check-in failed' }, isCheckingIn: false });
        return;
      }
      set({
        checkInResult: { success: true, message: data.message, status: data.attendance?.status },
        isCheckingIn: false,
      });
    } catch (err) {
      set({
        checkInResult: { success: false, message: err instanceof Error ? err.message : 'Check-in failed' },
        isCheckingIn: false,
      });
    }
  },

  fetchReport: async (eventId: string) => {
    set({ isLoadingReport: true });
    try {
      const res = await fetch(`/api/events/${eventId}/report`);
      if (!res.ok) throw new Error('Failed to fetch report');
      const data = await res.json();
      set({ eventReport: data, isLoadingReport: false });
    } catch (err) {
      set({ isLoadingReport: false });
    }
  },

  generatePDF: async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/report`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate PDF data');
      const data = await res.json();
      set({ eventReport: data });
      return data;
    } catch (err) {
      return null;
    }
  },

  clearCheckInResult: () => set({ checkInResult: null }),
}));
