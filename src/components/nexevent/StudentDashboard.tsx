'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  Award, Calendar, Users, Trophy, GraduationCap, BookOpen, Star,
  ArrowUpRight, Download, Zap, Activity, Sparkles, Loader2,
  MapPin, Clock, CheckCircle2, XCircle, QrCode, Crown, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

interface AicteBreakdownItem {
  eventId: string;
  eventTitle: string;
  category: string;
  date: string;
  points: number;
  type: 'participation' | 'volunteer';
}

interface AicteData {
  user: { id: string; name: string; aictePoints: number };
  totalPoints: number;
  earnedPoints: number;
  breakdown: AicteBreakdownItem[];
  summary: {
    participationEvents: number;
    volunteerEvents: number;
    totalBreakdownPoints: number;
  };
}

interface Registration {
  id: string;
  eventId: string;
  status: 'REGISTERED' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';
  registeredAt: string;
  qrCode: string | null;
  event: {
    id: string;
    title: string;
    venue: string;
    startDate: string;
    endDate: string;
    category: string;
    status: string;
    organizer: { id: string; name: string };
    club: { id: string; name: string; logo: string | null } | null;
    _count: { registrations: number };
  };
  attendance: { id: string; status: string } | null;
}

interface ClubMembership {
  id: string;
  userId: string;
  clubId: string;
  role: string;
  joinedAt: string;
  club: {
    id: string;
    name: string;
    logo: string | null;
    category: string;
    _count: { members: number; events: number };
  };
}

interface Certificate {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  certificateType: string;
  scope: string;
  issuedAt: string | null;
  event: {
    id: string;
    title: string;
    venue: string;
    startDate: string;
  };
}

// ============================================================
// Animated Counter Component
// ============================================================

function AnimatedCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    let current = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(Math.round(target * 10) / 10);
        clearInterval(timer);
      } else {
        setCount(Math.round(current * 10) / 10);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  if (target === 0) return <span>0</span>;
  return <span>{Number.isInteger(target) ? Math.round(count) : count.toFixed(1)}</span>;
}

// ============================================================
// Status / Type Badge Colors
// ============================================================

const regStatusColors: Record<string, string> = {
  CONFIRMED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  REGISTERED: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
  CANCELLED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  WAITLISTED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
};

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

