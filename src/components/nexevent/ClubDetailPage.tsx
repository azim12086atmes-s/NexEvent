'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { useClubStore, Club, ClubRole, ClubAchievement } from '@/store/club-store';
import {
  ArrowLeft, Crown, Users, Calendar, Star, Trophy, Target, Eye,
  Pencil, Plus, Shield, ChevronRight, ExternalLink, Mail, Phone,
  Globe, Trash2, UserPlus, UserMinus, Loader2, Award, Sparkles,
  CheckCircle2, XCircle, AlertCircle, Edit3, BookOpen, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const categoryColors: Record<string, string> = {
  TECHNICAL: 'from-cyan-500 to-blue-600',
  CULTURAL: 'from-rose-500 to-pink-600',
  SPORTS: 'from-green-500 to-lime-600',
  SOCIAL: 'from-fuchsia-500 to-purple-600',
  OTHER: 'from-gray-500 to-gray-600',
};

const categoryIcons: Record<string, string> = {
  TECHNICAL: '⚡', CULTURAL: '🎭', SPORTS: '🏆', SOCIAL: '🌱', OTHER: '📌',
};

const ALL_PERMISSIONS = [
  { id: 'EDIT_CLUB_PAGE', label: 'Edit Club Page', icon: Pencil, desc: 'Can modify club page content, mission, vision' },
  { id: 'CREATE_CLUB_EVENT', label: 'Create Events', icon: Calendar, desc: 'Can create events on behalf of the club' },
  { id: 'MANAGE_MEMBERS', label: 'Manage Members', icon: Users, desc: 'Can approve/remove club members' },
  { id: 'MANAGE_ROLES', label: 'Manage Roles', icon: Shield, desc: 'Can create and assign roles' },
  { id: 'VIEW_ANALYTICS', label: 'View Analytics', icon: Eye, desc: 'Can view club analytics and reports' },
  { id: 'MANAGE_ACHIEVEMENTS', label: 'Manage Achievements', icon: Trophy, desc: 'Can add/edit achievements' },
];

export function ClubDetailPage() {
  const { user, isAuthenticated } = useAuthStore();
  const { navigate, selectedClubId } = useUIStore();
  const { currentClub, isLoading, fetchClubById, fetchClubs, joinClub, leaveClub, updateClubPage, createClubRole, deleteClubRole, assignClubRole, revokeClubRole, createAchievement, deleteAchievement } = useClubStore();
  const [activeTab, setActiveTab] = useState<'about' | 'roles' | 'achievements'>('about');
  const [showEditPage, setShowEditPage] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showAddAchievement, setShowAddAchievement] = useState(false);
  const [showAssignRole, setShowAssignRole] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ mission: '', vision: '', highlights: '', contactEmail: '', contactPhone: '' });
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: [] as string[], color: '#6366f1' });
  const [achievementForm, setAchievementForm] = useState({ title: '', description: '', icon: '🏆', category: 'award' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedClubId) fetchClubById(selectedClubId);
  }, [selectedClubId, fetchClubById]);

  // Derive isMember and userPermissions from currentClub and user (no setState in effect)
  const isMember = useMemo(() => {
    if (!currentClub || !user) return false;
    return !!currentClub.members?.find((m: any) => m.userId === user.id);
  }, [currentClub, user]);

  const userPermissions = useMemo(() => {
    if (!currentClub || !user) return [];
    const perms = new Set<string>();
    const membership = currentClub.members?.find((m: any) => m.userId === user.id);
    if (user.role === 'ADMIN' || currentClub.facultyAdvisorId === user.id) {
      ALL_PERMISSIONS.forEach(p => perms.add(p.id));
    } else if (membership && ['president', 'secretary'].includes(membership.role)) {
      ['EDIT_CLUB_PAGE', 'CREATE_CLUB_EVENT', 'VIEW_ANALYTICS', 'MANAGE_ACHIEVEMENTS'].forEach(p => perms.add(p));
    }
    currentClub.roleAssignments?.filter((a: any) => a.userId === user.id).forEach((a: any) => {
      try { JSON.parse(a.role?.permissions || '[]').forEach((p: string) => perms.add(p)); } catch {}
    });
    return Array.from(perms);
  }, [currentClub, user]);

  const canEditPage = userPermissions.includes('EDIT_CLUB_PAGE') || user?.role === 'ADMIN' || currentClub?.facultyAdvisorId === user?.id;
  const canManageRoles = userPermissions.includes('MANAGE_ROLES') || user?.role === 'ADMIN' || currentClub?.facultyAdvisorId === user?.id;
  const canManageAchievements = userPermissions.includes('MANAGE_ACHIEVEMENTS') || user?.role === 'ADMIN' || currentClub?.facultyAdvisorId === user?.id;

  const handleJoin = async () => {
    if (!currentClub) return;
    try { await joinClub(currentClub.id); fetchClubs(); toast.success('Joined club! 🎉'); }
    catch (e: any) { toast.error(e.message || 'Failed to join'); }
  };

  const handleLeave = async () => {
    if (!currentClub) return;
    try { await leaveClub(currentClub.id); fetchClubs(); toast.success('Left club'); }
    catch (e: any) { toast.error(e.message || 'Failed to leave'); }
  };

  const handleSavePage = async () => {
    if (!currentClub) return;
    setSaving(true);
    try {
      await updateClubPage(currentClub.id, editForm);
      toast.success('Club page updated!');
      setShowEditPage(false);
    } catch (e: any) { toast.error(e.message || 'Failed to update'); }
    setSaving(false);
  };

  const handleCreateRole = async () => {
    if (!currentClub || !roleForm.name) return;
    setSaving(true);
    try {
      await createClubRole(currentClub.id, roleForm);
      toast.success('Role created!');
      setShowCreateRole(false);
      setRoleForm({ name: '', description: '', permissions: [], color: '#6366f1' });
    } catch (e: any) { toast.error(e.message || 'Failed to create role'); }
    setSaving(false);
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!currentClub) return;
    try {
      await deleteClubRole(currentClub.id, roleId);
      toast.success('Role deleted');
    } catch (e: any) { toast.error(e.message || 'Failed to delete'); }
  };

  const handleAssignRole = async (roleId: string, targetUserId: string) => {
    if (!currentClub) return;
    try {
      await assignClubRole(currentClub.id, roleId, targetUserId);
      toast.success('Role assigned!');
      setShowAssignRole(null);
    } catch (e: any) { toast.error(e.message || 'Failed to assign'); }
  };

  const handleRevokeRole = async (roleId: string, targetUserId: string) => {
    if (!currentClub) return;
    try {
      await revokeClubRole(currentClub.id, roleId, targetUserId);
      toast.success('Role revoked');
    } catch (e: any) { toast.error(e.message || 'Failed to revoke'); }
  };

  const handleAddAchievement = async () => {
    if (!currentClub || !achievementForm.title) return;
    setSaving(true);
    try {
      await createAchievement(currentClub.id, achievementForm);
      toast.success('Achievement added!');
      setShowAddAchievement(false);
      setAchievementForm({ title: '', description: '', icon: '🏆', category: 'award' });
    } catch (e: any) { toast.error(e.message || 'Failed to add'); }
    setSaving(false);
  };

  const handleDeleteAchievement = async (achievementId: string) => {
    if (!currentClub) return;
    try {
      await deleteAchievement(currentClub.id, achievementId);
      toast.success('Achievement removed');
    } catch (e: any) { toast.error(e.message || 'Failed to delete'); }
  };

  if (isLoading || !currentClub) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading club details...</p>
        </div>
      </div>
    );
  }

  const club = currentClub;
  const highlights: { title: string; description: string; icon: string }[] = (() => {
    try { return JSON.parse(club.highlights || '[]'); } catch { return []; }
  })();
  const socialLinks: { instagram?: string; twitter?: string; linkedin?: string; website?: string } = (() => {
    try { return JSON.parse(club.socialLinks || '{}'); } catch { return {}; }
  })();

  const tabs = [
    { id: 'about' as const, label: 'About', icon: BookOpen },
    { id: 'roles' as const, label: 'Roles & Team', icon: Shield },
    { id: 'achievements' as const, label: 'Achievements', icon: Trophy },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
        <button onClick={() => navigate('clubs')} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Clubs
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{club.name}</span>
      </motion.div>

      {/* Hero Banner */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className={`relative rounded-2xl overflow-hidden mb-6 p-6 sm:p-8 bg-gradient-to-br ${categoryColors[club.category] || categoryColors.OTHER}`}>
        <div className="absolute inset-0 dot-pattern opacity-10" />
        <motion.div className="absolute top-4 right-4 text-6xl opacity-20"
          animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 5, repeat: Infinity }}>
          {categoryIcons[club.category] || '📌'}
        </motion.div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge className="bg-white/20 text-white border-white/30 text-xs">{club.category}</Badge>
            {club.foundedYear && <Badge className="bg-white/10 text-white/70 border-white/20 text-xs">Est. {club.foundedYear}</Badge>}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{club.name}</h1>
          <p className="text-white/80 text-sm max-w-xl leading-relaxed">{club.description}</p>
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-white/70 text-sm">
              <Users className="w-4 h-4" /> {club._count?.members || club.members?.length || 0} members
            </span>
            <span className="flex items-center gap-1.5 text-white/70 text-sm">
              <Calendar className="w-4 h-4" /> {club._count?.events || club.events?.length || 0} events
            </span>
            {club.facultyAdvisor && (
              <span className="flex items-center gap-1.5 text-white/70 text-sm">
                <Crown className="w-4 h-4 text-amber-300" /> {club.facultyAdvisor.name}
              </span>
            )}
          </div>
          {isAuthenticated && (
            <div className="mt-5 flex gap-2">
              {isMember ? (
                <Button variant="outline" size="sm" className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white"
                  onClick={handleLeave}>
                  <UserMinus className="w-3.5 h-3.5 mr-1" /> Leave Club
                </Button>
              ) : (
                <Button size="sm" className="bg-white text-gray-900 hover:bg-white/90 shadow-lg"
                  onClick={handleJoin}>
                  <UserPlus className="w-3.5 h-3.5 mr-1" /> Join Club
                </Button>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex gap-1 mb-6 border-b border-border/50 pb-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="club-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
            )}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {activeTab === 'about' && (
          <motion.div key="about" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-6">
            {/* Mission & Vision */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="border-primary/10 hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Mission</CardTitle>
                </CardHeader>
                <CardContent>
                  {club.mission ? (
                    <p className="text-sm text-muted-foreground leading-relaxed">{club.mission}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground/50 italic">No mission statement set</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border-chart-2/10 hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Eye className="w-4 h-4 text-chart-2" /> Vision</CardTitle>
                </CardHeader>
                <CardContent>
                  {club.vision ? (
                    <p className="text-sm text-muted-foreground leading-relaxed">{club.vision}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground/50 italic">No vision statement set</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Highlights */}
            {highlights.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Highlights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {highlights.map((h, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                        <span className="text-2xl shrink-0">{h.icon || '✨'}</span>
                        <div>
                          <p className="text-sm font-medium">{h.title}</p>
                          <p className="text-xs text-muted-foreground">{h.description}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact & Social */}
            {(club.contactEmail || club.contactPhone || Object.keys(socialLinks).length > 0) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> Contact & Social</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {club.contactEmail && (
                      <a href={`mailto:${club.contactEmail}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                        <Mail className="w-3.5 h-3.5" /> {club.contactEmail}
                      </a>
                    )}
                    {club.contactPhone && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" /> {club.contactPhone}
                      </span>
                    )}
                    {socialLinks.website && (
                      <a href={socialLinks.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> Website
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Edit Page Button */}
            {canEditPage && (
              <div className="flex justify-center">
                <Dialog open={showEditPage} onOpenChange={(open) => {
                  setShowEditPage(open);
                  if (open && currentClub) {
                    setEditForm({
                      mission: currentClub.mission || '',
                      vision: currentClub.vision || '',
                      highlights: currentClub.highlights || '',
                      contactEmail: currentClub.contactEmail || '',
                      contactPhone: currentClub.contactPhone || '',
                    });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Club Page
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
                    <DialogHeader>
                      <DialogTitle>Edit Club Page</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Mission</Label>
                        <Textarea placeholder="What does this club stand for?" value={editForm.mission}
                          onChange={(e) => setEditForm({ ...editForm, mission: e.target.value })} rows={3} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Vision</Label>
                        <Textarea placeholder="Where is this club heading?" value={editForm.vision}
                          onChange={(e) => setEditForm({ ...editForm, vision: e.target.value })} rows={3} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Highlights (JSON)</Label>
                        <Textarea placeholder='[{"title":"Example","description":"Desc","icon":"🏆"}]'
                          value={editForm.highlights}
                          onChange={(e) => setEditForm({ ...editForm, highlights: e.target.value })} rows={4} className="font-mono text-xs" />
                        <p className="text-[10px] text-muted-foreground">Format: array of {"{title, description, icon}"}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Contact Email</Label>
                          <Input placeholder="club@vvce.ac.in" value={editForm.contactEmail}
                            onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Contact Phone</Label>
                          <Input placeholder="+91..." value={editForm.contactPhone}
                            onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })} />
                        </div>
                      </div>
                      <Button onClick={handleSavePage} disabled={saving} className="w-full">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Save Changes
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Members List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Members ({club.members?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent className="max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {club.members?.map((m: any, i: number) => (
                    <motion.div key={m.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                          {m.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{m.user.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {m.role === 'president' && <Crown className="w-2.5 h-2.5 mr-0.5 text-amber-500" />}
                          {m.role}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'roles' && (
          <motion.div key="roles" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Club Roles</h2>
              {canManageRoles && (
                <Dialog open={showCreateRole} onOpenChange={setShowCreateRole}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Create Role</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
                    <DialogHeader>
                      <DialogTitle>Create Club Role</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Role Name *</Label>
                        <Input placeholder="e.g., Event Coordinator" value={roleForm.name}
                          onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Description</Label>
                        <Input placeholder="What does this role do?" value={roleForm.description}
                          onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Color</Label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={roleForm.color} onChange={(e) => setRoleForm({ ...roleForm, color: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer" />
                          <span className="text-xs text-muted-foreground">{roleForm.color}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Permissions</Label>
                        <p className="text-[10px] text-muted-foreground">
                          ⚠️ You can only grant permissions that you yourself have. Violations will be rejected.
                        </p>
                        <div className="space-y-2">
                          {ALL_PERMISSIONS.map(perm => {
                            const youHave = userPermissions.includes(perm.id);
                            const selected = roleForm.permissions.includes(perm.id);
                            return (
                              <div key={perm.id}
                                className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${
                                  selected ? 'border-primary/30 bg-primary/5' : 'border-border/50'
                                } ${!youHave ? 'opacity-50' : ''}`}>
                                <Switch checked={selected}
                                  onCheckedChange={(checked) => {
                                    if (checked && !youHave) {
                                      toast.error(`You don't have the "${perm.label}" permission yourself`);
                                      return;
                                    }
                                    setRoleForm({
                                      ...roleForm,
                                      permissions: checked
                                        ? [...roleForm.permissions, perm.id]
                                        : roleForm.permissions.filter(p => p !== perm.id),
                                    });
                                  }}
                                  disabled={!youHave} />
                                <div className="flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <perm.icon className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="text-xs font-medium">{perm.label}</span>
                                    {!youHave && <AlertCircle className="w-3 h-3 text-amber-500" />}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{perm.desc}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <Button onClick={handleCreateRole} disabled={saving || !roleForm.name} className="w-full">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        Create Role
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {club.roles && club.roles.length > 0 ? (
              <div className="space-y-3">
                {club.roles.map((role: ClubRole, i: number) => {
                  const rolePerms: string[] = (() => { try { return JSON.parse(role.permissions); } catch { return []; } })();
                  return (
                    <motion.div key={role.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color || '#6366f1' }} />
                              <h3 className="font-semibold text-sm">{role.name}</h3>
                              {role.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                            </div>
                            {canManageRoles && !role.isDefault && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteRole(role.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                          {role.description && <p className="text-xs text-muted-foreground mb-2">{role.description}</p>}
                          <div className="flex flex-wrap gap-1 mb-3">
                            {rolePerms.map(p => {
                              const permDef = ALL_PERMISSIONS.find(pp => pp.id === p);
                              return (
                                <Badge key={p} variant="outline" className="text-[10px]">
                                  {permDef?.label || p}
                                </Badge>
                              );
                            })}
                          </div>
                          {/* Assigned users */}
                          {role.assignments && role.assignments.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-border/30">
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Assigned to</p>
                              {role.assignments.map((a: any) => (
                                <div key={a.id} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary">
                                      {a.user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '??'}
                                    </div>
                                    <span className="text-xs font-medium">{a.user?.name || 'Unknown'}</span>
                                  </div>
                                  {canManageRoles && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleRevokeRole(role.id, a.userId)}>
                                      <XCircle className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Assign member button */}
                          {canManageRoles && (
                            <Dialog open={showAssignRole === role.id} onOpenChange={(open) => setShowAssignRole(open ? role.id : null)}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full mt-2 text-xs">
                                  <UserPlus className="w-3 h-3 mr-1" /> Assign Member
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-sm" aria-describedby={undefined}>
                                <DialogHeader>
                                  <DialogTitle>Assign &quot;{role.name}&quot;</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-1.5 max-h-60 overflow-y-auto pt-2">
                                  {club.members?.filter((m: any) => !role.assignments?.some((a: any) => a.userId === m.userId)).map((m: any) => (
                                    <button key={m.userId}
                                      onClick={() => handleAssignRole(role.id, m.userId)}
                                      className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-muted/50 transition-colors text-left">
                                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                                        {m.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">{m.user.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{m.role}</p>
                                      </div>
                                    </button>
                                  ))}
                                  {club.members?.filter((m: any) => !role.assignments?.some((a: any) => a.userId === m.userId)).length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-4">All members already assigned or no members available</p>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No custom roles created yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Club owners and faculty can create roles with specific permissions</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === 'achievements' && (
          <motion.div key="achievements" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /> Achievements</h2>
              {canManageAchievements && (
                <Dialog open={showAddAchievement} onOpenChange={setShowAddAchievement}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Add Achievement</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md" aria-describedby={undefined}>
                    <DialogHeader>
                      <DialogTitle>Add Achievement</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-[60px_1fr] gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Icon</Label>
                          <Select value={achievementForm.icon} onValueChange={(v) => setAchievementForm({ ...achievementForm, icon: v })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['🏆', '🥇', '🥈', '🥉', '⭐', '🎯', '💡', '🔬', '🎨', '🏅', '📈', '🌟'].map(e => (
                                <SelectItem key={e} value={e}>{e}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Title *</Label>
                          <Input placeholder="e.g., State Level Hackathon Winners" value={achievementForm.title}
                            onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Description</Label>
                        <Textarea placeholder="Details about this achievement..." value={achievementForm.description}
                          onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })} rows={2} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Category</Label>
                        <Select value={achievementForm.category} onValueChange={(v) => setAchievementForm({ ...achievementForm, category: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="award">Award</SelectItem>
                            <SelectItem value="competition">Competition</SelectItem>
                            <SelectItem value="milestone">Milestone</SelectItem>
                            <SelectItem value="recognition">Recognition</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleAddAchievement} disabled={saving || !achievementForm.title} className="w-full">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Award className="w-4 h-4 mr-2" />}
                        Add Achievement
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {club.achievements && club.achievements.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {club.achievements.map((ach: ClubAchievement, i: number) => (
                  <motion.div key={ach.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                    <Card className="hover:shadow-md transition-shadow group">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <span className="text-3xl">{ach.icon || '🏆'}</span>
                            <div>
                              <h3 className="font-semibold text-sm">{ach.title}</h3>
                              {ach.description && <p className="text-xs text-muted-foreground mt-0.5">{ach.description}</p>}
                              <div className="flex items-center gap-2 mt-1.5">
                                {ach.category && <Badge variant="outline" className="text-[10px]">{ach.category}</Badge>}
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(ach.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          </div>
                          {canManageAchievements && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                              onClick={() => handleDeleteAchievement(ach.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No achievements yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Add club achievements, awards, and milestones</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
