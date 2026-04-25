'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  Award, FileText, Download, PlusCircle, Trash2, Loader2,
  Shield, CheckCircle2, Users, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

interface CertificateData {
  id: string;
  eventId: string;
  roundId: string | null;
  userId: string | null;
  title: string;
  description: string | null;
  certificateType: 'PARTICIPATION' | 'WINNER' | 'RUNNER_UP' | 'BEST_PERFORMER' | 'SPECIAL_MENTION' | 'CUSTOM';
  scope: 'EVENT_WIDE' | 'ROUND_SPECIFIC';
  templateData: string | null;
  issuedAt: string | null;
  certificateUrl: string | null;
  isDefault: boolean;
  user?: { id: string; name: string; email: string; usn?: string } | null;
  round?: { id: string; name: string; roundNumber: number } | null;
}

interface CertificateSummary {
  total: number;
  templates: number;
  issued: number;
}

interface RoundData {
  id: string;
  name: string;
  roundNumber: number;
}

// ============================================================
// Badge color maps
// ============================================================

const certTypeColors: Record<string, string> = {
  PARTICIPATION: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  WINNER: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  RUNNER_UP: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  BEST_PERFORMER: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  SPECIAL_MENTION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  CUSTOM: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
};

const scopeColors: Record<string, string> = {
  EVENT_WIDE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
  ROUND_SPECIFIC: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
};

const certTypeLabels: Record<string, string> = {
  PARTICIPATION: 'Participation',
  WINNER: 'Winner',
  RUNNER_UP: 'Runner Up',
  BEST_PERFORMER: 'Best Performer',
  SPECIAL_MENTION: 'Special Mention',
  CUSTOM: 'Custom',
};

const scopeLabels: Record<string, string> = {
  EVENT_WIDE: 'Event Wide',
  ROUND_SPECIFIC: 'Round Specific',
};

// ============================================================
// Component
// ============================================================

