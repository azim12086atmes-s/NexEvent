'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { useEventStore } from '@/store/event-store';
import {
  ArrowLeft, Calendar, MapPin, Clock, Users, Share2,
  QrCode, CheckCircle2, XCircle, Loader2, Tag, Building2,
  FileText, Download, ExternalLink, User as UserIcon,
  Zap, Heart, BookmarkPlus, ChevronRight, Timer, Flame,
  Swords, Trophy, Layers, Target, Shield, UsersRound, Trash2,
  ClipboardCheck, BarChart3, Award, UserPlus, LogOut, Copy, Hash,
  AlertTriangle, Radio, Navigation, Pause
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const categoryColors: Record<string, string> = {
  HACKATHON: 'from-violet-500 to-purple-600',
  TECHNICAL: 'from-cyan-500 to-blue-600',
  CULTURAL: 'from-rose-500 to-pink-600',
  WORKSHOP: 'from-amber-500 to-orange-600',
  SEMINAR: 'from-emerald-500 to-teal-600',
  SPORTS: 'from-green-500 to-lime-600',
  SOCIAL: 'from-fuchsia-500 to-purple-600',
  OTHER: 'from-gray-500 to-gray-600',
};

const statusColors: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  LIVE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  COMPLETED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const categoryIcons: Record<string, string> = {
  HACKATHON: '💻', TECHNICAL: '⚡', CULTURAL: '🎭', WORKSHOP: '🔧',
  SEMINAR: '🎓', SPORTS: '🏆', SOCIAL: '🌱', OTHER: '📌',
};

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getTimeUntil(d: string | Date, endDate?: string | Date): string {
  const now = new Date();
  const target = new Date(d);
  const end = endDate ? new Date(endDate) : null;
  const diff = target.getTime() - now.getTime();
  if (diff < 0) {
    // Event has started - check if still ongoing
    if (end && now.getTime() < end.getTime()) {
      return 'LIVE NOW';
    }
    return 'Event ended';
  }
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} to go`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} to go`;
  const mins = Math.floor(diff / (1000 * 60));
  return `${mins} min to go`;
}

