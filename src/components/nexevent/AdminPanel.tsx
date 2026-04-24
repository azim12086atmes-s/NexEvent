'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  Shield, CheckCircle2, XCircle, Clock, Calendar, Users,
  BarChart3, Loader2, Eye, Activity, Sparkles, AlertTriangle,
  TrendingUp, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  LIVE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  COMPLETED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
};

const categoryIcons: Record<string, string> = {
  HACKATHON: '💻', TECHNICAL: '⚡', CULTURAL: '🎭', WORKSHOP: '🔧',
  SEMINAR: '🎓', SPORTS: '🏆', SOCIAL: '🌱', OTHER: '📌',
};

export function AdminPanel() {
  const { user } = useAuthStore();
  const { navigate } = useUIStore();
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const [pendingRes, allRes, statsRes] = await Promise.all([
          fetch(`/api/events?status=PENDING_APPROVAL&userId=${user.id}`),
          fetch(`/api/events?status=ALL&userId=${user.id}&limit=50`),
          fetch(`/api/stats?userId=${user.id}`),
        ]);
        if (pendingRes.ok) { const d = await pendingRes.json(); setPendingEvents(d.events || []); }
        if (allRes.ok) { const d = await allRes.json(); setAllEvents(d.events || []); }
        if (statsRes.ok) { const d = await statsRes.json(); setStats(d.stats); }
      } catch {}
      setIsLoading(false);
    };
    load();
  }, [user]);

  const handleApproval = async (eventId: string, action: 'approve' | 'reject') => {
    if (!user) return;
    try {
      const res = await fetch(`/api/events/${eventId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(action === 'approve' ? 'Event approved! ✅' : 'Event rejected ❌');
      setPendingEvents(prev => prev.filter(e => e.id !== eventId));
      // Also update allEvents
      setAllEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: action === 'approve' ? 'APPROVED' : 'REJECTED' } : e));
    } catch { toast.error('Action failed'); }
  };

  if (!user || (user.role !== 'FACULTY' && user.role !== 'ADMIN')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-lg font-medium">Access Restricted</p>
          <p className="text-sm text-muted-foreground">Only faculty and admins can access this panel.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  const filteredEvents = statusFilter === 'all'
    ? allEvents
    : allEvents.filter(e => e.status === statusFilter);

  const statCards = [
    { label: 'Total Events', value: stats?.totalEvents || 0, icon: Calendar, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30', sub: 'All time' },
    { label: 'Active Now', value: stats?.activeEvents || 0, icon: Activity, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30', sub: 'Approved or Live' },
    { label: 'Pending Review', value: stats?.pendingApprovals || 0, icon: Clock, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30', sub: pendingEvents.length > 0 ? 'Needs attention' : 'All caught up' },
    { label: 'Registrations', value: stats?.totalRegistrations || 0, icon: Users, color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30', sub: 'Campus-wide' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Admin Panel
          </h1>
          <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 text-xs">
            {user.role}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">Review events, manage approvals, and view analytics</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {statCards.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, type: 'spring' }}
            whileHover={{ y: -3 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center`}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/70">{s.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pending Approvals */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Pending Approvals
          {pendingEvents.length > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                {pendingEvents.length}
              </Badge>
            </motion.span>
          )}
        </h2>

        {pendingEvents.length === 0 ? (
          <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/50">
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">All caught up!</p>
              <p className="text-xs text-muted-foreground">No pending approvals at this time.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {pendingEvents.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="border-amber-200/80 dark:border-amber-800/50 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-lg">{categoryIcons[event.category] || '📌'}</span>
                            <h3 className="font-semibold text-base">{event.title}</h3>
                            <Badge variant="outline" className="text-[10px]">{event.category}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(event.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                            <span>{event.venue}</span>
                            <span>Max: {event.maxParticipants || '∞'}</span>
                          </div>
                          {event.organizer && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-semibold text-primary">
                                {event.organizer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </div>
                              <span>Submitted by {event.organizer.name}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
                          <Button size="sm" className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20"
                            onClick={() => handleApproval(event.id, 'approve')}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button variant="destructive" size="sm"
                            className="flex-1 sm:flex-none"
                            onClick={() => handleApproval(event.id, 'reject')}>
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                          <Button variant="ghost" size="sm"
                            className="flex-1 sm:flex-none"
                            onClick={() => navigate('event-detail', event.id)}>
                            <Eye className="w-3.5 h-3.5 mr-1" /> Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* All Events Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> All Events
          </h2>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="LIVE">Live</SelectItem>
              <SelectItem value="PENDING_APPROVAL">Pending</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {filteredEvents.slice(0, 15).map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card
                className="hover:shadow-md transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/20"
                onClick={() => navigate('event-detail', event.id)}
              >
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm">{categoryIcons[event.category] || '📌'}</span>
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColors[event.status] || ''}`}>
                      {event.status}
                    </Badge>
                    <span className="text-sm font-medium truncate">{event.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span>{event._count?.registrations || 0} reg</span>
                    <span className="hidden sm:inline">{new Date(event.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