const certTypeColors: Record<string, string> = {
  PARTICIPATION: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  WINNER: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  RUNNER_UP: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  BEST_PERFORMER: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  SPECIAL_MENTION: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
  CUSTOM: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const certTypeIcons: Record<string, string> = {
  PARTICIPATION: '🎓',
  WINNER: '🏆',
  RUNNER_UP: '🥈',
  BEST_PERFORMER: '⭐',
  SPECIAL_MENTION: '✨',
  CUSTOM: '📜',
};

// ============================================================
// Main Component
// ============================================================

export function StudentDashboard() {
  const { user } = useAuthStore();
  const { navigate } = useUIStore();

  const [aicteData, setAicteData] = useState<AicteData | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [clubs, setClubs] = useState<ClubMembership[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingCert, setDownloadingCert] = useState<string | null>(null);

  // ============================================================
  // Data Loading
  // ============================================================

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const [aicteRes, regRes, profileRes, clubsRes] = await Promise.all([
          fetch(`/api/aicte-points?userId=${user.id}`),
          fetch(`/api/users/me/events?userId=${user.id}`),
          fetch(`/api/users/me?userId=${user.id}`),
          fetch('/api/clubs'),
        ]);

        let fetchedRegistrations: Registration[] = [];

        if (aicteRes.ok) {
          const d = await aicteRes.json();
          setAicteData(d);
        }
        if (regRes.ok) {
          const d = await regRes.json();
          fetchedRegistrations = d.registrations || [];
          setRegistrations(fetchedRegistrations);
        }
        if (profileRes.ok) {
          const d = await profileRes.json();
          setProfileData(d.user);
        }
        if (clubsRes.ok) {
          const d = await clubsRes.json();
          const myClubs = (d.clubs || [])
            .filter((c: any) => c.members?.some((m: any) => m.userId === user.id))
            .map((c: any) => {
              const member = c.members.find((m: any) => m.userId === user.id);
              return {
                id: member.id,
                userId: member.userId,
                clubId: c.id,
                role: member.role,
                joinedAt: member.joinedAt || new Date().toISOString(),
                club: {
                  id: c.id,
                  name: c.name,
                  logo: c.logo,
                  category: c.category,
                  _count: {
                    members: c._count?.members || c.members?.length || 0,
                    events: c._count?.events || 0,
                  },
                },
              } as ClubMembership;
            });
          setClubs(myClubs);
        }

        // Fetch certificates for each registered event
        const eventIds = [...new Set(fetchedRegistrations
          .filter((r: Registration) => r.status !== 'CANCELLED')
          .map((r: Registration) => r.eventId))];

        if (eventIds.length > 0) {
          const certPromises = eventIds.map(async (eventId: string) => {
            try {
              const certRes = await fetch(`/api/events/${eventId}/certificates?userId=${user.id}`);
              if (certRes.ok) {
                const certData = await certRes.json();
                return (certData.certificates || []).filter(
                  (c: any) => c.userId === user.id && c.issuedAt
                );
              }
            } catch { /* ignore */ }
            return [];
          });
          const certResults = await Promise.all(certPromises);
          setCertificates(certResults.flat());
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      }
      setIsLoading(false);
    };
    load();
  }, [user]);

  // ============================================================
  // Certificate Download
  // ============================================================

  const handleDownloadCert = async (cert: Certificate) => {
    if (!user) return;
    setDownloadingCert(cert.id);
    try {
      const res = await fetch(`/api/events/${cert.eventId}/certificates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificateId: cert.id,
          action: 'generate',
          requestUserId: user.id,
        }),
      });
      if (!res.ok) {
        toast.error('Failed to generate certificate');
        return;
      }
      const data = await res.json();
      if (data.pdf) {
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.fileName || `certificate_${cert.certificateType}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Certificate downloaded! 📜');
      }
    } catch {
      toast.error('Download failed');
    }
    setDownloadingCert(null);
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
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ============================================================
  // Computed Values
  // ============================================================

  const activeRegistrations = registrations.filter(r => r.status !== 'CANCELLED');
  const totalPoints = aicteData?.earnedPoints || 0;
  const maxPossiblePoints = 100; // Typical AICTE target
  const pointsProgress = Math.min((totalPoints / maxPossiblePoints) * 100, 100);

  // ============================================================
  // Render
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
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } },
  };

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
          <div className="relative bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 dark:from-emerald-700 dark:via-teal-700 dark:to-emerald-800">
            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-white/10"
                  style={{
                    width: 8 + i * 6,
                    height: 8 + i * 6,
                    left: `${15 + i * 14}%`,
                    top: `${20 + (i % 3) * 25}%`,
                  }}
                  animate={{
                    y: [0, -12, 0],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 3 + i * 0.5,
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
                      Welcome back, {user.name?.split(' ')[0]}!
                    </h1>
                    <Badge className="bg-white/20 text-white border-white/30 text-xs backdrop-blur-sm">
                      <GraduationCap className="w-3 h-3 mr-1" /> Student
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-sm text-white/80">
                    {user.usn && (
                      <span className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" /> {user.usn}
                      </span>
                    )}
                    {profileData?.department && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> {profileData.department.name || profileData.department}
                      </span>
                    )}
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
                    onClick={() => navigate('my-events')}
                    className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm"
                  >
                    <Calendar className="w-4 h-4 mr-1.5" /> My Events
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('feed')}
                    className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm"
                  >
                    <ArrowUpRight className="w-4 h-4 mr-1.5" /> Browse
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
            label: 'AICTE Points',
            value: totalPoints,
            icon: Trophy,
            color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
            sub: `${aicteData?.summary?.participationEvents || 0} participation, ${aicteData?.summary?.volunteerEvents || 0} volunteer`,
            gradient: 'from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10',
          },
          {
            label: 'Events Registered',
            value: activeRegistrations.length,
            icon: Calendar,
            color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30',
            sub: `${registrations.filter(r => r.attendance).length} attended`,
            gradient: 'from-violet-50 to-violet-100/50 dark:from-violet-950/20 dark:to-violet-900/10',
          },
          {
            label: 'Clubs Joined',
            value: clubs.length,
            icon: Users,
            color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
            sub: clubs.length > 0 ? `${clubs.filter(c => c.role !== 'member').length} leadership role${clubs.filter(c => c.role !== 'member').length !== 1 ? 's' : ''}` : 'Join a club',
            gradient: 'from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10',
          },
          {
            label: 'Certificates',
            value: certificates.length,
            icon: Award,
            color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30',
            sub: `${certificates.filter(c => c.certificateType === 'WINNER' || c.certificateType === 'BEST_PERFORMER').length} achievement${certificates.filter(c => c.certificateType === 'WINNER' || c.certificateType === 'BEST_PERFORMER').length !== 1 ? 's' : ''}`,
            gradient: 'from-rose-50 to-rose-100/50 dark:from-rose-950/20 dark:to-rose-900/10',
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            variants={itemVariants}
            whileHover={{ y: -4, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <Card className={`h-full bg-gradient-to-br ${stat.gradient} border-0 shadow-sm hover:shadow-md transition-shadow`}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
                    {stat.label}
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold mb-1">
                  <AnimatedCounter target={stat.value} />
                </p>
                <p className="text-[11px] text-muted-foreground/70 leading-tight">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ============================================================ */}
      {/* AICTE POINTS BREAKDOWN */}
      {/* ============================================================ */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-amber-600" />
                </div>
                AICTE Points Breakdown
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 text-xs">
                  <Star className="w-3 h-3 mr-1" /> {totalPoints} pts
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Progress toward target */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Progress toward {maxPossiblePoints} pts target</span>
                <span className="font-medium">{Math.round(pointsProgress)}%</span>
              </div>
              <Progress value={pointsProgress} className="h-2" />
            </div>

            {aicteData && aicteData.breakdown.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                {aicteData.breakdown.map((item, i) => (
                  <motion.div
                    key={`${item.eventId}-${item.type}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        item.type === 'participation'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30'
                          : 'bg-violet-100 dark:bg-violet-900/30'
                      }`}>
                        {item.type === 'participation'
                          ? <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                          : <Zap className="w-3.5 h-3.5 text-violet-600" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.eventTitle}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="secondary"
                            className={`text-[9px] px-1.5 py-0 ${categoryColors[item.category] || categoryColors.OTHER}`}
                          >
                            {item.category}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge
                        className={`text-[10px] ${
                          item.type === 'participation'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                            : 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300'
                        }`}
                      >
                        {item.type === 'participation' ? 'Participation' : 'Volunteer'}
                      </Badge>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400 min-w-[36px] text-right">
                        +{item.points}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="relative w-16 h-16 mx-auto mb-3">
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-dashed border-amber-300/30"
                    animate={{ rotate: [0, 90, 180, 270, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  />
                  <Trophy className="w-6 h-6 text-muted-foreground/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-muted-foreground">No AICTE points earned yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Register and attend events to earn points</p>
              </div>
            )}

            {aicteData && aicteData.breakdown.length > 0 && (
              <>
                <Separator className="my-3" />
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3 h-3 text-emerald-600" />
                      {aicteData.summary.participationEvents} participation
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-violet-600" />
                      {aicteData.summary.volunteerEvents} volunteer
                    </span>
                  </div>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    Total: {totalPoints} pts
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ============================================================ */}
      {/* TWO-COLUMN LAYOUT: Recent Registrations + Club Memberships */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* RECENT REGISTRATIONS */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-violet-600" />
                  </div>
                  Recent Registrations
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('my-events')}
                >
                  View All <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {activeRegistrations.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                  {activeRegistrations.slice(0, 6).map((reg, i) => (
                    <motion.div
                      key={reg.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ x: 3 }}
                      className="p-3 rounded-lg bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => navigate('event-detail', reg.eventId)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="text-sm font-medium truncate">{reg.event.title}</h4>
                            <Badge className={`text-[9px] shrink-0 ${regStatusColors[reg.status] || ''}`}>
                              {reg.status}
                            </Badge>
                            {reg.attendance && (
                              <Badge className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 shrink-0">
                                <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Attended
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(reg.event.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{reg.event.venue}</span>
                            </span>
                          </div>
                          {reg.event.club && (
                            <span className="text-[10px] text-muted-foreground/60 mt-0.5 inline-block">
                              by {reg.event.club.name}
                            </span>
                          )}
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No registrations yet</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-primary text-xs mt-1"
                    onClick={() => navigate('feed')}
                  >
                    Browse Events <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* CLUB MEMBERSHIPS */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  Club Memberships
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('clubs')}
                >
                  All Clubs <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {clubs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                  {clubs.map((membership, i) => (
                    <motion.div
                      key={membership.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06, type: 'spring' }}
                      whileHover={{ y: -2 }}
                      className="p-3 rounded-lg bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all border border-transparent hover:border-primary/10"
                      onClick={() => navigate('club-detail', membership.clubId)}
                    >
                      <div className="flex items-start gap-2.5 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {membership.club.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium truncate">{membership.club.name}</h4>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] mt-0.5 ${
                              membership.role === 'president' || membership.role === 'secretary'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                : membership.role === 'treasurer'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {membership.role === 'president' && <Crown className="w-2.5 h-2.5 mr-0.5" />}
                            {membership.role}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {membership.club._count.members}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {membership.club._count.events} events
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Not in any clubs yet</p>
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
      </div>

      {/* ============================================================ */}
      {/* CERTIFICATES SECTION */}
      {/* ============================================================ */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <Award className="w-4 h-4 text-rose-600" />
                </div>
                Certificates
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {certificates.length} earned
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {certificates.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                {certificates.map((cert, i) => (
                  <motion.div
                    key={cert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="text-xl shrink-0">
                        {certTypeIcons[cert.certificateType] || '📜'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{cert.event.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge
                            className={`text-[9px] ${certTypeColors[cert.certificateType] || certTypeColors.CUSTOM}`}
                          >
                            {cert.certificateType.replace('_', ' ')}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {cert.issuedAt
                              ? new Date(cert.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                              : 'Pending'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 ml-2 text-xs"
                      onClick={() => handleDownloadCert(cert)}
                      disabled={downloadingCert === cert.id}
                    >
                      {downloadingCert === cert.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3 mr-1" />
                      )}
                      {downloadingCert === cert.id ? 'Generating...' : 'Download'}
                    </Button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="relative w-16 h-16 mx-auto mb-3">
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-dashed border-rose-300/30"
                    animate={{ rotate: [0, 90, 180, 270, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  />
                  <Award className="w-6 h-6 text-muted-foreground/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-muted-foreground">No certificates yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Complete events to earn certificates</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ============================================================ */}
      {/* QUICK ACTIONS */}
      {/* ============================================================ */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-sm bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600" />
                  Quick Actions
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Get involved in campus activities</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-teal-200 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950/30"
                  onClick={() => navigate('feed')}
                >
                  <Calendar className="w-3.5 h-3.5 mr-1.5" /> Browse Events
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  onClick={() => navigate('clubs')}
                >
                  <Users className="w-3.5 h-3.5 mr-1.5" /> Join a Club
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  onClick={() => navigate('profile')}
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" /> My Profile
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