export function EventDetail() {
  const { user, isAuthenticated } = useAuthStore();
  const { navigate, selectedEventId, previousView } = useUIStore();
  const { currentEvent, isLoading, fetchEventById, registerForEvent, cancelRegistration, approveEvent } = useEventStore();
  const [registering, setRegistering] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [userReg, setUserReg] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [liked, setLiked] = useState(false);
  const [canScore, setCanScore] = useState(false);
  const [canViewResults, setCanViewResults] = useState(false);

  // Team registration state
  const [teams, setTeams] = useState<any[]>([]);
  const [userTeam, setUserTeam] = useState<any>(null);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const [showJoinTeamDialog, setShowJoinTeamDialog] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);

  // Live attendance tracking state
  const [isPinging, setIsPinging] = useState(false);
  const [attendancePct, setAttendancePct] = useState(0);
  const [withinFence, setWithinFence] = useState<boolean | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [pingCount, setPingCount] = useState(0);
  const [lastPingTime, setLastPingTime] = useState<string | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup ping interval on unmount
  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  // Fetch current attendance data when the event is LIVE and user is registered
  const fetchAttendance = useCallback(async () => {
    if (!selectedEventId || !user) return;
    try {
      const res = await fetch(`/api/events/${selectedEventId}/attendance?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.attendance) {
          setAttendancePct(data.attendance.attendancePercentage || 0);
          setWithinFence(data.attendance.isWithinGeoFence);
        }
      }
    } catch { /* ignore */ }
  }, [selectedEventId, user]);

  const sendPing = useCallback(async () => {
    if (!selectedEventId || !user) return;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        });
      });

      const res = await fetch(`/api/events/${selectedEventId}/location-pings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          eventId: selectedEventId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setWithinFence(data.isWithinFence);
        setPingCount(prev => prev + 1);
        setLastPingTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setGeoError(null);
        // Refresh attendance percentage after each ping
        fetchAttendance();
      } else {
        toast.error(data.error || 'Ping failed');
      }
    } catch (err: any) {
      if (err.code === 1) {
        setGeoError('Location permission denied. Please enable location access.');
        // Auto-stop pinging on permission denied
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        setIsPinging(false);
        fetchAttendance();
        toast.info('Location access denied. Attendance tracking stopped.');
      } else if (err.code === 2) {
        setGeoError('Location unavailable. Please check your device settings.');
      } else if (err.code === 3) {
        setGeoError('Location request timed out. Retrying...');
      }
    }
  }, [selectedEventId, user, fetchAttendance]);

  const startPinging = useCallback(async () => {
    if (!user || !selectedEventId) return;
    setGeoError(null);

    // Check if geolocation is available
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    // Send the first ping immediately
    await sendPing();

    // Then set up interval for every 60 seconds
    setIsPinging(true);
    pingIntervalRef.current = setInterval(sendPing, 60000);
    toast.success('Live attendance tracking started!');
  }, [user, selectedEventId, sendPing]);

  const stopPinging = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    setIsPinging(false);
    // Fetch final attendance
    fetchAttendance();
    toast.info('Attendance tracking stopped');
  }, [fetchAttendance]);

  useEffect(() => {
    if (selectedEventId) {
      fetchEventById(selectedEventId);
    }
  }, [selectedEventId, fetchEventById]);

  const fetchTeams = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const res = await fetch(`/api/events/${selectedEventId}/teams${user ? `?userId=${user.id}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
        setUserTeam(data.userTeam || null);
      }
    } catch { /* ignore */ }
  }, [selectedEventId, user]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedEventId) return;
      const res = await fetch(`/api/events/${selectedEventId}${user ? `?userId=${user.id}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setUserReg(data.userRegistration);

        // Check scoring/results permissions for competition events
        if (user && data.event?.eventType === 'COMPETITION') {
          const isPrivileged = user.role === 'ADMIN' || user.role === 'FACULTY' || user.role === 'HOD' || data.event.organizerId === user.id;
          try {
            const assignmentsRes = await fetch(`/api/events/${selectedEventId}/roles/assign?userId=${user.id}`);
            if (assignmentsRes.ok) {
              const roleData = await assignmentsRes.json();
              const permissions = new Set<string>();
              for (const a of (roleData.assignments || [])) {
                try {
                  const perms: string[] = JSON.parse(a.role?.permissions || '[]');
                  perms.forEach(p => permissions.add(p));
                } catch { /* ignore */ }
              }
              setCanScore(isPrivileged || permissions.has('SCORE_PARTICIPANTS'));
              setCanViewResults(isPrivileged || permissions.has('VIEW_RESULTS'));
            } else {
              setCanScore(isPrivileged);
              setCanViewResults(isPrivileged);
            }
          } catch {
            setCanScore(isPrivileged);
            setCanViewResults(isPrivileged);
          }

          // Fetch teams data for competition events
          fetchTeams();
        }

        // Fetch attendance for LIVE events with geo-fence (student view)
        if (user?.role === 'STUDENT' && data.event?.status === 'LIVE' && data.event?.venueLat && data.event?.geoFenceRadius && data.userRegistration) {
          fetchAttendance();
        }
      }
    };
    loadDetail();
  }, [selectedEventId, user, fetchTeams, fetchAttendance]);

  const handleRegister = async () => {
    if (!user) return;
    setRegistering(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success('Registered successfully! 🎉');
      fetchEventById(selectedEventId!);
      const detailRes = await fetch(`/api/events/${selectedEventId}?userId=${user.id}`);
      if (detailRes.ok) { const d = await detailRes.json(); setUserReg(d.userRegistration); }
    } catch { toast.error('Registration failed'); }
    setRegistering(false);
  };

  const handleCancel = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/events/${selectedEventId}/register?userId=${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success('Registration cancelled');
      fetchEventById(selectedEventId!);
      setUserReg(null);
    } catch { toast.error('Failed to cancel'); }
  };

  const handleApprove = async (action: 'approve' | 'reject') => {
    if (!user) return;
    try {
      const res = await fetch(`/api/events/${selectedEventId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(action === 'approve' ? 'Event approved! ✅' : 'Event rejected');
      fetchEventById(selectedEventId!);
    } catch { toast.error('Action failed'); }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: currentEvent?.title, text: currentEvent?.description, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleDeleteEvent = async () => {
    if (!user || !selectedEventId) return;
    try {
      const res = await fetch(`/api/events/${selectedEventId}?userId=${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success('Event deleted successfully');
      navigate(previousView || 'feed');
    } catch { toast.error('Failed to delete event'); }
  };

  const handleCreateTeam = async () => {
    if (!user || !selectedEventId) return;
    if (!teamName.trim()) { toast.error('Please enter a team name'); return; }
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'create', teamName: teamName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); setTeamLoading(false); return; }
      toast.success('Team created! Share the code with teammates 🎉');
      setShowCreateTeamDialog(false);
      setTeamName('');
      fetchTeams();
      fetchEventById(selectedEventId);
      const detailRes = await fetch(`/api/events/${selectedEventId}?userId=${user.id}`);
      if (detailRes.ok) { const d = await detailRes.json(); setUserReg(d.userRegistration); }
    } catch { toast.error('Failed to create team'); }
    setTeamLoading(false);
  };

  const handleJoinTeam = async () => {
    if (!user || !selectedEventId) return;
    if (!joinCode.trim()) { toast.error('Please enter a team code'); return; }
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'join', teamCode: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); setTeamLoading(false); return; }
      toast.success('Joined team successfully! 🎉');
      setShowJoinTeamDialog(false);
      setJoinCode('');
      fetchTeams();
      fetchEventById(selectedEventId);
      const detailRes = await fetch(`/api/events/${selectedEventId}?userId=${user.id}`);
      if (detailRes.ok) { const d = await detailRes.json(); setUserReg(d.userRegistration); }
    } catch { toast.error('Failed to join team'); }
    setTeamLoading(false);
  };

  const handleJoinTeamById = async (teamId: string) => {
    if (!user || !selectedEventId) return;
    setTeamLoading(true);
    try {
      // Find the team to get its code
      const team = teams.find((t: any) => t.id === teamId);
      if (!team) { toast.error('Team not found'); setTeamLoading(false); return; }
      const res = await fetch(`/api/events/${selectedEventId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'join', teamCode: team.teamCode }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); setTeamLoading(false); return; }
      toast.success('Joined team successfully! 🎉');
      fetchTeams();
      fetchEventById(selectedEventId);
      const detailRes = await fetch(`/api/events/${selectedEventId}?userId=${user.id}`);
      if (detailRes.ok) { const d = await detailRes.json(); setUserReg(d.userRegistration); }
    } catch { toast.error('Failed to join team'); }
    setTeamLoading(false);
  };

  const handleLeaveTeam = async () => {
    if (!user || !selectedEventId) return;
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/teams?userId=${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); setTeamLoading(false); return; }
      toast.success(data.message || 'Left team successfully');
      fetchTeams();
      fetchEventById(selectedEventId);
      setUserReg(null);
      const detailRes = await fetch(`/api/events/${selectedEventId}?userId=${user.id}`);
      if (detailRes.ok) { const d = await detailRes.json(); setUserReg(d.userRegistration); }
    } catch { toast.error('Failed to leave team'); }
    setTeamLoading(false);
  };

  const copyTeamCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Team code copied!');
  };

  const generatePDF = async () => {
    if (!currentEvent) return;
    setGeneratingPDF(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/report`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error('Failed to generate report'); return; }

      const doc = new jsPDF();
      // Header
      doc.setFillColor(55, 48, 163);
      doc.rect(0, 0, 210, 35, 'F');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text('NexEvent - Event Report', 14, 22);
      doc.setFontSize(10);
      doc.text('VVCE Campus Innovation 2026', 14, 30);

      // Event info
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(16);
      doc.text(data.event.title, 14, 48);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Venue: ${data.event.venue}  |  Date: ${new Date(data.event.startDate).toLocaleDateString('en-IN')}  |  Category: ${data.event.category}`, 14, 56);

      // Summary box
      doc.setFillColor(245, 245, 255);
      doc.roundedRect(14, 62, 182, 30, 3, 3, 'F');
      doc.setFontSize(11);
      doc.setTextColor(55, 48, 163);
      doc.text('Attendance Summary', 20, 72);
      doc.setFontSize(9);
      doc.setTextColor(60);
      doc.text(`Total Registered: ${data.stats.totalRegistered}    Present: ${data.stats.totalPresent}    Absent: ${data.stats.totalAbsent}    Rate: ${data.stats.attendanceRate}%`, 20, 82);

      // Table
      if (data.attendees && data.attendees.length > 0) {
        autoTable(doc, {
          startY: 100,
          head: [['#', 'Name', 'USN', 'Department', 'Status', 'Check-in Time']],
          body: data.attendees.map((a: any, i: number) => [
            i + 1, a.name, a.usn || '-', a.department || '-',
            a.status, a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString('en-IN') : '-'
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [55, 48, 163], textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [245, 245, 255] },
        });
      }

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Generated by NexEvent | VVCE Campus Innovation 2026 | Team Jungly Billi', 14, doc.internal.pageSize.height - 10);

      doc.save(`${data.event.title.replace(/\s+/g, '_')}_Report.pdf`);
      toast.success('PDF report downloaded! 📄');
    } catch { toast.error('PDF generation failed'); }
    setGeneratingPDF(false);
  };

  if (isLoading || !currentEvent) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading event details...</p>
        </div>
      </div>
    );
  }

  const event = currentEvent as any;
  const isOrganizer = user && (event.organizerId === user.id || user.role === 'ADMIN');
  const isFaculty = user && (user.role === 'FACULTY' || user.role === 'ADMIN');
  const canRegister = isAuthenticated && ['APPROVED', 'LIVE'].includes(event.status) && !userReg;
  const regCount = event._count?.registrations || event.registrations?.length || 0;
  const maxP = event.maxParticipants;
  const regPercent = maxP ? Math.min((regCount / maxP) * 100, 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4"
      >
        <button onClick={() => navigate(previousView || 'feed')} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> {previousView === 'my-events' ? 'My Events' : previousView === 'dashboard' ? 'Dashboard' : previousView === 'admin' ? 'Admin' : 'Events'}
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{event.title}</span>
      </motion.div>

      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative rounded-2xl overflow-hidden mb-6 p-6 sm:p-8 bg-gradient-to-br ${categoryColors[event.category] || categoryColors.OTHER}`}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 dot-pattern opacity-10" />
        {/* Floating emoji */}
        <motion.div
          className="absolute top-4 right-4 text-5xl opacity-20"
          animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
        >
          {categoryIcons[event.category] || '📌'}
        </motion.div>
        <motion.div
          className="absolute bottom-4 left-4 text-3xl opacity-10"
          animate={{ y: [0, 10, 0], rotate: [0, -5, 5, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 1 }}
        >
          {categoryIcons[event.category] || '📌'}
        </motion.div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge className="text-xs bg-white/20 text-white border-white/30 backdrop-blur-sm">
              {event.status === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-white mr-1 animate-pulse" />}
              {event.status}
            </Badge>
            <Badge variant="outline" className="text-xs border-white/30 text-white/80">{event.category}</Badge>
            {event.eventType === 'COMPETITION' && (
              <Badge className="text-xs bg-white/20 text-white border-white/30 backdrop-blur-sm">
                <Swords className="w-2.5 h-2.5 mr-1" /> Competition
              </Badge>
            )}
            {event.status === 'LIVE' || event.status === 'APPROVED' ? (
              <Badge className="text-xs bg-white/10 text-white/70 border-white/20 backdrop-blur-sm">
                <Timer className="w-2.5 h-2.5 mr-1" /> {getTimeUntil(event.startDate, event.endDate)}
              </Badge>
            ) : null}
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">{event.title}</h1>
          {event.club && (
            <p className="text-white/70 text-sm mt-2 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> Organized by {event.club.name}
            </p>
          )}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Cards Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-3"
          >
            <Card className="bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Venue</p>
                  <p className="text-sm font-medium truncate">{event.venue}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-chart-2/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">{formatDate(event.startDate)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="text-sm font-medium">{formatTime(event.startDate)} — {formatTime(event.endDate)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-chart-3" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Registered</p>
                  <p className="text-sm font-medium">{regCount}{maxP ? ` / ${maxP}` : ''}</p>
                </div>
              </CardContent>
            </Card>
            {/* AICTE Points Card */}
            {(event.aictePoints > 0 || event.volunteerAictePoints > 0) && (
              <Card className="bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">AICTE Points</p>
                    <p className="text-sm font-medium">
                      {event.aictePoints || 0} participation
                      {event.volunteerAictePoints ? ` • ${event.volunteerAictePoints} volunteer` : ''}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Registration Progress */}
          {maxP && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Registration Progress</span>
                    <span className="text-xs text-muted-foreground">{regCount} / {maxP} spots</span>
                  </div>
                  <Progress value={regPercent} className="h-2.5" />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {regPercent >= 90 ? '🔥 Almost full!' : regPercent >= 50 ? '📈 Filling up fast' : '✨ Spots available'}
                    </span>
                    <span className="text-xs font-medium">{Math.round(regPercent)}%</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> About This Event
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{event.description}</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Tags */}
          {event.tags && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex flex-wrap gap-2"
            >
              {event.tags.split(',').filter(Boolean).map((tag: string, i: number) => (
                <motion.div
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  whileHover={{ scale: 1.1, y: -2 }}
                >
                  <Badge variant="secondary" className="text-xs cursor-default">
                    <Tag className="w-3 h-3 mr-1" />{tag.trim()}
                  </Badge>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Live Attendance Tracking - Students only for LIVE events with geo-fence */}
          {user?.role === 'STUDENT' && event.status === 'LIVE' && userReg && event.venueLat && event.venueLng && event.geoFenceRadius && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
              <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="relative">
                      <Radio className="w-4 h-4 text-emerald-600" />
                      {isPinging && (
                        <motion.span
                          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500"
                          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      )}
                    </div>
                    Live Attendance Tracking
                    {isPinging && (
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 animate-pulse">
                        Active
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Attendance percentage display */}
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 shrink-0">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
                        <motion.circle
                          cx="40" cy="40" r="35" fill="none" strokeWidth="6" strokeLinecap="round"
                          className={attendancePct >= 75 ? 'text-emerald-500' : attendancePct >= 50 ? 'text-amber-500' : 'text-rose-500'}
                          stroke="currentColor"
                          strokeDasharray={`${2 * Math.PI * 35}`}
                          strokeDashoffset={2 * Math.PI * 35 * (1 - attendancePct / 100)}
                          initial={{ strokeDashoffset: 2 * Math.PI * 35 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 35 * (1 - attendancePct / 100) }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-bold">{Math.round(attendancePct)}%</span>
                      </div>
                    </div>
                    <div className="space-y-2 flex-1">
                      <div>
                        <p className="text-xs text-muted-foreground">Attendance</p>
                        <p className="text-sm font-medium">
                          {attendancePct >= 75 ? 'Great attendance!' : attendancePct >= 50 ? 'Decent attendance' : 'Low attendance - stay within venue'}
                        </p>
                      </div>
                      {/* Geo-fence status */}
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${withinFence === true ? 'bg-emerald-500' : withinFence === false ? 'bg-rose-500' : 'bg-gray-300'}`} />
                        <span className="text-xs font-medium">
                          {withinFence === true ? 'Inside geo-fence' : withinFence === false ? 'Outside geo-fence' : 'Not checked yet'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ping stats */}
                  {pingCount > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2.5 rounded-lg bg-background/80 border border-border/50 text-center">
                        <p className="text-lg font-bold text-emerald-600">{pingCount}</p>
                        <p className="text-[10px] text-muted-foreground">Pings Sent</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-background/80 border border-border/50 text-center">
                        <p className="text-sm font-medium">{lastPingTime || '--'}</p>
                        <p className="text-[10px] text-muted-foreground">Last Ping</p>
                      </div>
                    </div>
                  )}

                  {/* Pinging indicator */}
                  {isPinging && (
                    <motion.div
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-100/50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Navigation className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                      <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                        Tracking location — next ping in ~60s
                      </span>
                    </motion.div>
                  )}

                  {/* Error message */}
                  {geoError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-rose-700 dark:text-rose-300">{geoError}</span>
                    </motion.div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    {!isPinging ? (
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={startPinging}
                      >
                        <Navigation className="w-4 h-4 mr-2" /> Start Check-in Pings
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="flex-1 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                        onClick={stopPinging}
                      >
                        <Pause className="w-4 h-4 mr-2" /> Stop Pings
                      </Button>
                    )}
                  </div>

                  {/* Info text */}
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <p>• Location pings are sent every 60 seconds while active</p>
                    <p>• Attendance % = pings within venue ÷ total pings</p>
                    <p>• Geo-fence radius: {event.geoFenceRadius}m from venue center</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Competition Config */}
          {event.eventType === 'COMPETITION' && event.competitionConfig && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Swords className="w-4 h-4 text-primary" /> Competition Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center p-3 rounded-xl bg-background">
                      <UsersRound className="w-4 h-4 text-primary mx-auto mb-1" />
                      <p className="text-lg font-bold">{event.competitionConfig.teamMinSize}-{event.competitionConfig.teamMaxSize}</p>
                      <p className="text-[10px] text-muted-foreground">Team Size</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-background">
                      <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                      <p className="text-lg font-bold">{event.competitionConfig.maxTeams || '∞'}</p>
                      <p className="text-[10px] text-muted-foreground">Max Teams</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-background">
                      <Target className="w-4 h-4 text-chart-2 mx-auto mb-1" />
                      <p className="text-lg font-bold text-xs">{event.competitionConfig.scoringType}</p>
                      <p className="text-[10px] text-muted-foreground">Scoring</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-background">
                      <Users className="w-4 h-4 text-chart-4 mx-auto mb-1" />
                      <p className="text-lg font-bold">{event.competitionConfig.allowIndividual ? 'Yes' : 'No'}</p>
                      <p className="text-[10px] text-muted-foreground">Individuals</p>
                    </div>
                  </div>

                  {/* Rounds */}
                  {event.competitionConfig.rounds && event.competitionConfig.rounds.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-primary" /> Rounds</p>
                      {event.competitionConfig.rounds.map((round: any, ri: number) => {
                        const criteria: { name: string; maxScore: number; weight: number }[] = (() => { try { return JSON.parse(round.criteria || '[]'); } catch { return []; } })();
                        return (
                          <div key={round.id} className="p-3 rounded-lg border border-border/50 bg-background">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{ri + 1}</span>
                                <span className="text-sm font-medium">{round.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">Max: {round.maxScore}</Badge>
                                <Badge variant="outline" className="text-[10px]">Weight: {round.weight}x</Badge>
                                {round.isElimination && <Badge className="text-[10px] bg-rose-100 text-rose-700">Elimination</Badge>}
                              </div>
                            </div>
                            {round.description && <p className="text-xs text-muted-foreground ml-8">{round.description}</p>}
                            {round.isElimination && round.advanceCount && (
                              <p className="text-[10px] text-rose-600 ml-8 mt-1">Top {round.advanceCount} teams advance</p>
                            )}
                            {criteria.length > 0 && (
                              <div className="ml-8 mt-2 flex flex-wrap gap-1.5">
                                {criteria.map((c: any, ci: number) => (
                                  <Badge key={ci} variant="secondary" className="text-[9px]">
                                    <Target className="w-2.5 h-2.5 mr-0.5" />{c.name}: {c.maxScore}pts
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Team Registration Section - Only for competition events */}
          {event.eventType === 'COMPETITION' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.29 }}>
              <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UsersRound className="w-4 h-4 text-emerald-600" /> Team Registration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* User's current team */}
                  {userTeam ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-emerald-600" />
                          <h4 className="font-semibold text-emerald-800 dark:text-emerald-200">{userTeam.name}</h4>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                          Your Team
                        </Badge>
                      </div>

                      {/* Team code */}
                      <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-background border border-border/50">
                        <Hash className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-mono font-bold tracking-wider">{userTeam.teamCode}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-7 px-2"
                          onClick={() => copyTeamCode(userTeam.teamCode)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-3">Share this code with teammates so they can join!</p>

                      {/* Members list */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Members ({userTeam.members?.length || 0}/{event.competitionConfig?.teamMaxSize || 5})
                        </p>
                        {userTeam.members?.map((m: any) => (
                          <div key={m.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-background/80">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                              {(m.user?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                            </div>
                            <span className="text-sm font-medium flex-1">{m.user?.name || 'Unknown'}</span>
                            {m.userId === userTeam.leaderId && (
                              <Badge className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                Leader
                              </Badge>
                            )}
                            {m.userId === user?.id && (
                              <Badge variant="outline" className="text-[9px]">You</Badge>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Leave team button */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-3 text-destructive hover:text-destructive hover:bg-destructive/5"
                            disabled={teamLoading}
                          >
                            {teamLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <LogOut className="w-3 h-3 mr-1" />}
                            {userTeam.leaderId === user?.id ? 'Disband Team' : 'Leave Team'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-destructive" />
                              {userTeam.leaderId === user?.id ? 'Disband Team' : 'Leave Team'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {userTeam.leaderId === user?.id
                                ? 'Are you sure you want to disband this team? All members will be removed and this action cannot be undone.'
                                : 'Are you sure you want to leave this team?'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={handleLeaveTeam}
                            >
                              {userTeam.leaderId === user?.id ? 'Disband' : 'Leave'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </motion.div>
                  ) : (
                    /* No team yet - show action buttons */
                    <div className="space-y-3">
                      {isAuthenticated && ['APPROVED', 'LIVE'].includes(event.status) ? (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <Button
                              className="h-auto py-3 flex flex-col items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => setShowCreateTeamDialog(true)}
                            >
                              <Trophy className="w-5 h-5" />
                              <span className="text-xs font-semibold">Form a Team</span>
                            </Button>
                            <Button
                              variant="outline"
                              className="h-auto py-3 flex flex-col items-center gap-1.5 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              onClick={() => setShowJoinTeamDialog(true)}
                            >
                              <UserPlus className="w-5 h-5" />
                              <span className="text-xs font-semibold">Join a Team</span>
                            </Button>
                          </div>
                          {event.competitionConfig?.allowIndividual && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-[10px] text-muted-foreground">or register individually</span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}
                        </>
                      ) : !isAuthenticated ? (
                        <div className="text-center py-2">
                          <p className="text-sm text-muted-foreground mb-2">Sign in to join or form a team</p>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => useUIStore.getState().showLogin()}>
                            Sign In
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-center text-muted-foreground py-2">
                          Team registration not available
                        </p>
                      )}

                      {/* Available teams list */}
                      {teams.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <UsersRound className="w-3 h-3" /> Registered Teams ({teams.length}{event.competitionConfig?.maxTeams ? ` / ${event.competitionConfig.maxTeams}` : ''})
                          </p>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {teams.map((team: any, i: number) => {
                              const maxTeamSize = event.competitionConfig?.teamMaxSize || 5;
                              const memberCount = team.members?.length || 0;
                              const isFull = memberCount >= maxTeamSize;
                              const isUserTeam = userTeam?.id === team.id;
                              return (
                                <motion.div
                                  key={team.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.05 }}
                                  className={`p-2.5 rounded-lg border flex items-center justify-between ${
                                    isUserTeam
                                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20'
                                      : 'border-border/50 bg-background'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm font-medium truncate">{team.name}</p>
                                      <Badge variant={team.status === 'WINNER' ? 'default' : 'outline'} className="text-[9px] shrink-0">
                                        {team.status}
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      Leader: {team.leader?.name || 'Unknown'} • {memberCount}/{maxTeamSize} members
                                    </p>
                                  </div>
                                  {!isUserTeam && isAuthenticated && !userTeam && ['APPROVED', 'LIVE'].includes(event.status) && (
                                    <Button
                                      size="sm"
                                      variant={isFull ? 'ghost' : 'outline'}
                                      className={`ml-2 h-7 text-[10px] shrink-0 ${
                                        !isFull ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' : 'text-muted-foreground'
                                      }`}
                                      disabled={isFull || teamLoading}
                                      onClick={() => handleJoinTeamById(team.id)}
                                    >
                                      {teamLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : isFull ? 'Full' : 'Join'}
                                    </Button>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Event Roles */}
          {event.eventRoles && event.eventRoles.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" /> Event Roles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {event.eventRoles.map((role: any) => (
                      <div key={role.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/30">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color || '#6366f1' }} />
                        <div>
                          <p className="text-xs font-medium">{role.name}</p>
                          {role.description && <p className="text-[10px] text-muted-foreground">{role.description}</p>}
                        </div>
                        {role.assignments && role.assignments.length > 0 && (
                          <div className="flex -space-x-1 ml-1">
                            {role.assignments.map((a: any) => (
                              <div key={a.id} className="w-6 h-6 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[8px] font-semibold text-primary" title={a.user?.name}>
                                {(a.user?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </div>
                            ))}
                          </div>
                        )}
                        {role.maxAssignees && (
                          <Badge variant="outline" className="text-[9px]">{role.assignments?.length || 0}/{role.maxAssignees}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Registration list for organizer */}
          {isOrganizer && event.registrations && event.registrations.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Registrations ({event.registrations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {event.registrations.map((r: any, i: number) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${
                          i % 2 === 0 ? 'bg-muted/20' : 'bg-muted/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                            {(r.user?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="font-medium">{r.user?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                          {r.attendance && (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> In
                              {r.attendance.attendancePercentage > 0 && (
                                <span className="ml-1">{Math.round(r.attendance.attendancePercentage)}%</span>
                              )}
                            </Badge>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Approval section for faculty */}
          {isFaculty && event.status === 'PENDING_APPROVAL' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <Timer className="w-4 h-4" /> Pending Your Approval
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Review this event and approve or reject it. The organizer will be notified.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={() => handleApprove('approve')} className="bg-emerald-600 hover:bg-emerald-700 flex-1">
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Event
                    </Button>
                    <Button variant="destructive" onClick={() => handleApprove('reject')} className="flex-1">
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Registration card */}
          <Card className="sticky top-20 border-primary/10 shadow-lg shadow-primary/5">
            <CardContent className="p-5 space-y-4">
              {userReg ? (
                <div className="text-center space-y-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
                  </motion.div>
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300 text-lg">You&apos;re Registered!</p>
                    <Badge variant="outline" className="text-xs mt-1">{userReg.status}</Badge>
                  </div>
                  {userReg.qrCode && (
                    <div>
                      <Button variant="outline" size="sm" className="w-full mb-2"
                        onClick={() => setShowQR(!showQR)}>
                        <QrCode className="w-3 h-3 mr-1" /> {showQR ? 'Hide' : 'Show'} QR Code
                      </Button>
                      <AnimatePresence>
                        {showQR && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, scale: 0.8 }}
                            animate={{ opacity: 1, height: 'auto', scale: 1 }}
                            exit={{ opacity: 0, height: 0, scale: 0.8 }}
                            transition={{ type: 'spring', stiffness: 200 }}
                            className="flex flex-col items-center p-4 bg-white rounded-xl shadow-inner"
                          >
                            <QRCodeSVG value={userReg.qrCode} size={160} />
                            <p className="text-[10px] text-gray-500 mt-3">Scan at venue to check in</p>
                            <p className="text-[9px] text-gray-400">Geo-fencing may apply</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive hover:bg-destructive/5"
                    onClick={handleCancel}>
                    Cancel Registration
                  </Button>
                </div>
              ) : canRegister ? (
                <div className="space-y-3">
                  <Button
                    className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 relative overflow-hidden group"
                    onClick={handleRegister}
                    disabled={registering}
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                      Register Now
                    </span>
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  </Button>
                  {maxP && (
                    <p className="text-xs text-center text-muted-foreground">
                      {maxP - regCount > 0 ? `${maxP - regCount} spots remaining` : 'Waitlist only'}
                    </p>
                  )}
                </div>
              ) : !isAuthenticated ? (
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Sign in to register for this event</p>
                  <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => useUIStore.getState().showLogin()}>
                    Sign In
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-center text-muted-foreground py-4">
                  {event.status === 'COMPLETED' ? '🏁 Event has ended' : event.status === 'PENDING_APPROVAL' ? '⏳ Event pending approval' : 'Registration not available'}
                </p>
              )}

              <Separator />

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={handleShare}>
                  <Share2 className="w-3 h-3 mr-1" /> Share
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => setLiked(!liked)}>
                  <Heart className={`w-3 h-3 mr-1 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
                  {liked ? 'Saved' : 'Save'}
                </Button>
              </div>

              <Separator />

              {/* Organizer info */}
              {event.organizer && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Organized by</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {event.organizer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{event.organizer.name}</p>
                      {event.club && <p className="text-xs text-muted-foreground">{event.club.name}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Competition Actions */}
              {event.eventType === 'COMPETITION' && (canScore || canViewResults) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    {canScore && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => navigate('judge-scoring', selectedEventId!)}
                      >
                        <ClipboardCheck className="w-3 h-3 mr-1" /> Score Participants
                      </Button>
                    )}
                    {canViewResults && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => navigate('results', selectedEventId!)}
                      >
                        <BarChart3 className="w-3 h-3 mr-1" /> View Results
                      </Button>
                    )}
                  </div>
                </>
              )}

              {/* Manage Certificates - visible to organizer/admin/faculty/HOD */}
              {user && (isOrganizer || user.role === 'FACULTY' || user.role === 'HOD') && (
                <>
                  <Separator />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate('certificates', selectedEventId!)}
                  >
                    <Award className="w-3 h-3 mr-1" /> Manage Certificates
                  </Button>
                </>
              )}

              {isOrganizer && (
                <>
                  <Separator />
                  <Button variant="outline" size="sm" className="w-full" onClick={generatePDF} disabled={generatingPDF}>
                    {generatingPDF ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                    ) : (
                      <><Download className="w-3 h-3 mr-1" /> Generate PDF Report</>
                    )}
                  </Button>
                  {event.status !== 'COMPLETED' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive hover:bg-destructive/5">
                          <Trash2 className="w-3 h-3 mr-1" /> Delete Event
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                            Delete Event
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this event? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDeleteEvent}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Geo-fence info */}
          {event.geoFenceRadius && (
            <Card className="bg-chart-2/5 border-chart-2/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs mb-2">
                  <MapPin className="w-4 h-4 text-chart-2" />
                  <div>
                    <p className="font-medium">Geo-fenced Event</p>
                    <p className="text-muted-foreground">Must be within {event.geoFenceRadius}m of venue for check-in</p>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-0.5 mt-2 pt-2 border-t border-border/30">
                  <p>• Attendance tracked via periodic location pings</p>
                  <p>• Attendance % = time spent within fence ÷ event duration</p>
                  <p>• Location pings are logged in real-time during the event</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Team Dialog */}
      <Dialog open={showCreateTeamDialog} onOpenChange={setShowCreateTeamDialog}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-emerald-600" /> Form a Team
            </DialogTitle>
            <DialogDescription>
              Create a new team for {event?.title}. A unique team code will be generated for your teammates to join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Team Name</label>
              <Input
                placeholder="e.g., Code Warriors, Team Phoenix"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
                maxLength={50}
              />
              <p className="text-[10px] text-muted-foreground">
                Team size: {event?.competitionConfig?.teamMinSize || 1}-{event?.competitionConfig?.teamMaxSize || 5} members
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-1">What happens next?</p>
              <ul className="text-[10px] text-muted-foreground space-y-0.5">
                <li>• A unique 6-character team code will be auto-generated</li>
                <li>• You will be the team leader</li>
                <li>• Share the code with teammates so they can join</li>
                <li>• You will be automatically registered for the event</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateTeamDialog(false); setTeamName(''); }}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleCreateTeam}
              disabled={teamLoading || !teamName.trim()}
            >
              {teamLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trophy className="w-4 h-4 mr-1" />}
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Team Dialog */}
      <Dialog open={showJoinTeamDialog} onOpenChange={setShowJoinTeamDialog}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" /> Join a Team
            </DialogTitle>
            <DialogDescription>
              Enter the team code shared by the team leader to join their team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Team Code</label>
              <Input
                placeholder="e.g., ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinTeam()}
                maxLength={6}
                className="font-mono text-lg tracking-widest text-center uppercase"
              />
              <p className="text-[10px] text-muted-foreground">
                Ask the team leader for the 6-character code
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-1">Good to know</p>
              <ul className="text-[10px] text-muted-foreground space-y-0.5">
                <li>• You will be automatically registered for the event</li>
                <li>• Team code is case-insensitive</li>
                <li>• You can only be on one team per competition</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowJoinTeamDialog(false); setJoinCode(''); }}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleJoinTeam}
              disabled={teamLoading || !joinCode.trim()}
            >
              {teamLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
              Join Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
