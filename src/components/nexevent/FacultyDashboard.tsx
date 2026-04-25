'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  Crown, Calendar, Users, QrCode, Eye, ScanLine,
  ArrowUpRight, Sparkles, Building2, BookOpen, Shield,
  CheckCircle2, Clock, MapPin, Activity, Zap, PlusCircle,
  Loader2, X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

interface ClubInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  facultyAdvisorId: string | null;
  facultyAdvisor: { id: string; name: string; email: string } | null;
  members: { id: string; userId: string; role: string; user: { id: string; name: string } }[];
  _count: { members: number; events: number };
}

interface EventInfo {
  id: string;
  title: string;
  venue: string;
  startDate: string;
  endDate: string;
  category: string;
  status: string;
  eventType: string;
  maxParticipants: number | null;
  organizer: { id: string; name: string };
  club: { id: string; name: string } | null;
  _count: { registrations: number };
}

interface CheckInRecord {
  id: string;
  status: string;
  checkInTime: string;
  user: { id: string; name: string; email: string };
  event: { id: string; title: string };
}

interface ProfileData {
  department: { id: string; name: string; code: string } | null;
}

// ============================================================
// Color Maps
// ============================================================

const categoryColors: Record<string, string> = {
  TECHNICAL: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  CULTURAL: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  SPORTS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  WORKSHOP: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  SEMINAR: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  HACKATHON: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  SOCIAL: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  OTHER: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const eventStatusColors: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  LIVE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  COMPLETED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

// ============================================================
// Main Component
// ============================================================

export function FacultyDashboard() {
  const { user } = useAuthStore();
  const { navigate } = useUIStore();

  const [clubs, setClubs] = useState<ClubInfo[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckInRecord[]>([]);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // QR Code dialog state
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrEventId, setQrEventId] = useState<string | null>(null);
  const [qrEventTitle, setQrEventTitle] = useState('');

  // ============================================================
  // Data Loading
  // ============================================================

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const [clubsRes, eventsRes, profileRes] = await Promise.all([
          fetch('/api/clubs'),
          fetch(`/api/events?userId=${user.id}&status=ALL&limit=50`),
          fetch(`/api/users/me?userId=${user.id}`),
        ]);

        if (cancelled) return;

        if (clubsRes.ok) {
          const d = await clubsRes.json();
          if (!cancelled) setClubs(d.clubs || []);
        }
        if (eventsRes.ok) {
          const d = await eventsRes.json();
          if (!cancelled) {
            const myEvents = (d.events || []).filter(
              (e: EventInfo) => e.organizer?.id === user.id
            );
            setEvents(myEvents);
          }
        }
        if (profileRes.ok) {
          const d = await profileRes.json();
          if (!cancelled) setProfileData(d.user || d);
        }
      } catch (err) {
        console.error('FacultyDashboard load error:', err);
      }
      if (!cancelled) setIsLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [user]);

  // Load recent check-ins across events
  useEffect(() => {
    if (!user || events.length === 0) return;
    let cancelled = false;

    const loadCheckIns = async () => {
      const allCheckIns: CheckInRecord[] = [];
      const eventsToCheck = events.filter(e =>
        ['LIVE', 'APPROVED', 'COMPLETED'].includes(e.status)
      ).slice(0, 5);

      for (const event of eventsToCheck) {
        try {
          const res = await fetch(`/api/events/${event.id}/attendance?recent=5`);
          if (res.ok) {
            const d = await res.json();
            const records = (d.attendance || d.records || []).map((r: any) => ({
              id: r.id,
              status: r.status,
              checkInTime: r.checkInTime,
              user: r.user || { id: r.userId, name: r.userName || 'Unknown', email: '' },
              event: { id: event.id, title: event.title },
            }));
            allCheckIns.push(...records);
          }
        } catch {
          // silently handle
        }
      }

      if (!cancelled) {
        allCheckIns.sort(
          (a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
        );
        setRecentCheckIns(allCheckIns.slice(0, 10));
      }
    };

    loadCheckIns();
    return () => { cancelled = true; };
  }, [user, events]);

  // ============================================================
  // Computed Values
  // ============================================================

  const myClubs = useMemo(() => {
    if (!user) return [];
    return clubs.filter(c =>
      c.facultyAdvisorId === user.id ||
      c.members?.some(m => m.userId === user.id)
    );
  }, [clubs, user]);

  const clubsAsAdvisor = useMemo(
    () => myClubs.filter(c => c.facultyAdvisorId === user?.id),
    [myClubs, user]
  );

  const totalRegistrations = useMemo(
    () => events.reduce((sum, e) => sum + (e._count?.registrations || 0), 0),
    [events]
  );

  const totalCheckIns = useMemo(
    () => recentCheckIns.filter(c => c.status === 'PRESENT' || c.status === 'CHECKED_IN').length,
    [recentCheckIns]
  );

  // ============================================================
  // QR Code Management
  // ============================================================

  const handleOpenQR = (eventId: string, eventTitle: string) => {
    setQrEventId(eventId);
    setQrEventTitle(eventTitle);
    setQrDialogOpen(true);
  };

  // ============================================================
  // Loading State
  // ============================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-8 h-8 text-violet-500 mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading Faculty Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ============================================================
  // Animation Variants
  // ============================================================

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 200, damping: 20 },
    },
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <motion.div
      className="max-w-6xl mx-auto px-4 py-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ============================================================ */}
      {/* HEADER - Gradient Banner */}
      {/* ============================================================ */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="relative bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 dark:from-violet-800 dark:via-purple-800 dark:to-violet-900">
            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-white/10"
                  style={{
                    width: 8 + i * 6,
                    height: 8 + i * 6,
                    left: `${12 + i * 15}%`,
                    top: `${18 + (i % 3) * 26}%`,
                  }}
                  animate={{
                    y: [0, -14, 0],
                    opacity: [0.2, 0.5, 0.2],
                  }}
                  transition={{
                    duration: 3 + i * 0.4,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </div>

            <div className="relative p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">
                      Welcome, {user.name?.split(' ')[0]}!
                    </h1>
                    <Badge className="bg-white/20 text-white border-white/30 text-xs backdrop-blur-sm">
                      <Crown className="w-3 h-3 mr-1" /> Faculty
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-sm text-white/80">
                    {profileData?.department && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" />{' '}
                        {typeof profileData.department === 'string'
                          ? profileData.department
                          : profileData.department.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" /> {user.role}
                    </span>
                    {user.email && (
                      <span className="flex items-center gap-1 text-white/60 text-xs">
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('create-event')}
                    className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm"
                  >
                    <PlusCircle className="w-4 h-4 mr-1.5" /> New Event
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('scan-qr')}
                    className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm"
                  >
                    <ScanLine className="w-4 h-4 mr-1.5" /> Scan QR
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ============================================================ */}
      {/* STATS CARDS - 4 card grid */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          {
            label: 'Clubs Managed',
            value: clubsAsAdvisor.length,
            icon: Crown,
            color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
            gradient: 'from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10',
            sub: `${myClubs.length - clubsAsAdvisor.length} other membership${myClubs.length - clubsAsAdvisor.length !== 1 ? 's' : ''}`,
          },
          {
            label: 'Events Created',
            value: events.length,
            icon: Calendar,
            color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30',
            gradient: 'from-violet-50 to-violet-100/50 dark:from-violet-950/20 dark:to-violet-900/10',
            sub: `${events.filter(e => ['LIVE', 'APPROVED'].includes(e.status)).length} currently active`,
          },
          {
            label: 'Total Registrations',
            value: totalRegistrations,
            icon: Users,
            color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
            gradient: 'from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10',
            sub: `Across ${events.length} event${events.length !== 1 ? 's' : ''}`,
          },
          {
            label: 'Check-ins Scanned',
            value: totalCheckIns,
            icon: QrCode,
            color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30',
            gradient: 'from-rose-50 to-rose-100/50 dark:from-rose-950/20 dark:to-rose-900/10',
            sub: 'Recent check-in records',
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            variants={itemVariants}
            whileHover={{ y: -4, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <Card
              className={`h-full bg-gradient-to-br ${stat.gradient} border-0 shadow-sm hover:shadow-md transition-shadow`}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${stat.color} flex items-center justify-center`}
                  >
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
                    {stat.label}
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold mb-1">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground/70 leading-tight">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ============================================================ */}
      {/* MY CLUBS SECTION */}
      {/* ============================================================ */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-amber-600" />
                </div>
                My Clubs
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {myClubs.length} club{myClubs.length !== 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('clubs')}
                >
                  All Clubs <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {myClubs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                {myClubs.map((club, i) => {
                  const isAdvisor = club.facultyAdvisorId === user.id;
                  const memberRole = club.members?.find(
                    (m) => m.userId === user.id
                  )?.role;
                  return (
                    <motion.div
                      key={club.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06, type: 'spring' }}
                      whileHover={{ y: -2 }}
                      className="p-4 rounded-lg bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all border border-transparent hover:border-violet-200/40 dark:hover:border-violet-800/40"
                      onClick={() => navigate('club-detail', club.id)}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {club.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <h4 className="text-sm font-medium truncate">
                              {club.name}
                            </h4>
                            {isAdvisor ? (
                              <Badge className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
                                <Crown className="w-2.5 h-2.5 mr-0.5" /> Faculty Advisor
                              </Badge>
                            ) : (
                              <Badge className="text-[9px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                                Member
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {club.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />{' '}
                          {club._count?.members || club.members?.length || 0} members
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{' '}
                          {club._count?.events || 0} events
                        </span>
                        {memberRole && memberRole !== 'member' && !isAdvisor && (
                          <span className="text-violet-600 dark:text-violet-400 capitalize">
                            {memberRole.replace('-', ' ')}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="relative w-16 h-16 mx-auto mb-3">
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-dashed border-amber-300/30"
                    animate={{ rotate: [0, 90, 180, 270, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  />
                  <Building2 className="w-6 h-6 text-muted-foreground/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Not a member of any clubs yet
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="text-primary text-xs mt-1"
                  onClick={() => navigate('clubs')}
                >
                  Explore Clubs <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ============================================================ */}
      {/* MY EVENTS SECTION */}
      {/* ============================================================ */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-violet-600" />
                </div>
                My Events
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {events.length} event{events.length !== 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('feed')}
                >
                  Browse <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {events.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                {events.map((event, i) => {
                  const regCount = event._count?.registrations || 0;
                  const maxP = event.maxParticipants || 100;
                  const percent = Math.min((regCount / maxP) * 100, 100);
                  const isLiveOrApproved = ['LIVE', 'APPROVED'].includes(event.status);

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      whileHover={{ x: 3 }}
                      className="p-3 sm:p-4 rounded-lg bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors border border-transparent hover:border-violet-200/30 dark:hover:border-violet-800/30"
                      onClick={() => navigate('event-detail', event.id)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="text-sm font-medium truncate">
                              {event.title}
                            </h4>
                            <Badge
                              className={`text-[9px] shrink-0 ${eventStatusColors[event.status] || eventStatusColors.DRAFT}`}
                            >
                              {event.status.replace('_', ' ')}
                            </Badge>
                            {event.eventType === 'COMPETITION' && (
                              <Badge className="text-[9px] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 shrink-0">
                                Competition
                              </Badge>
                            )}
                            <Badge
                              className={`text-[9px] shrink-0 ${categoryColors[event.category] || categoryColors.OTHER}`}
                            >
                              {event.category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(event.startDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[120px]">{event.venue}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {regCount} registered
                            </span>
                            {event.club && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {event.club.name}
                              </span>
                            )}
                          </div>
                          {/* Registration progress bar */}
                          <div className="mt-2 max-w-xs">
                            <Progress value={percent} className="h-1.5" />
                          </div>
                        </div>
                        {/* Quick actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isLiveOrApproved && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/30"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenQR(event.id, event.title);
                              }}
                            >
                              <QrCode className="w-3.5 h-3.5 mr-1" /> Check-in QR
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('event-detail', event.id);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="relative w-16 h-16 mx-auto mb-3">
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-dashed border-violet-300/30"
                    animate={{ rotate: [0, 90, 180, 270, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  />
                  <Calendar className="w-6 h-6 text-muted-foreground/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No events created yet
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="text-primary text-xs mt-1"
                  onClick={() => navigate('create-event')}
                >
                  Create Event <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ============================================================ */}
      {/* QR CODE MANAGEMENT SECTION */}
      {/* ============================================================ */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <QrCode className="w-4 h-4 text-rose-600" />
                </div>
                QR Code Management
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => navigate('scan-qr')}
              >
                <ScanLine className="w-3 h-3 mr-1" /> Open Scanner
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {events.filter((e) => ['LIVE', 'APPROVED'].includes(e.status)).length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  Generate event-level QR codes for bulk student check-ins. Display on a projector or screen for students to scan.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {events
                    .filter((e) => ['LIVE', 'APPROVED'].includes(e.status))
                    .map((event, i) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors border border-transparent hover:border-rose-200/30 dark:hover:border-rose-800/30"
                      >
                        <div className="min-w-0 flex-1 mr-3">
                          <h4 className="text-sm font-medium truncate">
                            {event.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge
                              className={`text-[9px] ${eventStatusColors[event.status] || ''}`}
                            >
                              {event.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {event._count?.registrations || 0} registered
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="bg-violet-600 hover:bg-violet-700 text-white text-xs shadow-md shadow-violet-600/20 shrink-0"
                          onClick={() => handleOpenQR(event.id, event.title)}
                        >
                          <QrCode className="w-3.5 h-3.5 mr-1" /> Generate QR
                        </Button>
                      </motion.div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <QrCode className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No active events for QR generation
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Create and activate events to generate check-in QR codes
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ============================================================ */}
      {/* RECENT ACTIVITY - Check-ins */}
      {/* ============================================================ */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-emerald-600" />
                </div>
                Recent Check-ins
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {recentCheckIns.length} recent
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {recentCheckIns.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                {recentCheckIns.map((checkIn, i) => (
                  <motion.div
                    key={checkIn.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {checkIn.user?.name
                          ?.split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {checkIn.user?.name || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                          <span className="truncate max-w-[140px]">
                            {checkIn.event?.title}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {checkIn.checkInTime
                              ? new Date(checkIn.checkInTime).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge
                        className={`text-[9px] ${
                          checkIn.status === 'PRESENT' || checkIn.status === 'CHECKED_IN'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                        }`}
                      >
                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                        {checkIn.status}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="relative w-16 h-16 mx-auto mb-3">
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-dashed border-emerald-300/30"
                    animate={{ rotate: [0, 90, 180, 270, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  />
                  <Activity className="w-6 h-6 text-muted-foreground/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No recent check-ins
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Check-ins will appear here when students scan event QR codes
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ============================================================ */}
      {/* QUICK ACTIONS */}
      {/* ============================================================ */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-violet-600" />
              <h3 className="font-semibold text-base">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  icon: PlusCircle,
                  label: 'Create Event',
                  view: 'create-event' as const,
                  color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50',
                },
                {
                  icon: ScanLine,
                  label: 'Scan QR',
                  view: 'scan-qr' as const,
                  color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50',
                },
                {
                  icon: Building2,
                  label: 'View Clubs',
                  view: 'clubs' as const,
                  color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50',
                },
                {
                  icon: Calendar,
                  label: 'Browse Events',
                  view: 'feed' as const,
                  color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 dark:hover:bg-rose-900/50',
                },
              ].map((action) => (
                <motion.button
                  key={action.view}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(action.view)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl ${action.color} transition-colors`}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{action.label}</span>
                </motion.button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ============================================================ */}
      {/* QR CODE DIALOG */}
      {/* ============================================================ */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-violet-600" />
              Check-in QR Code
            </DialogTitle>
          </DialogHeader>
          {qrEventId && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-center">
                <h3 className="font-semibold text-lg mb-1">{qrEventTitle}</h3>
                <p className="text-xs text-muted-foreground">
                  Display this QR code for students to scan and check in
                </p>
              </div>
              <div className="p-4 bg-white rounded-xl shadow-md border">
                <QRCodeSVG
                  value={`NEXEVENT-CHECKIN-${qrEventId}`}
                  size={220}
                  level="H"
                  includeMargin
                />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  QR Code Value:
                </p>
                <code className="text-[11px] bg-muted px-2 py-1 rounded font-mono break-all">
                  NEXEVENT-CHECKIN-{qrEventId}
                </code>
              </div>
              <Separator />
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1 w-full sm:w-auto"
                  onClick={() => navigate('scan-qr')}
                >
                  <ScanLine className="w-4 h-4 mr-2" /> Open Scanner
                </Button>
                <Button
                  className="flex-1 w-full sm:w-auto bg-violet-600 hover:bg-violet-700"
                  onClick={() => {
                    setQrDialogOpen(false);
                    navigate('event-detail', qrEventId);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" /> View Event
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
