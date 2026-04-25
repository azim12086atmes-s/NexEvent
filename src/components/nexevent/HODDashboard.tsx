'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  Building2, Users, CheckCircle2, XCircle, Clock, Crown,
  GraduationCap, Calendar, Shield, Award, UserCheck, UserX,
  Loader2, Sparkles, AlertTriangle, PlusCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

interface DepartmentInfo {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  hod: { id: string; name: string; email: string; role: string } | null;
}

interface ClubInfo {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  autoJoin: boolean;
  requireApproval: boolean;
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
  organizer: { id: string; name: string };
  club: { id: string; name: string } | null;
  _count: { registrations: number };
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  usn: string | null;
  aictePoints: number;
  _count: { registrations: number; clubMemberships: number };
}

interface ClubCreationRequestInfo {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  status: string;
  autoJoin: boolean;
  requireApproval: boolean;
  rejectionReason: string | null;
  createdAt: string;
  requestedBy: { id: string; name: string; email: string; role: string };
  reviewedBy: { id: string; name: string } | null;
}

interface DeptStats {
  totalStudents: number;
  totalFaculty: number;
  totalClubs: number;
  totalEvents: number;
  activeEvents: number;
  pendingRequests: number;
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

export function HODDashboard() {
  const { user } = useAuthStore();
  const { navigate } = useUIStore();

  const [department, setDepartment] = useState<DepartmentInfo | null>(null);
  const [clubs, setClubs] = useState<ClubInfo[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [clubRequests, setClubRequests] = useState<ClubCreationRequestInfo[]>([]);
  const [stats, setStats] = useState<DeptStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);

  // ============================================================
  // Data Loading
  // ============================================================

  const refreshData = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/departments/my?userId=${user.id}`);
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || 'Failed to load department data');
        return;
      }
      const data = await res.json();
      setDepartment(data.department);
      setClubs(data.clubs || []);
      setEvents(data.events || []);
      setUsers(data.users || []);
      setClubRequests(data.clubCreationRequests || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('HOD Dashboard load error:', err);
      toast.error('Failed to load dashboard data');
    }
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/departments/my?userId=${user.id}`);
        if (cancelled) return;
        if (!res.ok) {
          const d = await res.json();
          toast.error(d.error || 'Failed to load department data');
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setDepartment(data.department);
        setClubs(data.clubs || []);
        setEvents(data.events || []);
        setUsers(data.users || []);
        setClubRequests(data.clubCreationRequests || []);
        setStats(data.stats || null);
      } catch (err) {
        if (cancelled) return;
        console.error('HOD Dashboard load error:', err);
        toast.error('Failed to load dashboard data');
      }
      if (!cancelled) setIsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  // ============================================================
  // Computed Values
  // ============================================================

  const pendingRequests = useMemo(
    () => clubRequests.filter(r => r.status === 'PENDING'),
    [clubRequests]
  );

  const students = useMemo(
    () => users.filter(u => u.role === 'STUDENT'),
    [users]
  );

  const faculty = useMemo(
    () => users.filter(u => u.role === 'FACULTY' || u.role === 'HOD'),
    [users]
  );

  // ============================================================
  // Approve / Reject Handlers
  // ============================================================

  const handleApprove = async (requestId: string) => {
    if (!user) return;
    setProcessingId(requestId);
    try {
      const res = await fetch('/api/clubs/creation-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestUserId: user.id,
          requestId,
          action: 'approve',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to approve request');
        setProcessingId(null);
        return;
      }
      toast.success(data.message || 'Club approved and created successfully!');
      setConfirmAction(null);
      await refreshData();
    } catch {
      toast.error('Failed to approve request');
    }
    setProcessingId(null);
  };

