'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { useEventStore } from '@/store/event-store';
import {
  ArrowLeft, Calendar, MapPin, Clock, Users, Share2,
  QrCode, CheckCircle2, XCircle, Loader2, Tag, Building2,
  FileText, Download, ExternalLink, User as UserIcon,
  Zap, Heart, BookmarkPlus, ChevronRight, Timer, Flame,
  Swords, Trophy, Layers, Target, Shield, UsersRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const categoryColors: Record<string, string> = {
  HACKATHON: 'from-violet-500 to-purple-600',
  TECHNICAL: 'from-cyan-500 to-blue-600',
  CULTURAL: 'from-rose-500 to-pink-600',
  WORKSHOP: 'from-amber-500 to-orange-600',
  SEMINAR: 'from-emerald-500 to-teal-600',
  SPORTS: 'from-green-500 to-lime-600',
  SOCIAL: 'from-fuchsia-500 to-purple-600',
  OTHER: 'from-gray-500 to-gray-600',
};

const statusColors: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  LIVE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  COMPLETED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const categoryIcons: Record<string, string> = {
  HACKATHON: '💻', TECHNICAL: '⚡', CULTURAL: '🎭', WORKSHOP: '🔧',
  SEMINAR: '🎓', SPORTS: '🏆', SOCIAL: '🌱', OTHER: '📌',
};

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getTimeUntil(d: string | Date): string {
  const now = new Date();
  const target = new Date(d);
  const diff = target.getTime() - now.getTime();
  if (diff < 0) return 'Started';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} to go`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} to go`;
  const mins = Math.floor(diff / (1000 * 60));
  return `${mins} min to go`;
}