export function CertificateManagement() {
  const { user } = useAuthStore();
  const { selectedEventId, navigate, previousView } = useUIStore();

  // Data
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [summary, setSummary] = useState<CertificateSummary>({ total: 0, templates: 0, issued: 0 });
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [eventTitle, setEventTitle] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('templates');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<string>('PARTICIPATION');
  const [formScope, setFormScope] = useState<string>('EVENT_WIDE');
  const [formRoundId, setFormRoundId] = useState<string>('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [creating, setCreating] = useState(false);

  // Action loading states
  const [autoIssuing, setAutoIssuing] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Derived
  const templates = certificates.filter(c => c.userId === null);
  const issuedCerts = certificates.filter(c => c.userId !== null);

  // Permission check
  const canManage = user && (
    user.role === 'ADMIN' || user.role === 'FACULTY' || user.role === 'HOD'
  );

  // ============================================================
  // Fetch data
  // ============================================================

  const fetchCertificates = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const res = await fetch(`/api/events/${selectedEventId}/certificates`);
      if (res.ok) {
        const data = await res.json();
        setCertificates(data.certificates || []);
        setSummary(data.summary || { total: 0, templates: 0, issued: 0 });
      }
    } catch {
      toast.error('Failed to load certificates');
    }
  }, [selectedEventId]);

  const fetchEventData = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const res = await fetch(`/api/events/${selectedEventId}`);
      if (res.ok) {
        const data = await res.json();
        const event = data.event || data;
        setEventTitle(event.title || '');
        // Fetch rounds from competition config
        if (event.competitionConfig?.rounds) {
          setRounds(event.competitionConfig.rounds.map((r: any) => ({
            id: r.id,
            name: r.name,
            roundNumber: r.roundNumber ?? 0,
          })));
        } else if (event.eventType === 'COMPETITION') {
          // Fetch competition config separately
          try {
            const compRes = await fetch(`/api/events/${selectedEventId}/competition`);
            if (compRes.ok) {
              const compData = await compRes.json();
              if (compData.config?.rounds) {
                setRounds(compData.config.rounds.map((r: any) => ({
                  id: r.id,
                  name: r.name,
                  roundNumber: r.roundNumber ?? 0,
                })));
              }
            }
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }, [selectedEventId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchCertificates(), fetchEventData()]);
      setLoading(false);
    };
    load();
  }, [fetchCertificates, fetchEventData]);

  // ============================================================
  // Also check organizer permission at runtime
  // ============================================================

  const [isOrganizer, setIsOrganizer] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      if (!user || !selectedEventId) return;
      try {
        const res = await fetch(`/api/events/${selectedEventId}`);
        if (res.ok) {
          const data = await res.json();
          const event = data.event || data;
          setIsOrganizer(event.organizerId === user.id);
        }
      } catch { /* ignore */ }
    };
    checkPermission();
  }, [user, selectedEventId]);

  const hasPermission = canManage || isOrganizer;

  // ============================================================
  // Handlers
  // ============================================================

  const handleCreateTemplate = async () => {
    if (!selectedEventId || !user) return;
    if (!formTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/certificates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          certificateType: formType,
          scope: formScope,
          roundId: formScope === 'ROUND_SPECIFIC' ? formRoundId : null,
          description: formDescription || null,
          isDefault: formIsDefault,
          requestUserId: user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create template');
        return;
      }
      toast.success('Template created successfully!');
      // Reset form
      setFormTitle('');
      setFormType('PARTICIPATION');
      setFormScope('EVENT_WIDE');
      setFormRoundId('');
      setFormDescription('');
      setFormIsDefault(false);
      setShowCreateForm(false);
      await fetchCertificates();
    } catch {
      toast.error('Failed to create template');
    }
    setCreating(false);
  };

  const handleAutoIssue = async (templateId: string) => {
    if (!selectedEventId || !user) return;
    setAutoIssuing(templateId);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/certificates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto-issue',
          templateId,
          requestUserId: user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Auto-issue failed');
        return;
      }
      toast.success(`Issued ${data.issued} certificates! (${data.skipped} already had one)`);
      await fetchCertificates();
    } catch {
      toast.error('Auto-issue failed');
    }
    setAutoIssuing(null);
  };

  const handleGenerateAll = async () => {
    if (!selectedEventId || !user) return;
    setGeneratingAll(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/certificates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-all',
          requestUserId: user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Generation failed');
        return;
      }
      toast.success(`Generated ${data.generated} certificate PDFs`);
      await fetchCertificates();
    } catch {
      toast.error('PDF generation failed');
    }
    setGeneratingAll(false);
  };

  const handleDownloadPDF = async (certificateId: string) => {
    if (!selectedEventId || !user) return;
    setDownloading(certificateId);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/certificates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          certificateId,
          requestUserId: user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Download failed');
        return;
      }
      // Trigger browser download of base64 PDF
      const binaryString = atob(data.pdf);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.fileName || 'certificate.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Certificate PDF downloaded!');
    } catch {
      toast.error('PDF download failed');
    }
    setDownloading(null);
  };

  const handleDelete = async (certificateId: string) => {
    if (!selectedEventId || !user) return;
    if (!confirm('Are you sure you want to delete this certificate?')) return;
    setDeleting(certificateId);
    try {
      const res = await fetch(
        `/api/events/${selectedEventId}/certificates?certificateId=${certificateId}&userId=${user.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Delete failed');
        return;
      }
      toast.success('Certificate deleted');
      await fetchCertificates();
    } catch {
      toast.error('Delete failed');
    }
    setDeleting(null);
  };

  // ============================================================
  // Loading state
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Award className="w-8 h-8 text-primary mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading certificates...</p>
        </div>
      </div>
    );
  }

  // Permission denied
  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-sm text-muted-foreground">
              Only event organizers, faculty, HODs, and admins can manage certificates.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
      >
        <div>
          <button
            onClick={() => navigate(previousView || 'event-detail')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 flex items-center gap-1"
          >
            ← Back to event
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" /> Certificate Management
          </h1>
          {eventTitle && (
            <p className="text-sm text-muted-foreground mt-1">{eventTitle}</p>
          )}
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-primary hover:bg-primary/90"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        <Card className="bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-2">
              <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-bold">{summary.templates}</p>
            <p className="text-xs text-muted-foreground">Templates</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold">{summary.issued}</p>
            <p className="text-xs text-muted-foreground">Issued</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold">{summary.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Template Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6 overflow-hidden"
          >
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-primary" /> Create Certificate Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="cert-title">Title *</Label>
                    <Input
                      id="cert-title"
                      placeholder="e.g., Participation Certificate"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                    />
                  </div>

                  {/* Certificate Type */}
                  <div className="space-y-2">
                    <Label>Certificate Type *</Label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PARTICIPATION">Participation</SelectItem>
                        <SelectItem value="WINNER">Winner</SelectItem>
                        <SelectItem value="RUNNER_UP">Runner Up</SelectItem>
                        <SelectItem value="BEST_PERFORMER">Best Performer</SelectItem>
                        <SelectItem value="SPECIAL_MENTION">Special Mention</SelectItem>
                        <SelectItem value="CUSTOM">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Scope */}
                  <div className="space-y-2">
                    <Label>Scope *</Label>
                    <Select value={formScope} onValueChange={setFormScope}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EVENT_WIDE">Event Wide</SelectItem>
                        <SelectItem value="ROUND_SPECIFIC">Round Specific</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Round (only if ROUND_SPECIFIC) */}
                  {formScope === 'ROUND_SPECIFIC' && (
                    <div className="space-y-2">
                      <Label>Round *</Label>
                      <Select value={formRoundId} onValueChange={setFormRoundId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select round" />
                        </SelectTrigger>
                        <SelectContent>
                          {rounds.length > 0 ? (
                            rounds.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>
                              No rounds available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {rounds.length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          This event has no competition rounds. Add rounds in competition config first.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cert-desc">Description</Label>
                    <Textarea
                      id="cert-desc"
                      placeholder="Optional description for this certificate..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>

                {/* Default toggle */}
                <div className="flex items-center gap-3">
                  <Switch
                    id="cert-default"
                    checked={formIsDefault}
                    onCheckedChange={setFormIsDefault}
                  />
                  <Label htmlFor="cert-default" className="cursor-pointer">
                    Set as default template
                  </Label>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleCreateTemplate}
                    disabled={creating}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {creating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Create Template</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabbed Interface */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="templates" className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Templates ({templates.length})
            </TabsTrigger>
            <TabsTrigger value="issued" className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Issued ({issuedCerts.length})
            </TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates">
            {templates.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    className="inline-block mb-4"
                  >
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
                  </motion.div>
                  <p className="text-sm text-muted-foreground">
                    No certificate templates yet. Create one to get started!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {templates.map((template, i) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-sm truncate">{template.title}</h3>
                              {template.isDefault && (
                                <Badge className="text-[10px] bg-primary/10 text-primary">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={`text-[10px] ${certTypeColors[template.certificateType] || ''}`}>
                                {certTypeLabels[template.certificateType] || template.certificateType}
                              </Badge>
                              <Badge className={`text-[10px] ${scopeColors[template.scope] || ''}`}>
                                {scopeLabels[template.scope] || template.scope}
                              </Badge>
                              {template.round && (
                                <Badge variant="outline" className="text-[10px]">
                                  Round: {template.round.name}
                                </Badge>
                              )}
                            </div>
                            {template.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {template.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => handleAutoIssue(template.id)}
                              disabled={autoIssuing === template.id}
                            >
                              {autoIssuing === template.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Users className="w-3 h-3 mr-1" />
                              )}
                              Auto-Issue
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={handleGenerateAll}
                              disabled={generatingAll}
                            >
                              {generatingAll ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3 mr-1" />
                              )}
                              Generate All PDFs
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/5"
                              onClick={() => handleDelete(template.id)}
                              disabled={deleting === template.id}
                            >
                              {deleting === template.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Issued Tab */}
          <TabsContent value="issued">
            {issuedCerts.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    className="inline-block mb-4"
                  >
                    <Award className="w-12 h-12 text-muted-foreground mx-auto" />
                  </motion.div>
                  <p className="text-sm text-muted-foreground">
                    No certificates have been issued yet. Use a template to auto-issue certificates.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {issuedCerts.map((cert, i) => (
                  <motion.div
                    key={cert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-sm truncate">{cert.title}</h3>
                              {cert.issuedAt && (
                                <Badge variant="outline" className="text-[10px]">
                                  Issued {new Date(cert.issuedAt).toLocaleDateString('en-IN')}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {cert.user && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {cert.user.name}
                                  {cert.user.usn && (
                                    <span className="text-muted-foreground">({cert.user.usn})</span>
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={`text-[10px] ${certTypeColors[cert.certificateType] || ''}`}>
                                {certTypeLabels[cert.certificateType] || cert.certificateType}
                              </Badge>
                              <Badge className={`text-[10px] ${scopeColors[cert.scope] || ''}`}>
                                {scopeLabels[cert.scope] || cert.scope}
                              </Badge>
                              {cert.round && (
                                <Badge variant="outline" className="text-[10px]">
                                  Round: {cert.round.name}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => handleDownloadPDF(cert.id)}
                              disabled={downloading === cert.id}
                            >
                              {downloading === cert.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3 mr-1" />
                              )}
                              Download PDF
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