  const handleReject = async (requestId: string) => {
    if (!user) return;
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setProcessingId(requestId);
    try {
      const res = await fetch('/api/clubs/creation-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestUserId: user.id,
          requestId,
          action: 'reject',
          rejectionReason: rejectionReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to reject request');
        setProcessingId(null);
        return;
      }
      toast.success(data.message || 'Request rejected');
      setRejectingId(null);
      setRejectionReason('');
      setConfirmAction(null);
      await refreshData();
    } catch {
      toast.error('Failed to reject request');
    }
    setProcessingId(null);
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
            <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading HOD Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || !department) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="text-lg font-medium mb-1">Access Denied</p>
            <p className="text-sm text-muted-foreground">
              Only HODs can access this dashboard. You must be assigned as HOD of a department.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } },
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
      {/* HEADER - Gradient Banner with Department Info */}
      {/* ============================================================ */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="relative bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 dark:from-amber-700 dark:via-orange-700 dark:to-amber-800">
            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-white/10"
                  style={{
                    width: 10 + i * 5,
                    height: 10 + i * 5,
                    left: `${10 + i * 16}%`,
                    top: `${15 + (i % 3) * 28}%`,
                  }}
                  animate={{
                    y: [0, -15, 0],
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
                    <Building2 className="w-6 h-6 text-white/80" />
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">
                      {department.name}
                    </h1>
                    <Badge className="bg-white/20 text-white border-white/30 text-xs backdrop-blur-sm">
                      {department.code}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-sm text-white/80">
                    <span className="flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5" /> HOD: {user.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" /> {user.role}
                    </span>
                    {department.description && (
                      <span className="text-white/60 text-xs hidden sm:inline">
                        {department.description}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pendingRequests.length > 0 && (
                    <Badge className="bg-white/30 text-white border-white/40 text-xs animate-pulse">
                      <Clock className="w-3 h-3 mr-1" />
                      {pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('create-event')}
                    className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm"
                  >
                    <PlusCircle className="w-4 h-4 mr-1.5" /> New Event
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
            label: 'Total Students',
            value: stats?.totalStudents || 0,
            icon: GraduationCap,
            color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
            gradient: 'from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10',
            sub: `In ${department.code} department`,
          },
          {
            label: 'Total Faculty',
            value: stats?.totalFaculty || 0,
            icon: Users,
            color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30',
            gradient: 'from-violet-50 to-violet-100/50 dark:from-violet-950/20 dark:to-violet-900/10',
            sub: 'Faculty & HODs',
          },
          {
            label: 'Active Clubs',
            value: stats?.totalClubs || 0,
            icon: Award,
            color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
            gradient: 'from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10',
            sub: `${clubs.reduce((s, c) => s + c._count.members, 0)} total members`,
          },
          {
            label: 'Department Events',
            value: stats?.totalEvents || 0,
            icon: Calendar,
            color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30',
            gradient: 'from-rose-50 to-rose-100/50 dark:from-rose-950/20 dark:to-rose-900/10',
            sub: `${stats?.activeEvents || 0} currently active`,
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
      {/* PENDING CLUB CREATION REQUESTS (Main Feature) */}
      {/* ============================================================ */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                Pending Club Requests
              </CardTitle>
              {pendingRequests.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 text-xs">
                  {pendingRequests.length} pending
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pendingRequests.length > 0 ? (
              <div className="space-y-4">
                <AnimatePresence>
                  {pendingRequests.map((req, i) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ delay: i * 0.06, type: 'spring' }}
                    >
                      <Card className="border border-border/60 hover:border-amber-300/40 hover:shadow-md transition-all">
                        <CardContent className="p-4 sm:p-5">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            {/* Request info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h3 className="text-base font-semibold">{req.name}</h3>
                                <Badge className={`text-[10px] ${categoryColors[req.category] || categoryColors.OTHER}`}>
                                  {req.category}
                                </Badge>
                                <Badge
                                  className={`text-[10px] ${
                                    req.autoJoin
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                      : 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300'
                                  }`}
                                >
                                  {req.autoJoin ? 'Auto-Join' : 'Approval Required'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                {req.description}
                              </p>
                              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5 text-violet-500" />
                                  Requested by {req.requestedBy.name}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {new Date(req.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Confirm dialog inline */}
                              {confirmAction?.id === req.id && confirmAction.action === 'approve' ? (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="flex items-center gap-2"
                                >
                                  <span className="text-xs text-emerald-600 font-medium">Confirm?</span>
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                                    disabled={processingId === req.id}
                                    onClick={() => handleApprove(req.id)}
                                  >
                                    {processingId === req.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    )}
                                    Yes, Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => setConfirmAction(null)}
                                    disabled={processingId === req.id}
                                  >
                                    Cancel
                                  </Button>
                                </motion.div>
                              ) : confirmAction?.id === req.id && confirmAction.action === 'reject' ? (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="flex flex-col gap-2"
                                >
                                  <div>
                                    <Label htmlFor={`reject-${req.id}`} className="text-xs text-muted-foreground mb-1">
                                      Rejection reason *
                                    </Label>
                                    <Input
                                      id={`reject-${req.id}`}
                                      placeholder="Provide a reason for rejection..."
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
                                      disabled={processingId === req.id || !rejectionReason.trim()}
                                      onClick={() => handleReject(req.id)}
                                    >
                                      {processingId === req.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                      ) : (
                                        <XCircle className="w-3.5 h-3.5 mr-1" />
                                      )}
                                      Confirm Reject
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs"
                                      onClick={() => {
                                        setConfirmAction(null);
                                        setRejectionReason('');
                                      }}
                                      disabled={processingId === req.id}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </motion.div>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-md shadow-emerald-600/20"
                                    onClick={() => {
                                      setConfirmAction({ id: req.id, action: 'approve' });
                                      setRejectingId(null);
                                    }}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                    onClick={() => {
                                      setConfirmAction({ id: req.id, action: 'reject' });
                                      setRejectingId(req.id);
                                    }}
                                  >
                                    <XCircle className="w-3.5 h-3.5 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-dashed border-amber-300/30"
                    animate={{ rotate: [0, 90, 180, 270, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  />
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-lg font-medium text-muted-foreground mb-1">All caught up!</p>
                <p className="text-sm text-muted-foreground/70">No pending club creation requests to review</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ============================================================ */}
      {/* TWO-COLUMN LAYOUT: Department Clubs + Department Faculty */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* DEPARTMENT CLUBS */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Award className="w-4 h-4 text-amber-600" />
                  </div>
                  Department Clubs
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {clubs.length} club{clubs.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {clubs.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {clubs.map((club, i) => (
                    <motion.div
                      key={club.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ x: 3 }}
                      className="p-3 rounded-lg bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors border border-transparent hover:border-amber-200/30"
                      onClick={() => navigate('club-detail', club.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {club.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="text-sm font-medium truncate">{club.name}</h4>
                            <Badge className={`text-[9px] ${categoryColors[club.category] || categoryColors.OTHER}`}>
                              {club.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">
                            {club.description}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {club._count.members} members
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {club._count.events} events
                            </span>
                            {club.facultyAdvisor && (
                              <span className="flex items-center gap-1">
                                <Crown className="w-3 h-3 text-amber-500" />
                                {club.facultyAdvisor.name}
                              </span>
                            )}
                            <Badge
                              className={`text-[8px] ${
                                club.autoJoin
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                              }`}
                            >
                              {club.autoJoin ? 'Auto-Join' : 'Approval'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Award className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No clubs yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Faculty can request club creation for your department
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* DEPARTMENT FACULTY */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-violet-600" />
                  </div>
                  Department Faculty
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {faculty.length} member{faculty.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {faculty.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {faculty.map((f, i) => (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                        f.role === 'HOD'
                          ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                          : 'bg-gradient-to-br from-violet-400 to-purple-500'
                      }`}>
                        {f.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-sm font-medium truncate">{f.name}</h4>
                          <Badge className={`text-[9px] ${
                            f.role === 'HOD'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                              : 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300'
                          }`}>
                            {f.role === 'HOD' && <Crown className="w-2.5 h-2.5 mr-0.5" />}
                            {f.role}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{f.email}</p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {f._count.registrations} registrations
                          </span>
                          <span className="flex items-center gap-1">
                            <Award className="w-3 h-3" /> {f._count.clubMemberships} clubs
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <GraduationCap className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No faculty in this department</p>
                </div>
              )}

              {/* Separator + Student count */}
              {students.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{students.length} student{students.length !== 1 ? 's' : ''} enrolled</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {students.reduce((sum, s) => sum + s.aictePoints, 0).toFixed(1)} total AICTE pts
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ============================================================ */}
      {/* RECENT DEPARTMENT EVENTS */}
      {/* ============================================================ */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-rose-600" />
                </div>
                Recent Department Events
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {events.length} event{events.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {events.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {events.map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileHover={{ x: 3 }}
                    className="p-3 rounded-lg bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => navigate('event-detail', event.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-sm font-medium truncate">{event.title}</h4>
                          <Badge className={`text-[9px] shrink-0 ${eventStatusColors[event.status] || eventStatusColors.DRAFT}`}>
                            {event.status === 'LIVE' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 animate-pulse" />
                            )}
                            {event.status}
                          </Badge>
                          <Badge className={`text-[9px] shrink-0 ${categoryColors[event.category] || categoryColors.OTHER}`}>
                            {event.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(event.startDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: '2-digit',
                            })}
                          </span>
                          <span className="truncate max-w-[150px]">{event.venue}</span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {event._count.registrations} registered
                          </span>
                          {event.club && (
                            <span className="text-amber-600 dark:text-amber-400">
                              by {event.club.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
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
                  <Calendar className="w-6 h-6 text-muted-foreground/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-muted-foreground">No events in this department yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Create events to engage your department
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ============================================================ */}
      {/* ALL CLUB REQUESTS HISTORY (if any non-pending) */}
      {/* ============================================================ */}
      {clubRequests.filter(r => r.status !== 'PENDING').length > 0 && (
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900/30 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-slate-600" />
                </div>
                Request History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {clubRequests
                  .filter(r => r.status !== 'PENDING')
                  .map((req, i) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                            : 'bg-rose-100 dark:bg-rose-900/30'
                        }`}>
                          {req.status === 'APPROVED'
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            : <XCircle className="w-4 h-4 text-rose-600" />
                          }
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium truncate">{req.name}</h4>
                          <p className="text-[11px] text-muted-foreground">
                            by {req.requestedBy.name} &middot;{' '}
                            {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                          {req.status === 'REJECTED' && req.rejectionReason && (
                            <p className="text-[10px] text-rose-500 mt-0.5 truncate">
                              Reason: {req.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className={`text-[9px] shrink-0 ${
                        req.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                      }`}>
                        {req.status}
                      </Badge>
                    </motion.div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* DEPARTMENT STUDENTS (Expandable list) */}
      {/* ============================================================ */}
      {students.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                  </div>
                  Department Students
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {students.length} student{students.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                {students.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03, type: 'spring' }}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-medium truncate">{s.name}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {s.usn && <span>{s.usn}</span>}
                        <span className="flex items-center gap-0.5">
                          <Award className="w-2.5 h-2.5" /> {s.aictePoints} pts
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
