'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { useEventStore, EventCategory } from '@/store/event-store';
import {
  Calendar, MapPin, Clock, Users, Tag, Loader2,
  CheckCircle2, Building2, Shield, AlertCircle, Plus, Trash2,
  Trophy, Target, Layers, UserPlus, ChevronDown, ChevronUp,
  Sparkles, Swords
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const categories: { value: EventCategory; label: string; icon: string }[] = [
  { value: 'TECHNICAL', label: 'Technical', icon: '⚡' },
  { value: 'CULTURAL', label: 'Cultural', icon: '🎭' },
  { value: 'SPORTS', label: 'Sports', icon: '🏆' },
  { value: 'WORKSHOP', label: 'Workshop', icon: '🔧' },
  { value: 'SEMINAR', label: 'Seminar', icon: '🎓' },
  { value: 'HACKATHON', label: 'Hackathon', icon: '💻' },
  { value: 'SOCIAL', label: 'Social', icon: '🌱' },
  { value: 'OTHER', label: 'Other', icon: '📌' },
];

const EVENT_ROLE_PERMISSIONS = [
  { id: 'SCORE_PARTICIPANTS', label: 'Score Participants' },
  { id: 'VIEW_RESULTS', label: 'View Results' },
  { id: 'MANAGE_REGISTRATIONS', label: 'Manage Registrations' },
  { id: 'CHECK_IN_ATTENDEES', label: 'Check In Attendees' },
  { id: 'MANAGE_EVENT_ROLES', label: 'Manage Event Roles' },
];

interface Round {
  roundNumber: number;
  name: string;
  description: string;
  maxScore: number;
  weight: number;
  isElimination: boolean;
  advanceCount: number | null;
  criteria: { name: string; description: string; maxScore: number; weight: number }[];
}

interface EventRoleInput {
  name: string;
  description: string;
  permissions: string[];
  color: string;
  maxAssignees: number | null;
}

export function CreateEventForm() {
  const { user } = useAuthStore();
  const { navigate } = useUIStore();
  const { createEvent, isCreating } = useEventStore();
  const [form, setForm] = useState({
    title: '', description: '', category: 'TECHNICAL' as EventCategory,
    venue: '', startDate: '', endDate: '', registrationDeadline: '',
    maxParticipants: '', tags: '', clubId: '',
    venueLat: '', venueLng: '', geoFenceRadius: '200',
    isPublic: true, requiresApproval: false,
    eventType: 'GENERAL' as 'GENERAL' | 'COMPETITION',
  });

  // Competition config
  const [competitionConfig, setCompetitionConfig] = useState({
    teamMinSize: 1,
    teamMaxSize: 5,
    maxTeams: '' as string,
    allowIndividual: true,
    scoringType: 'CUMULATIVE' as 'CUMULATIVE' | 'AVERAGE' | 'BEST_OF',
    rounds: [] as Round[],
  });

  // Event roles
  const [eventRoles, setEventRoles] = useState<EventRoleInput[]>([]);
  const [newRole, setNewRole] = useState<EventRoleInput>({ name: '', description: '', permissions: [], color: '#6366f1', maxAssignees: null });
  const [showRoleForm, setShowRoleForm] = useState(false);

  // UI state
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [showCompetition, setShowCompetition] = useState(false);
  const [showEventRoles, setShowEventRoles] = useState(false);

  const [allClubs, setAllClubs] = useState<any[]>([]);

  React.useEffect(() => {
    fetch('/api/clubs').then(r => r.json()).then(d => setAllClubs(d.clubs || [])).catch(() => {});
  }, []);

  // Filter clubs based on user role
  const clubs = React.useMemo(() => {
    if (!user) return [];
    // ADMIN and HOD can see all clubs
    if (user.role === 'ADMIN' || user.role === 'HOD') return allClubs;
    // FACULTY can only see clubs they're a faculty advisor or member of
    if (user.role === 'FACULTY') {
      return allClubs.filter((c: any) =>
        c.facultyAdvisorId === user.id || (c.members && c.members.some((m: any) => m.userId === user.id))
      );
    }
    return allClubs;
  }, [allClubs, user]);

  // Auto-select club if faculty only belongs to one
  React.useEffect(() => {
    if (user?.role === 'FACULTY' && clubs.length === 1 && !form.clubId) {
      setForm(prev => ({ ...prev, clubId: clubs[0].id }));
    }
  }, [clubs, user?.role, form.clubId]);

  const addRound = () => {
    const num = competitionConfig.rounds.length + 1;
    setCompetitionConfig({
      ...competitionConfig,
      rounds: [...competitionConfig.rounds, {
        roundNumber: num,
        name: num === 1 ? 'Prelims' : num === 2 ? 'Semifinals' : num === 3 ? 'Finals' : `Round ${num}`,
        description: '',
        maxScore: 100,
        weight: 1.0,
        isElimination: num < 3,
        advanceCount: null,
        criteria: [],
      }],
    });
    setExpandedRound(num - 1);
  };

  const updateRound = (index: number, field: string, value: any) => {
    const rounds = [...competitionConfig.rounds];
    rounds[index] = { ...rounds[index], [field]: value };
    setCompetitionConfig({ ...competitionConfig, rounds });
  };

  const removeRound = (index: number) => {
    const rounds = competitionConfig.rounds.filter((_, i) => i !== index);
    rounds.forEach((r, i) => r.roundNumber = i + 1);
    setCompetitionConfig({ ...competitionConfig, rounds });
  };

  const addCriteria = (roundIndex: number) => {
    const rounds = [...competitionConfig.rounds];
    rounds[roundIndex].criteria.push({ name: '', description: '', maxScore: 10, weight: 1.0 });
    setCompetitionConfig({ ...competitionConfig, rounds });
  };

  const updateCriteria = (roundIndex: number, critIndex: number, field: string, value: any) => {
    const rounds = [...competitionConfig.rounds];
    rounds[roundIndex].criteria[critIndex] = { ...rounds[roundIndex].criteria[critIndex], [field]: value };
    setCompetitionConfig({ ...competitionConfig, rounds });
  };

  const removeCriteria = (roundIndex: number, critIndex: number) => {
    const rounds = [...competitionConfig.rounds];
    rounds[roundIndex].criteria = rounds[roundIndex].criteria.filter((_, i) => i !== critIndex);
    setCompetitionConfig({ ...competitionConfig, rounds });
  };

  const addEventRole = () => {
    if (!newRole.name) { toast.error('Role name is required'); return; }
    setEventRoles([...eventRoles, { ...newRole }]);
    setNewRole({ name: '', description: '', permissions: [], color: '#6366f1', maxAssignees: null });
    setShowRoleForm(false);
    toast.success('Role added');
  };

  const removeEventRole = (index: number) => {
    setEventRoles(eventRoles.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!form.title || !form.description || !form.venue || !form.startDate || !form.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate competition config
    if (form.eventType === 'COMPETITION' && competitionConfig.rounds.length === 0) {
      toast.error('Competition events must have at least one round');
      return;
    }

    try {
      const data: any = {
        ...form,
        userId: user.id,
        maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : null,
        venueLat: form.venueLat ? parseFloat(form.venueLat) : null,
        venueLng: form.venueLng ? parseFloat(form.venueLng) : null,
        geoFenceRadius: form.geoFenceRadius ? parseFloat(form.geoFenceRadius) : null,
        clubId: form.clubId === 'none' ? null : (form.clubId || null),
      };

      // Add competition config if applicable
      if (form.eventType === 'COMPETITION') {
        data.competitionConfig = {
          teamMinSize: competitionConfig.teamMinSize,
          teamMaxSize: competitionConfig.teamMaxSize,
          maxTeams: competitionConfig.maxTeams ? parseInt(competitionConfig.maxTeams) : null,
          allowIndividual: competitionConfig.allowIndividual,
          scoringType: competitionConfig.scoringType,
          rounds: competitionConfig.rounds,
        };
      }

      // Add event roles
      if (eventRoles.length > 0) {
        data.eventRoles = eventRoles;
      }

      await createEvent(data);
      toast.success('Event created! Pending faculty approval.');
      navigate('dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create event');
    }
  };

  if (!user || (user.role !== 'FACULTY' && user.role !== 'HOD' && user.role !== 'ADMIN')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">Only faculty, HODs, and admins can create events.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Create Event</h1>
          <p className="text-sm text-muted-foreground">Submit a new event for faculty approval</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Event Title *</Label>
                <Input placeholder="e.g., HackVerse 2026" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Description *</Label>
                <Textarea placeholder="Describe your event in detail..." value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} required />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Category *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as EventCategory })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium">Club</Label>
                    {user?.role === 'FACULTY' && clubs.length > 0 && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary">
                        Only your clubs are shown
                      </Badge>
                    )}
                  </div>
                  {user?.role === 'FACULTY' && clubs.length === 0 ? (
                    <div className="rounded-md border border-dashed p-3 text-center">
                      <Building2 className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1.5" />
                      <p className="text-xs text-muted-foreground">
                        You can only create events for clubs you\'re a faculty advisor or member of. Join a club first.
                      </p>
                    </div>
                  ) : (
                    <Select value={form.clubId} onValueChange={(v) => setForm({ ...form, clubId: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select club" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No club</SelectItem>
                        {clubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tags (comma separated)</Label>
                <Input placeholder="hackathon, coding, innovation" value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })} className="h-9" />
              </div>
            </CardContent>
          </Card>

          {/* Schedule & Venue */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Schedule & Venue</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Venue *</Label>
                <Input placeholder="e.g., VVCE Auditorium" value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })} className="h-9" required />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Start Date & Time *</Label>
                  <Input type="datetime-local" value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-9" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">End Date & Time *</Label>
                  <Input type="datetime-local" value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="h-9" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Registration Deadline</Label>
                <Input type="datetime-local" value={form.registrationDeadline}
                  onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })} className="h-9" />
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Max Participants</Label>
                  <Input type="number" placeholder="Leave empty for unlimited" value={form.maxParticipants}
                    onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Geo-fence Radius (meters)</Label>
                  <Input type="number" placeholder="200" value={form.geoFenceRadius}
                    onChange={(e) => setForm({ ...form, geoFenceRadius: e.target.value })} className="h-9" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Switch checked={form.isPublic} onCheckedChange={(v) => setForm({ ...form, isPublic: v })} />
                  <Label className="text-xs">Public Event</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.requiresApproval} onCheckedChange={(v) => setForm({ ...form, requiresApproval: v })} />
                  <Label className="text-xs">Requires Registration Approval</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Event Type - Competition Toggle */}
          <Card className={`border-2 transition-colors ${form.eventType === 'COMPETITION' ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Swords className="w-4 h-4 text-primary" /> Event Type
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Label className="text-xs">Competition</Label>
                  <Switch
                    checked={form.eventType === 'COMPETITION'}
                    onCheckedChange={(checked) => {
                      setForm({ ...form, eventType: checked ? 'COMPETITION' : 'GENERAL' });
                      setShowCompetition(checked);
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <AnimatePresence>
              {form.eventType === 'COMPETITION' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <CardContent className="space-y-4 pt-2">
                    {/* Team Configuration */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Team Configuration</Label>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Min Members</Label>
                          <Input type="number" min={1} value={competitionConfig.teamMinSize}
                            onChange={(e) => setCompetitionConfig({ ...competitionConfig, teamMinSize: parseInt(e.target.value) || 1 })}
                            className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Max Members</Label>
                          <Input type="number" min={1} value={competitionConfig.teamMaxSize}
                            onChange={(e) => setCompetitionConfig({ ...competitionConfig, teamMaxSize: parseInt(e.target.value) || 5 })}
                            className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Max Teams</Label>
                          <Input type="number" placeholder="∞" value={competitionConfig.maxTeams}
                            onChange={(e) => setCompetitionConfig({ ...competitionConfig, maxTeams: e.target.value })}
                            className="h-8 text-sm" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch checked={competitionConfig.allowIndividual}
                            onCheckedChange={(v) => setCompetitionConfig({ ...competitionConfig, allowIndividual: v })} />
                          <Label className="text-[10px]">Allow individual participation</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px]">Scoring:</Label>
                          <Select value={competitionConfig.scoringType}
                            onValueChange={(v) => setCompetitionConfig({ ...competitionConfig, scoringType: v as any })}>
                            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CUMULATIVE">Cumulative</SelectItem>
                              <SelectItem value="AVERAGE">Average</SelectItem>
                              <SelectItem value="BEST_OF">Best Of</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Rounds */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Competition Rounds</Label>
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addRound}>
                          <Plus className="w-3 h-3 mr-1" /> Add Round
                        </Button>
                      </div>

                      {competitionConfig.rounds.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Add at least one round for the competition
                        </p>
                      )}

                      {competitionConfig.rounds.map((round, ri) => (
                        <Card key={ri} className="border-dashed">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <button type="button" onClick={() => setExpandedRound(expandedRound === ri ? null : ri)}
                                className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{ri + 1}</span>
                                {round.name || `Round ${ri + 1}`}
                                {expandedRound === ri ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => removeRound(ri)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                            <AnimatePresence>
                              {expandedRound === ri && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                  className="space-y-3 overflow-hidden">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Round Name</Label>
                                      <Input value={round.name} onChange={(e) => updateRound(ri, 'name', e.target.value)} className="h-8 text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Description</Label>
                                      <Input value={round.description} onChange={(e) => updateRound(ri, 'description', e.target.value)} className="h-8 text-sm" placeholder="Optional" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Max Score</Label>
                                      <Input type="number" value={round.maxScore} onChange={(e) => updateRound(ri, 'maxScore', parseFloat(e.target.value) || 100)} className="h-8 text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Weight</Label>
                                      <Input type="number" step="0.1" value={round.weight} onChange={(e) => updateRound(ri, 'weight', parseFloat(e.target.value) || 1)} className="h-8 text-sm" />
                                    </div>
                                    <div className="space-y-1 flex flex-col">
                                      <Label className="text-[10px] text-muted-foreground">Elimination?</Label>
                                      <div className="flex items-center gap-2 mt-auto">
                                        <Switch checked={round.isElimination} onCheckedChange={(v) => updateRound(ri, 'isElimination', v)} />
                                        <span className="text-[10px]">{round.isElimination ? 'Yes' : 'No'}</span>
                                      </div>
                                    </div>
                                  </div>
                                  {round.isElimination && (
                                    <div className="w-1/3">
                                      <Label className="text-[10px] text-muted-foreground">Teams Advancing</Label>
                                      <Input type="number" value={round.advanceCount || ''} onChange={(e) => updateRound(ri, 'advanceCount', e.target.value ? parseInt(e.target.value) : null)}
                                        placeholder="Top N advance" className="h-8 text-sm" />
                                    </div>
                                  )}

                                  {/* Scoring Criteria */}
                                  <div className="space-y-2 pt-2 border-t border-dashed">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-[10px] font-medium flex items-center gap-1"><Target className="w-3 h-3" /> Scoring Criteria</Label>
                                      <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => addCriteria(ri)}>
                                        <Plus className="w-2.5 h-2.5 mr-0.5" /> Add Criteria
                                      </Button>
                                    </div>
                                    {round.criteria.map((crit, ci) => (
                                      <div key={ci} className="flex items-end gap-2 p-2 bg-muted/20 rounded-lg">
                                        <div className="flex-1 space-y-0.5">
                                          <Label className="text-[9px] text-muted-foreground">Name</Label>
                                          <Input value={crit.name} onChange={(e) => updateCriteria(ri, ci, 'name', e.target.value)}
                                            placeholder="e.g., Innovation" className="h-7 text-xs" />
                                        </div>
                                        <div className="w-16 space-y-0.5">
                                          <Label className="text-[9px] text-muted-foreground">Max</Label>
                                          <Input type="number" value={crit.maxScore} onChange={(e) => updateCriteria(ri, ci, 'maxScore', parseFloat(e.target.value) || 10)}
                                            className="h-7 text-xs" />
                                        </div>
                                        <div className="w-16 space-y-0.5">
                                          <Label className="text-[9px] text-muted-foreground">Weight</Label>
                                          <Input type="number" step="0.1" value={crit.weight} onChange={(e) => updateCriteria(ri, ci, 'weight', parseFloat(e.target.value) || 1)}
                                            className="h-7 text-xs" />
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive"
                                          onClick={() => removeCriteria(ri, ci)}>
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    ))}
                                    {round.criteria.length === 0 && (
                                      <p className="text-[10px] text-muted-foreground text-center py-1">No criteria - scores will be entered directly per round</p>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* Event Roles */}
          <Card className={`border-2 transition-colors ${eventRoles.length > 0 ? 'border-chart-2/30' : 'border-border'}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-chart-2" /> Event Roles
                </CardTitle>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setShowEventRoles(!showEventRoles)}>
                  {showEventRoles ? 'Hide' : 'Setup'} Roles ({eventRoles.length})
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Create roles like Judge, Evaluator, Volunteer, etc.</p>
            </CardHeader>
            <AnimatePresence>
              {showEventRoles && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <CardContent className="space-y-3 pt-2">
                    {/* Existing roles */}
                    {eventRoles.map((role, ri) => (
                      <div key={ri} className="flex items-center justify-between p-2.5 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
                          <span className="text-sm font-medium">{role.name}</span>
                          {role.permissions.length > 0 && (
                            <div className="flex gap-1">
                              {role.permissions.slice(0, 2).map(p => (
                                <Badge key={p} variant="outline" className="text-[9px] h-4">
                                  {EVENT_ROLE_PERMISSIONS.find(ep => ep.id === p)?.label || p}
                                </Badge>
                              ))}
                              {role.permissions.length > 2 && (
                                <Badge variant="outline" className="text-[9px] h-4">+{role.permissions.length - 2}</Badge>
                              )}
                            </div>
                          )}
                          {role.maxAssignees && <span className="text-[9px] text-muted-foreground">Max: {role.maxAssignees}</span>}
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                          onClick={() => removeEventRole(ri)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}

                    {/* Add new role */}
                    <AnimatePresence>
                      {showRoleForm ? (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                          className="p-3 border border-dashed rounded-lg space-y-3">
                          <div className="grid grid-cols-[60px_1fr] gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Color</Label>
                              <input type="color" value={newRole.color} onChange={(e) => setNewRole({ ...newRole, color: e.target.value })}
                                className="w-full h-8 rounded cursor-pointer" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Role Name *</Label>
                              <Input value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                                placeholder="e.g., Judge, Evaluator" className="h-8 text-sm" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Description</Label>
                            <Input value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                              placeholder="What does this role do?" className="h-8 text-sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Max Assignees</Label>
                              <Input type="number" placeholder="Unlimited" value={newRole.maxAssignees || ''}
                                onChange={(e) => setNewRole({ ...newRole, maxAssignees: e.target.value ? parseInt(e.target.value) : null })}
                                className="h-8 text-sm" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-medium">Permissions</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {EVENT_ROLE_PERMISSIONS.map(p => (
                                <button key={p.id} type="button"
                                  onClick={() => setNewRole({
                                    ...newRole,
                                    permissions: newRole.permissions.includes(p.id)
                                      ? newRole.permissions.filter(pp => pp !== p.id)
                                      : [...newRole.permissions, p.id],
                                  })}
                                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                                    newRole.permissions.includes(p.id)
                                      ? 'bg-primary/10 border-primary/30 text-primary'
                                      : 'bg-muted/30 border-border text-muted-foreground'
                                  }`}>
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" size="sm" className="h-7 text-xs" onClick={addEventRole} disabled={!newRole.name}>
                              <Plus className="w-3 h-3 mr-1" /> Add
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                              onClick={() => { setShowRoleForm(false); setNewRole({ name: '', description: '', permissions: [], color: '#6366f1', maxAssignees: null }); }}>
                              Cancel
                            </Button>
                          </div>
                        </motion.div>
                      ) : (
                        <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs border-dashed"
                          onClick={() => setShowRoleForm(true)}>
                          <Plus className="w-3 h-3 mr-1" /> Add Event Role
                        </Button>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={isCreating} className="bg-primary hover:bg-primary/90">
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Submit for Approval
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('feed')}>Cancel</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