export function EventDetail() {
  const { user, isAuthenticated } = useAuthStore();
  const { navigate, selectedEventId } = useUIStore();
  const { currentEvent, isLoading, fetchEventById, registerForEvent, cancelRegistration, approveEvent } = useEventStore();
  const [registering, setRegistering] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [userReg, setUserReg] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (selectedEventId) {
      fetchEventById(selectedEventId);
    }
  }, [selectedEventId, fetchEventById]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedEventId) return;
      const res = await fetch(`/api/events/${selectedEventId}${user ? `?userId=${user.id}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setUserReg(data.userRegistration);
      }
    };
    loadDetail();
  }, [selectedEventId, user]);

  const handleRegister = async () => {
    if (!user) return;
    setRegistering(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success('Registered successfully! 🎉');
      fetchEventById(selectedEventId!);
      const detailRes = await fetch(`/api/events/${selectedEventId}?userId=${user.id}`);
      if (detailRes.ok) { const d = await detailRes.json(); setUserReg(d.userRegistration); }
    } catch { toast.error('Registration failed'); }
    setRegistering(false);
  };

  const handleCancel = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/events/${selectedEventId}/register?userId=${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success('Registration cancelled');
      fetchEventById(selectedEventId!);
      setUserReg(null);
    } catch { toast.error('Failed to cancel'); }
  };

  const handleApprove = async (action: 'approve' | 'reject') => {
    if (!user) return;
    try {
      const res = await fetch(`/api/events/${selectedEventId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(action === 'approve' ? 'Event approved! ✅' : 'Event rejected');
      fetchEventById(selectedEventId!);
    } catch { toast.error('Action failed'); }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: currentEvent?.title, text: currentEvent?.description, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const generatePDF = async () => {
    if (!currentEvent) return;
    setGeneratingPDF(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/report`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error('Failed to generate report'); return; }

      const doc = new jsPDF();
      // Header
      doc.setFillColor(55, 48, 163);
      doc.rect(0, 0, 210, 35, 'F');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text('NexEvent - Event Report', 14, 22);
      doc.setFontSize(10);
      doc.text('VVCE Campus Innovation 2026', 14, 30);

      // Event info
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(16);
      doc.text(data.event.title, 14, 48);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Venue: ${data.event.venue}  |  Date: ${new Date(data.event.startDate).toLocaleDateString('en-IN')}  |  Category: ${data.event.category}`, 14, 56);

      // Summary box
      doc.setFillColor(245, 245, 255);
      doc.roundedRect(14, 62, 182, 30, 3, 3, 'F');
      doc.setFontSize(11);
      doc.setTextColor(55, 48, 163);
      doc.text('Attendance Summary', 20, 72);
      doc.setFontSize(9);
      doc.setTextColor(60);
      doc.text(`Total Registered: ${data.stats.totalRegistered}    Present: ${data.stats.totalPresent}    Absent: ${data.stats.totalAbsent}    Rate: ${data.stats.attendanceRate}%`, 20, 82);

      // Table
      if (data.attendees && data.attendees.length > 0) {
        autoTable(doc, {
          startY: 100,
          head: [['#', 'Name', 'USN', 'Department', 'Status', 'Check-in Time']],
          body: data.attendees.map((a: any, i: number) => [
            i + 1, a.name, a.usn || '-', a.department || '-',
            a.status, a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString('en-IN') : '-'
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [55, 48, 163], textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [245, 245, 255] },
        });
      }

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Generated by NexEvent | VVCE Campus Innovation 2026 | Team Jungly Billi', 14, doc.internal.pageSize.height - 10);

      doc.save(`${data.event.title.replace(/\s+/g, '_')}_Report.pdf`);
      toast.success('PDF report downloaded! 📄');
    } catch { toast.error('PDF generation failed'); }
    setGeneratingPDF(false);
  };

  if (isLoading || !currentEvent) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading event details...</p>
        </div>
      </div>
    );
  }

  const event = currentEvent as any;
  const isOrganizer = user && (event.organizerId === user.id || user.role === 'ADMIN');
  const isFaculty = user && (user.role === 'FACULTY' || user.role === 'ADMIN');
  const canRegister = isAuthenticated && ['APPROVED', 'LIVE'].includes(event.status) && !userReg;
  const regCount = event._count?.registrations || event.registrations?.length || 0;
  const maxP = event.maxParticipants;
  const regPercent = maxP ? Math.min((regCount / maxP) * 100, 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4"
      >
        <button onClick={() => navigate('feed')} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Events
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{event.title}</span>
      </motion.div>

      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative rounded-2xl overflow-hidden mb-6 p-6 sm:p-8 bg-gradient-to-br ${categoryColors[event.category] || categoryColors.OTHER}`}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 dot-pattern opacity-10" />
        {/* Floating emoji */}
        <motion.div
          className="absolute top-4 right-4 text-5xl opacity-20"
          animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
        >
          {categoryIcons[event.category] || '📌'}
        </motion.div>
        <motion.div
          className="absolute bottom-4 left-4 text-3xl opacity-10"
          animate={{ y: [0, 10, 0], rotate: [0, -5, 5, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 1 }}
        >
          {categoryIcons[event.category] || '📌'}
        </motion.div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge className="text-xs bg-white/20 text-white border-white/30 backdrop-blur-sm">
              {event.status === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-white mr-1 animate-pulse" />}
              {event.status}
            </Badge>
            <Badge variant="outline" className="text-xs border-white/30 text-white/80">{event.category}</Badge>
            {event.eventType === 'COMPETITION' && (
              <Badge className="text-xs bg-white/20 text-white border-white/30 backdrop-blur-sm">
                <Swords className="w-2.5 h-2.5 mr-1" /> Competition
              </Badge>
            )}
            {event.status === 'LIVE' || event.status === 'APPROVED' ? (
              <Badge className="text-xs bg-white/10 text-white/70 border-white/20 backdrop-blur-sm">
                <Timer className="w-2.5 h-2.5 mr-1" /> {getTimeUntil(event.startDate)}
              </Badge>
            ) : null}
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">{event.title}</h1>
          {event.club && (
            <p className="text-white/70 text-sm mt-2 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> Organized by {event.club.name}
            </p>
          )}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Cards Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-3"
          >
            <Card className="bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Venue</p>
                  <p className="text-sm font-medium truncate">{event.venue}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-chart-2/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">{formatDate(event.startDate)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="text-sm font-medium">{formatTime(event.startDate)} — {formatTime(event.endDate)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-chart-3" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Registered</p>
                  <p className="text-sm font-medium">{regCount}{maxP ? ` / ${maxP}` : ''}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Registration Progress */}
          {maxP && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Registration Progress</span>
                    <span className="text-xs text-muted-foreground">{regCount} / {maxP} spots</span>
                  </div>
                  <Progress value={regPercent} className="h-2.5" />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {regPercent >= 90 ? '🔥 Almost full!' : regPercent >= 50 ? '📈 Filling up fast' : '✨ Spots available'}
                    </span>
                    <span className="text-xs font-medium">{Math.round(regPercent)}%</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> About This Event
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{event.description}</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Tags */}
          {event.tags && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex flex-wrap gap-2"
            >
              {event.tags.split(',').filter(Boolean).map((tag: string, i: number) => (
                <motion.div
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  whileHover={{ scale: 1.1, y: -2 }}
                >
                  <Badge variant="secondary" className="text-xs cursor-default">
                    <Tag className="w-3 h-3 mr-1" />{tag.trim()}
                  </Badge>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Competition Config */}
          {event.eventType === 'COMPETITION' && event.competitionConfig && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Swords className="w-4 h-4 text-primary" /> Competition Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center p-3 rounded-xl bg-background">
                      <UsersRound className="w-4 h-4 text-primary mx-auto mb-1" />
                      <p className="text-lg font-bold">{event.competitionConfig.teamMinSize}-{event.competitionConfig.teamMaxSize}</p>
                      <p className="text-[10px] text-muted-foreground">Team Size</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-background">
                      <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                      <p className="text-lg font-bold">{event.competitionConfig.maxTeams || '∞'}</p>
                      <p className="text-[10px] text-muted-foreground">Max Teams</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-background">
                      <Target className="w-4 h-4 text-chart-2 mx-auto mb-1" />
                      <p className="text-lg font-bold text-xs">{event.competitionConfig.scoringType}</p>
                      <p className="text-[10px] text-muted-foreground">Scoring</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-background">
                      <Users className="w-4 h-4 text-chart-4 mx-auto mb-1" />
                      <p className="text-lg font-bold">{event.competitionConfig.allowIndividual ? 'Yes' : 'No'}</p>
                      <p className="text-[10px] text-muted-foreground">Individuals</p>
                    </div>
                  </div>

                  {/* Rounds */}
                  {event.competitionConfig.rounds && event.competitionConfig.rounds.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-primary" /> Rounds</p>
                      {event.competitionConfig.rounds.map((round: any, ri: number) => {
                        const criteria: { name: string; maxScore: number; weight: number }[] = (() => { try { return JSON.parse(round.criteria || '[]'); } catch { return []; } })();
                        return (
                          <div key={round.id} className="p-3 rounded-lg border border-border/50 bg-background">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{ri + 1}</span>
                                <span className="text-sm font-medium">{round.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">Max: {round.maxScore}</Badge>
                                <Badge variant="outline" className="text-[10px]">Weight: {round.weight}x</Badge>
                                {round.isElimination && <Badge className="text-[10px] bg-rose-100 text-rose-700">Elimination</Badge>}
                              </div>
                            </div>
                            {round.description && <p className="text-xs text-muted-foreground ml-8">{round.description}</p>}
                            {round.isElimination && round.advanceCount && (
                              <p className="text-[10px] text-rose-600 ml-8 mt-1">Top {round.advanceCount} teams advance</p>
                            )}
                            {criteria.length > 0 && (
                              <div className="ml-8 mt-2 flex flex-wrap gap-1.5">
                                {criteria.map((c: any, ci: number) => (
                                  <Badge key={ci} variant="secondary" className="text-[9px]">
                                    <Target className="w-2.5 h-2.5 mr-0.5" />{c.name}: {c.maxScore}pts
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Teams */}
                  {event.teams && event.teams.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium flex items-center gap-1"><UsersRound className="w-3.5 h-3.5 text-primary" /> Registered Teams ({event.teams.length})</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {event.teams.map((team: any) => (
                          <div key={team.id} className="p-2.5 rounded-lg border border-border/50 bg-background flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{team.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                Leader: {team.leader?.name || 'Unknown'} • {team.members?.length || 0} members
                              </p>
                            </div>
                            <Badge variant={team.status === 'WINNER' ? 'default' : 'outline'} className="text-[10px]">
                              {team.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Event Roles */}
          {event.eventRoles && event.eventRoles.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" /> Event Roles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {event.eventRoles.map((role: any) => (
                      <div key={role.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/30">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color || '#6366f1' }} />
                        <div>
                          <p className="text-xs font-medium">{role.name}</p>
                          {role.description && <p className="text-[10px] text-muted-foreground">{role.description}</p>}
                        </div>
                        {role.assignments && role.assignments.length > 0 && (
                          <div className="flex -space-x-1 ml-1">
                            {role.assignments.map((a: any) => (
                              <div key={a.id} className="w-6 h-6 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[8px] font-semibold text-primary" title={a.user?.name}>
                                {(a.user?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </div>
                            ))}
                          </div>
                        )}
                        {role.maxAssignees && (
                          <Badge variant="outline" className="text-[9px]">{role.assignments?.length || 0}/{role.maxAssignees}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Registration list for organizer */}
          {isOrganizer && event.registrations && event.registrations.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Registrations ({event.registrations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {event.registrations.map((r: any, i: number) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${
                          i % 2 === 0 ? 'bg-muted/20' : 'bg-muted/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                            {(r.user?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="font-medium">{r.user?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                          {r.attendance && (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> In
                            </Badge>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Approval section for faculty */}
          {isFaculty && event.status === 'PENDING_APPROVAL' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <Timer className="w-4 h-4" /> Pending Your Approval
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Review this event and approve or reject it. The organizer will be notified.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={() => handleApprove('approve')} className="bg-emerald-600 hover:bg-emerald-700 flex-1">
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Event
                    </Button>
                    <Button variant="destructive" onClick={() => handleApprove('reject')} className="flex-1">
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Registration card */}
          <Card className="sticky top-20 border-primary/10 shadow-lg shadow-primary/5">
            <CardContent className="p-5 space-y-4">
              {userReg ? (
                <div className="text-center space-y-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
                  </motion.div>
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300 text-lg">You&apos;re Registered!</p>
                    <Badge variant="outline" className="text-xs mt-1">{userReg.status}</Badge>
                  </div>
                  {userReg.qrCode && (
                    <div>
                      <Button variant="outline" size="sm" className="w-full mb-2"
                        onClick={() => setShowQR(!showQR)}>
                        <QrCode className="w-3 h-3 mr-1" /> {showQR ? 'Hide' : 'Show'} QR Code
                      </Button>
                      <AnimatePresence>
                        {showQR && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, scale: 0.8 }}
                            animate={{ opacity: 1, height: 'auto', scale: 1 }}
                            exit={{ opacity: 0, height: 0, scale: 0.8 }}
                            transition={{ type: 'spring', stiffness: 200 }}
                            className="flex flex-col items-center p-4 bg-white rounded-xl shadow-inner"
                          >
                            <QRCodeSVG value={userReg.qrCode} size={160} />
                            <p className="text-[10px] text-gray-500 mt-3">Scan at venue to check in</p>
                            <p className="text-[9px] text-gray-400">Geo-fencing may apply</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive hover:bg-destructive/5"
                    onClick={handleCancel}>
                    Cancel Registration
                  </Button>
                </div>
              ) : canRegister ? (
                <div className="space-y-3">
                  <Button
                    className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 relative overflow-hidden group"
                    onClick={handleRegister}
                    disabled={registering}
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                      Register Now
                    </span>
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  </Button>
                  {maxP && (
                    <p className="text-xs text-center text-muted-foreground">
                      {maxP - regCount > 0 ? `${maxP - regCount} spots remaining` : 'Waitlist only'}
                    </p>
                  )}
                </div>
              ) : !isAuthenticated ? (
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Sign in to register for this event</p>
                  <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => useUIStore.getState().showLogin()}>
                    Sign In
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-center text-muted-foreground py-4">
                  {event.status === 'COMPLETED' ? '🏁 Event has ended' : event.status === 'PENDING_APPROVAL' ? '⏳ Event pending approval' : 'Registration not available'}
                </p>
              )}

              <Separator />

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={handleShare}>
                  <Share2 className="w-3 h-3 mr-1" /> Share
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => setLiked(!liked)}>
                  <Heart className={`w-3 h-3 mr-1 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
                  {liked ? 'Saved' : 'Save'}
                </Button>
              </div>

              <Separator />

              {/* Organizer info */}
              {event.organizer && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Organized by</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {event.organizer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{event.organizer.name}</p>
                      {event.club && <p className="text-xs text-muted-foreground">{event.club.name}</p>}
                    </div>
                  </div>
                </div>
              )}

              {isOrganizer && (
                <>
                  <Separator />
                  <Button variant="outline" size="sm" className="w-full" onClick={generatePDF} disabled={generatingPDF}>
                    {generatingPDF ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                    ) : (
                      <><Download className="w-3 h-3 mr-1" /> Generate PDF Report</>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Geo-fence info */}
          {event.geoFenceRadius && (
            <Card className="bg-chart-2/5 border-chart-2/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs">
                  <MapPin className="w-4 h-4 text-chart-2" />
                  <div>
                    <p className="font-medium">Geo-fenced Event</p>
                    <p className="text-muted-foreground">Must be within {event.geoFenceRadius}m of venue for check-in</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
