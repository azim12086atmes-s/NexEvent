'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  Shield, CheckCircle2, XCircle, Clock, Calendar, Users,
  BarChart3, Loader2, Eye, Activity, Sparkles, AlertTriangle,
  Upload, Building2, UserCog, FileSpreadsheet, Search,
  ChevronDown, GraduationCap, UserCheck, UserX, PlusCircle,
  Trash2, Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
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

const roleColors: Record<string, string> = {
  ADMIN: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  HOD: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  FACULTY: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  STUDENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  OTHER: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const approvalColors: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export function AdminPanel() {
  const { user } = useAuthStore();
  const { navigate } = useUIStore();

  // Event approval state
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // User management state
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userApprovalFilter, setUserApprovalFilter] = useState<string>('all');
  const [userDeptFilter, setUserDeptFilter] = useState<string>('all');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Department state
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoadingDepts, setIsLoadingDepts] = useState(false);
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', code: '', description: '' });
  const [assignHodDeptId, setAssignHodDeptId] = useState<string | null>(null);
  const [selectedHodId, setSelectedHodId] = useState('');

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvType, setCsvType] = useState<'students' | 'faculty'>('students');
  const [isUploading, setIsUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<any>(null);

  // Global loading
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('events');

  const loadEvents = useCallback(async () => {
    if (!user) return;
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
  }, [user]);

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (userRoleFilter !== 'all') params.set('role', userRoleFilter);
      if (userApprovalFilter !== 'all') params.set('approvalStatus', userApprovalFilter);
      if (userDeptFilter !== 'all') params.set('departmentId', userDeptFilter);
      if (userSearch) params.set('search', userSearch);
      params.set('limit', '100');
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) { const d = await res.json(); setUsers(d.users || []); }
    } catch {}
    setIsLoadingUsers(false);
  }, [userRoleFilter, userApprovalFilter, userDeptFilter, userSearch]);

  const loadDepartments = useCallback(async () => {
    setIsLoadingDepts(true);
    try {
      const res = await fetch('/api/admin/departments');
      if (res.ok) { const d = await res.json(); setDepartments(d.departments || []); }
    } catch {}
    setIsLoadingDepts(false);
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await loadEvents();
      setIsLoading(false);
    };
    if (user) load();
  }, [user, loadEvents]);

  // Load data when switching tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'users') loadUsers();
    if (tab === 'departments') loadDepartments();
  };

  // Event approval handler
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
      setAllEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: action === 'approve' ? 'APPROVED' : 'REJECTED' } : e));
    } catch { toast.error('Action failed'); }
  };

  // User management handlers
  const handleUserAction = async (targetUserId: string, updates: any) => {
    if (!user) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, targetUserId, ...updates }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success('User updated successfully');
      loadUsers();
    } catch { toast.error('Update failed'); }
  };

  // CSV upload handler
  const handleCSVUpload = async () => {
    if (!csvFile || !user) return;
    setIsUploading(true);
    setCsvResult(null);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('type', csvType);
      formData.append('adminId', user.id);
      const res = await fetch('/api/admin/csv-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      setCsvResult(data.results);
      toast.success(data.message);
      setCsvFile(null);
      loadUsers();
    } catch { toast.error('Upload failed'); }
    setIsUploading(false);
  };

  // Department handlers
  const handleCreateDept = async () => {
    if (!user || !newDept.name || !newDept.code) return;
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...newDept }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success('Department created!');
      setShowCreateDept(false);
      setNewDept({ name: '', code: '', description: '' });
      loadDepartments();
    } catch { toast.error('Failed to create department'); }
  };

  const handleAssignHod = async (deptId: string) => {
    if (!user || !selectedHodId) return;
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, departmentId: deptId, hodId: selectedHodId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success('HOD assigned!');
      setAssignHodDeptId(null);
      setSelectedHodId('');
      loadDepartments();
    } catch { toast.error('Failed to assign HOD'); }
  };

  if (!user || (user.role !== 'FACULTY' && user.role !== 'ADMIN' && user.role !== 'HOD')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-lg font-medium">Access Restricted</p>
          <p className="text-sm text-muted-foreground">Only faculty, HODs, and admins can access this panel.</p>
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

  const filteredEvents = statusFilter === 'all' ? allEvents : allEvents.filter(e => e.status === statusFilter);

  const statCards = [
    { label: 'Total Events', value: stats?.totalEvents || 0, icon: Calendar, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30', sub: 'All time' },
    { label: 'Active Now', value: stats?.activeEvents || 0, icon: Activity, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30', sub: 'Approved or Live' },
    { label: 'Pending Review', value: stats?.pendingApprovals || 0, icon: Clock, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30', sub: pendingEvents.length > 0 ? 'Needs attention' : 'All caught up' },
    { label: 'Registrations', value: stats?.totalRegistrations || 0, icon: Users, color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30', sub: 'Campus-wide' },
  ];

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Admin Panel
          </h1>
          <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 text-xs">{user.role}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Review events, manage users, and configure departments</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCards.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1, type: 'spring' }} whileHover={{ y: -3 }}>
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center`}><s.icon className="w-5 h-5" /></div>
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

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="events" className="text-xs sm:text-sm">
            <Calendar className="w-4 h-4 mr-1 hidden sm:inline" /> Events
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm">
            <UserCog className="w-4 h-4 mr-1 hidden sm:inline" /> Users
          </TabsTrigger>
          <TabsTrigger value="csv" className="text-xs sm:text-sm">
            <FileSpreadsheet className="w-4 h-4 mr-1 hidden sm:inline" /> CSV Upload
          </TabsTrigger>
          <TabsTrigger value="departments" className="text-xs sm:text-sm">
            <Building2 className="w-4 h-4 mr-1 hidden sm:inline" /> Departments
          </TabsTrigger>
        </TabsList>

        {/* ========== EVENTS TAB ========== */}
        <TabsContent value="events">
          {/* Pending Approvals */}
          <div className="mb-8">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Pending Approvals
              {pendingEvents.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">{pendingEvents.length}</Badge>
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
                    <motion.div key={event.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: i * 0.05 }}>
                      <Card className="border-amber-200/80 dark:border-amber-800/50 hover:shadow-lg transition-all duration-300">
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
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(event.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
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
                              <Button size="sm" className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20" onClick={() => handleApproval(event.id, 'approve')}>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                              </Button>
                              <Button variant="destructive" size="sm" className="flex-1 sm:flex-none" onClick={() => handleApproval(event.id, 'reject')}>
                                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                              </Button>
                              <Button variant="ghost" size="sm" className="flex-1 sm:flex-none" onClick={() => navigate('event-detail', event.id)}>
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
          </div>

          {/* All Events */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> All Events</h2>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Filter status" /></SelectTrigger>
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
                <motion.div key={event.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className="hover:shadow-md transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/20" onClick={() => navigate('event-detail', event.id)}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm">{categoryIcons[event.category] || '📌'}</span>
                        <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColors[event.status] || ''}`}>{event.status}</Badge>
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
          </div>
        </TabsContent>

        {/* ========== USERS TAB ========== */}
        <TabsContent value="users">
          {!isAdmin ? (
            <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50">
              <CardContent className="py-8 text-center">
                <Shield className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Admin Only</p>
                <p className="text-xs text-muted-foreground">User management requires admin role.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search by name or email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-9 h-8 text-sm" />
                </div>
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="HOD">HOD</SelectItem>
                    <SelectItem value="FACULTY">Faculty</SelectItem>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={userApprovalFilter} onValueChange={setUserApprovalFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={userDeptFilter} onValueChange={setUserDeptFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Depts</SelectItem>
                    {departments.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User count */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{users.length} users found</p>
                <Button variant="outline" size="sm" className="text-xs" onClick={loadUsers}>
                  <Loader2 className={`w-3 h-3 mr-1 ${isLoadingUsers ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>

              {/* User list */}
              {isLoadingUsers ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {users.map((u, i) => (
                    <motion.div key={u.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                      <Card className="hover:shadow-md transition-all duration-200 border-border/50">
                        <CardContent className="p-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            {/* User info */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                                {u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium truncate">{u.name}</span>
                                  <Badge className={`text-[9px] ${roleColors[u.role] || roleColors.OTHER}`}>{u.role}</Badge>
                                  <Badge className={`text-[9px] ${approvalColors[u.approvalStatus] || ''}`}>{u.approvalStatus}</Badge>
                                  {!u.isActive && <Badge className="text-[9px] bg-gray-100 text-gray-500">Inactive</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{u.email}{u.usn ? ` • ${u.usn}` : ''}{u.department ? ` • ${u.department.code}` : ''}</p>
                                <p className="text-[10px] text-muted-foreground"><Award className="w-2.5 h-2.5 inline mr-0.5" />{u.aictePoints} AICTE pts • {u._count?.registrations || 0} events • {u._count?.clubMemberships || 0} clubs</p>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {u.approvalStatus === 'PENDING' && (
                                <>
                                  <Button size="sm" variant="outline" className="text-[10px] h-7 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200" onClick={() => handleUserAction(u.id, { approvalStatus: 'APPROVED' })}>
                                    <UserCheck className="w-3 h-3 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-[10px] h-7 bg-red-50 hover:bg-red-100 text-red-700 border-red-200" onClick={() => handleUserAction(u.id, { approvalStatus: 'REJECTED' })}>
                                    <UserX className="w-3 h-3 mr-1" /> Reject
                                  </Button>
                                </>
                              )}
                              <Select onValueChange={(role) => handleUserAction(u.id, { role })}>
                                <SelectTrigger className="w-[90px] h-7 text-[10px]"><SelectValue placeholder="Set Role" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="OTHER">Other</SelectItem>
                                  <SelectItem value="STUDENT">Student</SelectItem>
                                  <SelectItem value="FACULTY">Faculty</SelectItem>
                                  <SelectItem value="HOD">HOD</SelectItem>
                                  {isAdmin && <SelectItem value="ADMIN">Admin</SelectItem>}
                                </SelectContent>
                              </Select>
                              <Select onValueChange={(deptId) => handleUserAction(u.id, { departmentId: deptId === '_none' ? null : deptId })}>
                                <SelectTrigger className="w-[90px] h-7 text-[10px]"><SelectValue placeholder="Dept" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_none">None</SelectItem>
                                  {departments.map((d: any) => (
                                    <SelectItem key={d.id} value={d.id}>{d.code}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant={u.isActive ? "outline" : "default"} className="text-[10px] h-7" onClick={() => handleUserAction(u.id, { isActive: !u.isActive })}>
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ========== CSV UPLOAD TAB ========== */}
        <TabsContent value="csv">
          {!isAdmin ? (
            <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50">
              <CardContent className="py-8 text-center">
                <Shield className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Admin Only</p>
                <p className="text-xs text-muted-foreground">CSV upload requires admin role.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Upload Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" /> Upload CSV
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">CSV Type</Label>
                    <Select value={csvType} onValueChange={(v: any) => setCsvType(v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="students">Students CSV</SelectItem>
                        <SelectItem value="faculty">Faculty / HOD CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">CSV File</Label>
                    <div
                      className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all"
                      onClick={() => document.getElementById('csv-file-input')?.click()}
                    >
                      <FileSpreadsheet className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-sm font-medium">{csvFile ? csvFile.name : 'Click to select CSV file'}</p>
                      <p className="text-xs text-muted-foreground mt-1">{csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : 'Supports .csv files'}</p>
                    </div>
                    <input id="csv-file-input" type="file" accept=".csv" className="hidden" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
                  </div>

                  <Button className="w-full" disabled={!csvFile || isUploading} onClick={handleCSVUpload}>
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    {isUploading ? 'Processing...' : 'Upload & Process'}
                  </Button>
                </CardContent>
              </Card>

              {/* Format Guide + Results */}
              <div className="space-y-4">
                <Card className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-primary" /> CSV Format
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-medium mb-1">Students CSV:</p>
                      <code className="text-[10px] bg-muted p-2 rounded block">email, name, usn, department_code</code>
                      <code className="text-[10px] bg-muted p-2 rounded block mt-1">aditi.n@vvce.ac.in, Aditi N, 4VV22CS001, CS</code>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1">Faculty/HOD CSV:</p>
                      <code className="text-[10px] bg-muted p-2 rounded block">email, name, role, department_code</code>
                      <code className="text-[10px] bg-muted p-2 rounded block mt-1">priya.sharma@vvce.ac.in, Dr. Priya Sharma, FACULTY, CS</code>
                      <code className="text-[10px] bg-muted p-2 rounded block mt-1">kavitha.raj@vvce.ac.in, Dr. Kavitha Raj, HOD, CS</code>
                    </div>
                    <p className="text-[10px] text-muted-foreground">• Existing users will have their role & department updated<br/>• New users will be created with default password = email prefix<br/>• All CSV-imported users are auto-approved</p>
                  </CardContent>
                </Card>

                {/* Upload Results */}
                {csvResult && (
                  <Card className={csvResult.errors?.length > 0 ? 'border-amber-200' : 'border-emerald-200'}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        {csvResult.errors?.length > 0 ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        Upload Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                          <p className="text-lg font-bold text-emerald-700">{csvResult.updated || 0}</p>
                          <p className="text-[10px] text-muted-foreground">Updated</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                          <p className="text-lg font-bold text-blue-700">{csvResult.created || 0}</p>
                          <p className="text-[10px] text-muted-foreground">Created</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                          <p className="text-lg font-bold text-amber-700">{csvResult.errors?.length || 0}</p>
                          <p className="text-[10px] text-muted-foreground">Errors</p>
                        </div>
                      </div>
                      {csvResult.errors?.length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {csvResult.errors.map((err: string, i: number) => (
                            <p key={i} className="text-[10px] text-amber-600">{err}</p>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ========== DEPARTMENTS TAB ========== */}
        <TabsContent value="departments">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" /> Departments</h2>
            {isAdmin && (
              <Button size="sm" onClick={() => { loadDepartments(); setShowCreateDept(true); }}>
                <PlusCircle className="w-3.5 h-3.5 mr-1" /> Create Department
              </Button>
            )}
          </div>

          {isLoadingDepts ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept: any, i: number) => (
                <motion.div key={dept.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="hover:shadow-lg transition-shadow border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {dept.code}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{dept.name}</h3>
                          <p className="text-xs text-muted-foreground">Code: {dept.code}</p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="text-center p-1.5 rounded-lg bg-muted/30">
                          <p className="text-sm font-bold">{dept._count?.users || 0}</p>
                          <p className="text-[9px] text-muted-foreground">Users</p>
                        </div>
                        <div className="text-center p-1.5 rounded-lg bg-muted/30">
                          <p className="text-sm font-bold">{dept._count?.clubs || 0}</p>
                          <p className="text-[9px] text-muted-foreground">Clubs</p>
                        </div>
                        <div className="text-center p-1.5 rounded-lg bg-muted/30">
                          <p className="text-sm font-bold">{dept._count?.events || 0}</p>
                          <p className="text-[9px] text-muted-foreground">Events</p>
                        </div>
                      </div>

                      {/* HOD info */}
                      <Separator className="mb-3" />
                      {dept.hod ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[9px] font-semibold text-amber-700">
                            {dept.hod.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{dept.hod.name}</p>
                            <p className="text-[10px] text-muted-foreground">HOD</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No HOD assigned</p>
                      )}

                      {/* Assign HOD button */}
                      {isAdmin && (
                        <div className="mt-3">
                          {assignHodDeptId === dept.id ? (
                            <div className="flex gap-2">
                              <Select value={selectedHodId} onValueChange={setSelectedHodId}>
                                <SelectTrigger className="h-7 text-[10px] flex-1"><SelectValue placeholder="Select HOD user" /></SelectTrigger>
                                <SelectContent>
                                  {users.filter((u: any) => u.role === 'HOD' || u.role === 'FACULTY').map((u: any) => (
                                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button size="sm" className="text-[10px] h-7" onClick={() => handleAssignHod(dept.id)} disabled={!selectedHodId}>Assign</Button>
                              <Button size="sm" variant="ghost" className="text-[10px] h-7" onClick={() => { setAssignHodDeptId(null); setSelectedHodId(''); }}>Cancel</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="text-[10px] w-full h-7" onClick={() => { setAssignHodDeptId(dept.id); setSelectedHodId(''); loadUsers(); }}>
                              Assign HOD
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* Create Department Dialog */}
          <Dialog open={showCreateDept} onOpenChange={setShowCreateDept}>
            <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>Create Department</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Department Name</Label>
                  <Input placeholder="Computer Science" value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Department Code</Label>
                  <Input placeholder="CS" value={newDept.code} onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })} className="h-9" maxLength={5} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Description (optional)</Label>
                  <Input placeholder="Department of Computer Science & Engineering" value={newDept.description} onChange={(e) => setNewDept({ ...newDept, description: e.target.value })} className="h-9" />
                </div>
                <Button className="w-full" onClick={handleCreateDept} disabled={!newDept.name || !newDept.code}>
                  <PlusCircle className="w-4 h-4 mr-2" /> Create Department
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
