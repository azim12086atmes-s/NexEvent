'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  Calendar, Users, BarChart3, Clock, CheckCircle2, XCircle,
  Loader2, Eye, FileText, Download, ArrowRight, Zap, TrendingUp,
  Activity, Sparkles, PlusCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventStore } from '@/store/event-store';
import { Progress } from '@/components/ui/progress';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  LIVE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  COMPLETED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export function OrganizerDashboard() {
  const { user } = useAuthStore();
  const { navigate } = useUIStore();
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const [eventsRes, statsRes] = await Promise.all([
          fetch(`/api/events?status=&userId=${user.id}`),
          fetch(`/api/stats?userId=${user.id}`),
        ]);
        if (eventsRes.ok) {
          const data = await eventsRes.json();
          setEvents((data.events || []).filter((e: any) => e.organizer?.id === user.id));
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data.stats);
        }
      } catch {}
      setIsLoading(false);
    };
    load();
  }, [user]);

  const generateReport = async (eventId: string, title: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/report`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error('Failed to generate report'); return; }

      const doc = new jsPDF();
      doc.setFillColor(55, 48, 163);
      doc.rect(0, 0, 210, 35, 'F');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text('NexEvent - Event Report', 14, 22);
      doc.setFontSize(10);
      doc.text('VVCE Campus Innovation 2026', 14, 30);
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(16);
      doc.text(data.event.title, 14, 48);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Venue: ${data.event.venue}  |  Date: ${new Date(data.event.startDate).toLocaleDateString('en-IN')}  |  Category: ${data.event.category}`, 14, 56);
      doc.setFillColor(245, 245, 255);
      doc.roundedRect(14, 62, 182, 30, 3, 3, 'F');
      doc.setFontSize(11);
      doc.setTextColor(55, 48, 163);
      doc.text('Attendance Summary', 20, 72);
      doc.setFontSize(9);
      doc.setTextColor(60);
      doc.text(`Total Registered: ${data.stats.totalRegistered}    Present: ${data.stats.totalPresent}    Absent: ${data.stats.totalAbsent}    Rate: ${data.stats.attendanceRate}%`, 20, 82);

      if (data.attendees?.length > 0) {
        autoTable(doc, {
          startY: 100,
          head: [['#', 'Name', 'USN', 'Department', 'Status', 'Check-in']],
          body: data.attendees.map((a: any, i: number) => [i + 1, a.name, a.usn || '-', a.department || '-', a.status, a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString('en-IN') : '-']),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [55, 48, 163], textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [245, 245, 255] },
        });
      }

      doc.save(`${title.replace(/\s+/g, '_')}_Report.pdf`);
      toast.success('PDF report downloaded! 📄');
    } catch { toast.error('PDF generation failed'); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const totalRegistrations = events.reduce((sum, e) => sum + (e._count?.registrations || 0), 0);
  const activeEvents = events.filter(e => ['APPROVED', 'LIVE'].includes(e.status)).length;
  const completedEvents = events.filter(e => e.status === 'COMPLETED').length;

  const statCards = [
    { label: 'My Events', value: events.length, icon: Calendar, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30', change: '+2 this month' },
    { label: 'Total Registrations', value: totalRegistrations, icon: Users, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30', change: `${stats?.totalRegistrations || 0} campus-wide` },
    { label: 'Active Now', value: activeEvents, icon: Activity, color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30', change: activeEvents > 0 ? 'Live' : 'No live events' },
    { label: 'Completed', value: completedEvents, icon: CheckCircle2, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30', change: `${stats?.userOrganizedEvents || 0} total organized` },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Organizer Dashboard</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              <Zap className="w-2.5 h-2.5 mr-1" /> Organizer
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Manage your events and view analytics</p>
        </div>
        <Button onClick={() => navigate('create-event')} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
          <PlusCircle className="w-4 h-4 mr-2" /> New Event
        </Button>
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
                <p className="text-[10px] text-muted-foreground/70">{s.change}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Registration overview */}
      {events.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Registration Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {events.slice(0, 5).map((event) => {
                  const regCount = event._count?.registrations || 0;
                  const maxP = event.maxParticipants || 100;
                  const percent = Math.min((regCount / maxP) * 100, 100);
                  return (
                    <div key={event.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate max-w-[200px]">{event.title}</span>
                        <span className="text-muted-foreground">{regCount}{event.maxParticipants ? ` / ${event.maxParticipants}` : ''}</span>
                      </div>
                      <Progress value={percent} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Events list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">My Events</h2>
        <span className="text-xs text-muted-foreground">{events.length} total</span>
      </div>

      {events.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card>
            <CardContent className="py-16 text-center">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <motion.div
                  className="absolute inset-0 rounded-2xl border-2 border-dashed border-primary/20"
                  animate={{ rotate: [0, 90, 180, 270, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                />
                <Calendar className="w-8 h-8 text-muted-foreground/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-lg font-medium text-muted-foreground mb-1">No events yet</p>
              <p className="text-sm text-muted-foreground/70 mb-4">Create your first event and start managing campus activities</p>
              <Button onClick={() => navigate('create-event')} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                <PlusCircle className="w-4 h-4 mr-2" /> Create Your First Event
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, type: 'spring' }}
              whileHover={{ x: 4 }}
            >
              <Card className="hover:shadow-md transition-all duration-300 border-border/50 hover:border-primary/20">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="font-semibold truncate">{event.title}</h3>
                      <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColors[event.status] || ''}`}>
                        {event.status === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 animate-pulse" />}
                        {event.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(event.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                      <span>{event.venue}</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {event._count?.registrations || 0} registered
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(event.status === 'APPROVED' || event.status === 'LIVE' || event.status === 'COMPLETED') && (
                      <Button variant="outline" size="sm" onClick={() => generateReport(event.id, event.title)}
                        className="text-xs hover:bg-primary/5">
                        <Download className="w-3 h-3 mr-1" /> Report
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => navigate('event-detail', event.id)}
                      className="text-xs">
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
