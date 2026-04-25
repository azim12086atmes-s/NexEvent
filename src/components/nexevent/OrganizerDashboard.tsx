'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  Calendar, Users, BarChart3, Clock, CheckCircle2, XCircle,
  Loader2, Eye, Download, ArrowRight, Zap, TrendingUp,
  Activity, Sparkles, PlusCircle, Building2, Crown,
  UserPlus, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventStore } from '@/store/event-store';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const clubRequestStatusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  PENDING: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', icon: Clock, label: 'Pending' },
  APPROVED: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', icon: CheckCircle2, label: 'Approved' },
  REJECTED: { color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', icon: XCircle, label: 'Rejected' },
};

const eventCategories = [
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'CULTURAL', label: 'Cultural' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'WORKSHOP', label: 'Workshop' },
  { value: 'SEMINAR', label: 'Seminar' },
  { value: 'HACKATHON', label: 'Hackathon' },
  { value: 'SOCIAL', label: 'Social' },
  { value: 'OTHER', label: 'Other' },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-|-$/g, '');
}

export function OrganizerDashboard() {
  const { user } = useAuthStore();
  const { navigate } = useUIStore();
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [clubRequests, setClubRequests] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);

  // Request Club dialog state
  const [clubDialogOpen, setClubDialogOpen] = useState(false);
  const [clubForm, setClubForm] = useState({
    name: '',
    slug: '',
    description: '',
    category: 'OTHER',
    departmentId: '',
    autoJoin: false,
    requireApproval: true,
  });
  const [isSubmittingClub, setIsSubmittingClub] = useState(false);

  // Assign Organizer state
  const [assigningEventId, setAssigningEventId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [eventMembers, setEventMembers] = useState<Record<string, any[]>>({});
  const [eventRoles, setEventRoles] = useState<Record<string, any[]>>({});
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const [eventsRes, statsRes, clubReqsRes, deptsRes, clubsRes] = await Promise.all([
          fetch(`/api/events?status=&userId=${user.id}`),
          fetch(`/api/stats?userId=${user.id}`),
          fetch(`/api/clubs/creation-requests?requestedById=${user.id}`),
          fetch('/api/admin/departments'),
          fetch('/api/clubs'),
        ]);
        if (cancelled) return;
        if (eventsRes.ok) {
          const data = await eventsRes.json();
          setEvents((data.events || []).filter((e: any) => e.organizer?.id === user.id));
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data.stats);
        }
        if (clubReqsRes.ok) {
          const data = await clubReqsRes.json();
          setClubRequests(data.requests || []);
        }
        if (deptsRes.ok) {
          const data = await deptsRes.json();
          setDepartments(data.departments || []);
        }
        if (clubsRes.ok) {
          const data = await clubsRes.json();
          setClubs(data.clubs || []);
        }
      } catch {
        // silently handle
      }
      if (!cancelled) setIsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  // Load event members & roles for each event with a club
  useEffect(() => {
    if (!user || events.length === 0) return;
    const loadEventData = async () => {
      const membersMap: Record<string, any[]> = {};
      const rolesMap: Record<string, any[]> = {};
      for (const event of events) {
        if (event.clubId) {
          // Get club members as potential student organizers
          const club = clubs.find((c: any) => c.id === event.clubId);
          if (club?.members) {
            membersMap[event.id] = club.members.filter((m: any) =>
              m.user && m.role !== 'faculty-advisor'
            );
          }
        }
        // Get event roles for this event
        try {
          const rolesRes = await fetch(`/api/events/${event.id}/roles`);
          if (rolesRes.ok) {
            const data = await rolesRes.json();
            rolesMap[event.id] = data.roles || [];
          }
        } catch {
          // silently handle
        }
      }
      setEventMembers(membersMap);
      setEventRoles(rolesMap);
    };
    loadEventData();
  }, [user, events, clubs]);

  const handleClubFormChange = (field: string, value: string | boolean) => {
    setClubForm(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-generate slug when name changes
      if (field === 'name') {
        updated.slug = generateSlug(value as string);
      }
      return updated;
    });
  };

  const handleSubmitClubRequest = async () => {
    if (!user) return;
    if (!clubForm.name.trim() || !clubForm.description.trim() || !clubForm.departmentId) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (user.role !== 'FACULTY') {
      toast.error('Only faculty members can request club creation');
      return;
    }

    setIsSubmittingClub(true);
    try {
      const res = await fetch('/api/clubs/creation-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clubForm.name.trim(),
          slug: clubForm.slug || generateSlug(clubForm.name),
          description: clubForm.description.trim(),
          category: clubForm.category,
          requestedById: user.id,
          departmentId: clubForm.departmentId,
          facultyAdvisorId: user.id,
          autoJoin: clubForm.autoJoin,
          requireApproval: clubForm.requireApproval,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to submit request');
        return;
      }
      toast.success('Club creation request submitted! Awaiting HOD approval.');
      setClubDialogOpen(false);
      setClubForm({
        name: '',
        slug: '',
        description: '',
        category: 'OTHER',
        departmentId: user.departmentId || '',
        autoJoin: false,
        requireApproval: true,
      });
      // Refresh club requests
      const refreshRes = await fetch(`/api/clubs/creation-requests?requestedById=${user.id}`);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setClubRequests(refreshData.requests || []);
      }
    } catch {
      toast.error('Failed to submit request');
    }
    setIsSubmittingClub(false);
  };

  const handleAssignOrganizer = async (eventId: string) => {
    if (!user || !selectedStudentId) return;

    // Find or create an Organizer event role
    const existingRoles = eventRoles[eventId] || [];
    let organizerRole = existingRoles.find((r: any) =>
      r.name.toLowerCase().includes('organizer')
    );

    setIsAssigning(true);
    try {
      // If no Organizer role exists, create one
      if (!organizerRole) {
        const createRes = await fetch(`/api/events/${eventId}/roles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Organizer',
            description: 'Student organizer with event management permissions',
            permissions: ['CREATE_EVENT', 'EDIT_EVENT', 'MANAGE_REGISTRATIONS'],
            color: '#8b5cf6',
            userId: user.id,
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          toast.error(createData.error || 'Failed to create Organizer role');
          setIsAssigning(false);
          return;
        }
        organizerRole = createData.role;
        // Update local state
        setEventRoles(prev => ({
          ...prev,
          [eventId]: [...(prev[eventId] || []), organizerRole],
        }));
      }

      // Assign the student to the Organizer role
      const assignRes = await fetch(`/api/events/${eventId}/roles/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventRoleId: organizerRole.id,
          userId: selectedStudentId,
          assignedBy: user.id,
        }),
      });
      const assignData = await assignRes.json();
      if (!assignRes.ok) {
        toast.error(assignData.error || 'Failed to assign organizer role');
        setIsAssigning(false);
        return;
      }
      toast.success('Student assigned as Organizer successfully!');
      setSelectedStudentId('');
      setAssigningEventId(null);
      // Refresh roles
      const rolesRes = await fetch(`/api/events/${eventId}/roles`);
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setEventRoles(prev => ({ ...prev, [eventId]: data.roles || [] }));
      }
    } catch {
      toast.error('Failed to assign organizer role');
    }
    setIsAssigning(false);
  };

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
      toast.success('PDF report downloaded!');
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
  const pendingClubRequests = clubRequests.filter(r => r.status === 'PENDING').length;

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
            <h1 className="text-2xl font-bold">Event Dashboard</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              <Zap className="w-2.5 h-2.5 mr-1" /> {user?.role}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Manage your events, clubs, and student organizers</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {user?.role === 'FACULTY' && (
            <Dialog open={clubDialogOpen} onOpenChange={setClubDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-primary/30 hover:bg-primary/5 shadow-md">
                  <Building2 className="w-4 h-4 mr-2" /> Request Club
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    Request New Club
                  </DialogTitle>
                  <DialogDescription>
                    Submit a club creation request to your department HOD for approval.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="club-name">Club Name *</Label>
                    <Input
                      id="club-name"
                      placeholder="e.g., AI & Machine Learning Club"
                      value={clubForm.name}
                      onChange={(e) => handleClubFormChange('name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="club-slug">Slug</Label>
                    <Input
                      id="club-slug"
                      placeholder="auto-generated-from-name"
                      value={clubForm.slug}
                      onChange={(e) => handleClubFormChange('slug', e.target.value)}
                      className="text-muted-foreground"
                    />
                    <p className="text-[10px] text-muted-foreground">Auto-generated from club name. You can customize it.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="club-desc">Description *</Label>
                    <Textarea
                      id="club-desc"
                      placeholder="Describe the club's purpose and activities..."
                      value={clubForm.description}
                      onChange={(e) => handleClubFormChange('description', e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={clubForm.category}
                        onValueChange={(v) => handleClubFormChange('category', v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {eventCategories.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Department *</Label>
                      <Select
                        value={clubForm.departmentId || user?.departmentId || ''}
                        onValueChange={(v) => handleClubFormChange('departmentId', v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name} ({dept.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-join">Auto-Join</Label>
                      <p className="text-[10px] text-muted-foreground">Students can join without approval</p>
                    </div>
                    <Switch
                      id="auto-join"
                      checked={clubForm.autoJoin}
                      onCheckedChange={(v) => handleClubFormChange('autoJoin', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="require-approval">Require Approval</Label>
                      <p className="text-[10px] text-muted-foreground">Students need club approval to join</p>
                    </div>
                    <Switch
                      id="require-approval"
                      checked={clubForm.requireApproval}
                      onCheckedChange={(v) => handleClubFormChange('requireApproval', v)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setClubDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={handleSubmitClubRequest}
                    disabled={isSubmittingClub}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isSubmittingClub ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                    ) : (
                      <><Building2 className="w-4 h-4 mr-2" /> Submit Request</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button onClick={() => navigate('create-event')} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
            <PlusCircle className="w-4 h-4 mr-2" /> New Event
          </Button>
        </div>
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

      {/* My Clubs Section */}
      {user && (() => {
        const myClubs = clubs.filter((c: any) =>
          c.facultyAdvisorId === user.id || c.members?.some((m: any) => m.userId === user.id)
        );
        return myClubs.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" /> My Clubs
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => navigate('clubs')}
              >
                All Clubs <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myClubs.map((club: any, i: number) => {
                const isAdvisor = club.facultyAdvisorId === user.id;
                const memberCount = club._count?.members || club.members?.length || 0;
                const eventCount = club._count?.events || 0;
                return (
                  <motion.div
                    key={club.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -3 }}
                  >
                    <Card
                      className="cursor-pointer hover:shadow-md transition-all border-border/50 hover:border-primary/20"
                      onClick={() => navigate('club-detail', club.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-primary/80 to-primary/60 flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {club.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-medium text-sm truncate">{club.name}</h3>
                              {isAdvisor && (
                                <Badge className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
                                  <Crown className="w-2.5 h-2.5 mr-0.5" /> Advisor
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">{club.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> {memberCount} members
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> {eventCount} events
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : null;
      })()}

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

      {/* My Club Requests section - Replaces "My Events" */}
      {user?.role === 'FACULTY' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> My Club Requests
            </h2>
            {pendingClubRequests > 0 && (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                <Clock className="w-3 h-3 mr-1" /> {pendingClubRequests} pending
              </Badge>
            )}
          </div>

          {clubRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <motion.div
                    className="absolute inset-0 rounded-xl border-2 border-dashed border-primary/20"
                    animate={{ rotate: [0, 90, 180, 270, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  />
                  <Building2 className="w-6 h-6 text-muted-foreground/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">No club requests yet</p>
                <p className="text-xs text-muted-foreground/70 mb-3">Request a new club for your department</p>
                <Button
                  size="sm"
                  onClick={() => setClubDialogOpen(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Building2 className="w-3.5 h-3.5 mr-1.5" /> Request Club
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatePresence>
                {clubRequests.map((req, i) => {
                  const statusCfg = clubRequestStatusConfig[req.status] || clubRequestStatusConfig.PENDING;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="hover:shadow-md transition-all duration-300 border-border/50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">{req.name}</h3>
                              <p className="text-xs text-muted-foreground">{req.department?.name || 'Unknown Department'}</p>
                            </div>
                            <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusCfg.color}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusCfg.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground/80 line-clamp-2 mb-2">{req.description}</p>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="capitalize">{req.category?.toLowerCase()}</span>
                            {req.autoJoin && (
                              <span className="text-emerald-600">Auto-join</span>
                            )}
                          </div>
                          {req.status === 'REJECTED' && req.rejectionReason && (
                            <div className="mt-2 p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                              <p className="text-xs text-red-700 dark:text-red-300">
                                <span className="font-medium">Reason:</span> {req.rejectionReason}
                              </p>
                            </div>
                          )}
                          {req.status === 'APPROVED' && (
                            <div className="mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-primary hover:text-primary/80 p-0 h-auto"
                                onClick={() => {
                                  const club = clubs.find((c: any) => c.name === req.name);
                                  if (club) navigate('club-detail', club.id);
                                }}
                              >
                                View Club <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}

      {/* Assign Student Organizer section */}
      {events.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Assign Student Organizers
            </h2>
          </div>

          <div className="space-y-4">
            {events.filter(e => e.clubId).map((event, i) => {
              const members = eventMembers[event.id] || [];
              const roles = eventRoles[event.id] || [];
              const organizerRole = roles.find((r: any) => r.name.toLowerCase().includes('organizer'));
              const assignedOrganizers = organizerRole?.assignments || [];
              const isExpanded = assigningEventId === event.id;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Crown className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium truncate text-sm">{event.title}</h3>
                            <p className="text-[10px] text-muted-foreground">
                              {members.length} club members
                              {assignedOrganizers.length > 0 && ` · ${assignedOrganizers.length} organizer${assignedOrganizers.length > 1 ? 's' : ''} assigned`}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs shrink-0"
                          onClick={() => setAssigningEventId(isExpanded ? null : event.id)}
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                          {isExpanded ? 'Close' : 'Assign'}
                        </Button>
                      </div>

                      {/* Currently assigned organizers */}
                      {assignedOrganizers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {assignedOrganizers.map((a: any) => (
                            <Badge key={a.id} variant="secondary" className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                              <Crown className="w-2.5 h-2.5 mr-1" />
                              {a.user?.name || 'Unknown'}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Assignment form */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <Separator className="mb-3" />
                            <div className="flex items-end gap-2">
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs">Select Student</Label>
                                <Select
                                  value={selectedStudentId}
                                  onValueChange={setSelectedStudentId}
                                >
                                  <SelectTrigger className="w-full h-9 text-xs">
                                    <SelectValue placeholder="Choose a club member..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {members.length === 0 ? (
                                      <SelectItem value="none" disabled>No members available</SelectItem>
                                    ) : (
                                      members.map((m: any) => (
                                        <SelectItem key={m.userId || m.id} value={m.userId || m.id}>
                                          {m.user?.name || 'Unknown'} {m.role !== 'member' ? `(${m.role})` : ''}
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                size="sm"
                                className="bg-primary hover:bg-primary/90 shrink-0"
                                disabled={!selectedStudentId || selectedStudentId === 'none' || isAssigning}
                                onClick={() => handleAssignOrganizer(event.id)}
                              >
                                {isAssigning ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <><UserPlus className="w-3.5 h-3.5 mr-1.5" /> Assign</>
                                )}
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2">
                              Assigning Organizer role with permissions: Create Event, Edit Event, Manage Registrations
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {events.filter(e => e.clubId).length === 0 && (
            <Card>
              <CardContent className="py-10 text-center">
                <Shield className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No club events to assign organizers</p>
                <p className="text-xs text-muted-foreground/70">Create events under a club to assign student organizers</p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* Events Quick Access */}
      {events.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Events Quick Access
            </h2>
            <span className="text-xs text-muted-foreground">{events.length} total</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {events.slice(0, 6).map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.02 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-all border-border/50 hover:border-primary/20"
                  onClick={() => navigate('event-detail', event.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-medium text-sm truncate">{event.title}</h3>
                      <Badge variant="secondary" className={`text-[9px] shrink-0 ${statusColors[event.status] || ''}`}>
                        {event.status === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 animate-pulse" />}
                        {event.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{new Date(event.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      <span>{event.venue}</span>
                      <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{event._count?.registrations || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      {(event.status === 'APPROVED' || event.status === 'LIVE' || event.status === 'COMPLETED') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-6 px-2"
                          onClick={(e) => { e.stopPropagation(); generateReport(event.id, event.title); }}
                        >
                          <Download className="w-2.5 h-2.5 mr-1" /> Report
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] h-6 px-2"
                        onClick={(e) => { e.stopPropagation(); navigate('event-detail', event.id); }}
                      >
                        <Eye className="w-2.5 h-2.5 mr-1" /> View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
