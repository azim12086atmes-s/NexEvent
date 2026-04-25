'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { User, Mail, Building2, Hash, Phone, Calendar, Users, Award, Loader2, Edit3, Save, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export function ProfileView() {
  const { user, updateProfile } = useAuthStore();
  const { navigate } = useUIStore();
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', department: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const res = await fetch(`/api/users/me?userId=${user.id}`);
        if (res.ok) {
          const d = await res.json();
          setProfile(d.user);
          setEditForm({ name: d.user.name, phone: d.user.phone || '', department: d.user.department || '' });
        }
      } catch {}
      setIsLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const d = await res.json();
        setProfile(prev => ({ ...prev, ...(d.user || d) }));
        // Also update the auth store so the header/avatar reflects changes
        await updateProfile(editForm);
        toast.success('Profile updated! ✅');
        setEditing(false);
      }
    } catch { toast.error('Update failed'); }
    setSaving(false);
  };

  if (!user) return null;
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
        <Loader2 className="w-8 h-8 text-primary" />
      </motion.div>
    </div>
  );

  const roleColors: Record<string, string> = {
    STUDENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    FACULTY: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
    HOD: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    ADMIN: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
    OTHER: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };

  const roleGradients: Record<string, string> = {
    STUDENT: 'from-emerald-500 to-teal-600',
    FACULTY: 'from-violet-500 to-purple-600',
    HOD: 'from-amber-500 to-orange-600',
    ADMIN: 'from-rose-500 to-pink-600',
    OTHER: 'from-slate-500 to-gray-600',
  };

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Profile Header */}
        <Card className="mb-6 overflow-hidden">
          <div className={`h-24 bg-gradient-to-r ${roleGradients[user.role] || 'from-primary to-chart-4'} relative`}>
            <div className="absolute inset-0 dot-pattern opacity-10" />
          </div>
          <CardContent className="p-6 -mt-10 relative">
            <div className="flex items-end gap-4 mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="w-20 h-20 rounded-2xl bg-background border-4 border-background shadow-xl flex items-center justify-center text-2xl font-bold text-primary shrink-0"
              >
                {initials}
              </motion.div>
              <div className="flex-1 pb-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl font-bold">{user.name}</h1>
                  <Badge className={`text-xs ${roleColors[user.role]}`}>{user.role}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(!editing)} className="shrink-0">
                <Edit3 className="w-3 h-3 mr-1" /> {editing ? 'Cancel' : 'Edit'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-primary" /> Edit Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Name</Label>
                    <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Phone</Label>
                    <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Department</Label>
                    <Input value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} className="h-9" />
                  </div>
                  <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
                    {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { icon: Mail, label: 'Email', value: user.email, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
                { icon: Building2, label: 'Department', value: profile?.department || user.department || '-', color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30' },
                { icon: Hash, label: 'USN', value: profile?.usn || user.usn || '-', color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
                { icon: Phone, label: 'Phone', value: profile?.phone || user.phone || '-', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
                { icon: Shield, label: 'Role', value: user.role, color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3"
                >
                  <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center shrink-0`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-muted-foreground w-24 shrink-0">{item.label}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity Stats */}
        {profile && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: profile._count?.registrations || 0, label: 'Registrations', icon: Calendar, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30' },
                  { value: profile._count?.attendances || 0, label: 'Check-ins', icon: Award, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
                  { value: profile._count?.organizedEvents || 0, label: 'Organized', icon: Users, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
                ].map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1, type: 'spring' }}
                    whileHover={{ y: -3 }}
                    className="text-center p-4 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mx-auto mb-2`}>
                      <s.icon className="w-5 h-5" />
                    </div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Club Memberships */}
        {profile?.clubMemberships && profile.clubMemberships.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Club Memberships
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.clubMemberships.map((cm: any, i: number) => (
                <motion.div
                  key={cm.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <span className="text-sm font-medium">{cm.club.name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{cm.role}</Badge>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
