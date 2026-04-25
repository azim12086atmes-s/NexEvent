'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  ArrowLeft, Zap, Trophy, Users, Lock, Unlock, Clock,
  Save, CheckCircle2, AlertCircle, ChevronRight, Loader2,
  Swords, Target, Shield, MessageSquare, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface Criterion {
  name: string;
  description?: string;
  maxScore: number;
  weight: number;
}

interface Round {
  id: string;
  roundNumber: number;
  name: string;
  description?: string;
  criteria: string; // JSON string
  maxScore: number;
  weight: number;
  isElimination: boolean;
  advanceCount?: number;
  scoringOpen: boolean;
  scoringDeadline?: string;
}

interface Team {
  id: string;
  name: string;
  teamCode: string;
  leaderId: string;
  status: string;
  leader: { id: string; name: string };
  members: { id: string; user: { id: string; name: string } }[];
}

interface Registration {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string };
  teamId?: string;
}

interface ExistingScore {
  id: string;
  roundId: string;
  judgeId: string;
  targetId: string;
  targetType: string;
  criterionName: string;
  score: number;
  maxScore: number;
  weight: number;
  comments?: string;
}

export function JudgeScoring() {
  const { user } = useAuthStore();
  const { navigate, selectedEventId, previousView } = useUIStore();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [scores, setScores] = useState<ExistingScore[]>([]);
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({}); // key: `${targetId}_${criterionName}`
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [canScore, setCanScore] = useState(false);
  const [canToggle, setCanToggle] = useState(false);
  const [togglingRound, setTogglingRound] = useState<string | null>(null);
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null);

  // Fetch event data
  useEffect(() => {
    if (!selectedEventId) return;
    const loadEvent = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/events/${selectedEventId}`);
        if (res.ok) {
          const data = await res.json();
          setEvent(data.event);
          // Set default round
          if (data.event?.competitionConfig?.rounds?.length > 0) {
            setSelectedRoundId(data.event.competitionConfig.rounds[0].id);
          }
        }
      } catch {
        toast.error('Failed to load event');
      }
      setLoading(false);
    };
    loadEvent();
  }, [selectedEventId]);

  // Check permissions
  useEffect(() => {
    if (!user || !selectedEventId) return;
    const checkPerms = async () => {
      try {
        // Get user's event role assignments
        const assignments = await fetch(`/api/events/${selectedEventId}/roles/assign?userId=${user.id}`);
        const roleAssignments: any[] = assignments.ok ? (await assignments.json()).assignments || [] : [];

        const isPrivileged = user.role === 'ADMIN' || user.role === 'FACULTY' || user.role === 'HOD' || event?.organizerId === user.id;

        const permissions = new Set<string>();
        for (const a of roleAssignments) {
          try {
            const perms: string[] = JSON.parse(a.role?.permissions || '[]');
            perms.forEach(p => permissions.add(p));
          } catch { /* ignore */ }
        }

        setCanScore(isPrivileged || permissions.has('SCORE_PARTICIPANTS'));
        setCanToggle(isPrivileged);
      } catch {
        // Default to not allowed
      }
    };
    checkPerms();
  }, [user, selectedEventId, event?.organizerId]);

  // Fetch existing scores for selected round
  useEffect(() => {
    if (!selectedEventId || !selectedRoundId || !user) return;
    const loadScores = async () => {
      try {
        const res = await fetch(`/api/events/${selectedEventId}/scores?roundId=${selectedRoundId}&judgeId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setScores(data.scores || []);
          // Pre-populate score inputs
          const inputs: Record<string, string> = {};
          const comments: Record<string, string> = {};
          for (const s of data.scores) {
            const key = `${s.targetId}_${s.criterionName}`;
            inputs[key] = String(s.score);
            comments[key] = s.comments || '';
          }
          setScoreInputs(inputs);
          setCommentInputs(comments);
          setSavedKeys(new Set(Object.keys(inputs)));
          setPendingKeys(new Set());
        }
      } catch {
        // Silent fail
      }
    };
    loadScores();
  }, [selectedEventId, selectedRoundId, user]);

  // Parse criteria from round
  const currentRound = useMemo<Round | null>(() => {
    if (!event?.competitionConfig?.rounds) return null;
    return event.competitionConfig.rounds.find((r: Round) => r.id === selectedRoundId) || null;
  }, [event, selectedRoundId]);

  const criteria = useMemo<Criterion[]>(() => {
    if (!currentRound) return [];
    try {
      return JSON.parse(currentRound.criteria || '[]');
    } catch {
      return [];
    }
  }, [currentRound]);

  // Get targets (teams or individuals)
  const targets = useMemo<{ id: string; name: string; type: string }[]>(() => {
    if (!event) return [];
    const config = event.competitionConfig;
    if (!config) return [];

    const result: { id: string; name: string; type: string }[] = [];

    // Add teams
    if (event.teams && event.teams.length > 0) {
      for (const team of event.teams) {
        result.push({ id: team.id, name: team.name, type: 'TEAM' });
      }
    }

    // Add individual participants if allowed
    if (config.allowIndividual && event.registrations) {
      for (const reg of event.registrations) {
        if (!reg.teamId) {
          result.push({ id: reg.user.id, name: reg.user.name, type: 'INDIVIDUAL' });
        }
      }
    }

    return result;
  }, [event]);

  // Get score for a target/criterion
  const getScoreValue = useCallback((targetId: string, criterionName: string): string => {
    const key = `${targetId}_${criterionName}`;
    return scoreInputs[key] ?? '';
  }, [scoreInputs]);

  // Calculate total for a target in current round
  const getTargetTotal = useCallback((targetId: string): number => {
    let total = 0;
    for (const c of criteria) {
      const val = parseFloat(getScoreValue(targetId, c.name));
      if (!isNaN(val)) total += val;
    }
    return total;
  }, [criteria, getScoreValue]);

  // Handle score input change
  const handleScoreChange = useCallback((targetId: string, criterionName: string, value: string) => {
    const key = `${targetId}_${criterionName}`;
    setScoreInputs(prev => ({ ...prev, [key]: value }));
    setPendingKeys(prev => new Set(prev).add(key));
    setSavedKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // Save a single score
  const saveScore = useCallback(async (targetId: string, criterionName: string) => {
    if (!user || !selectedEventId || !selectedRoundId) return;
    const key = `${targetId}_${criterionName}`;
    const value = parseFloat(scoreInputs[key]);
    const criterion = criteria.find(c => c.name === criterionName);
    if (!criterion) return;

    if (isNaN(value) || value < 0 || value > criterion.maxScore) {
      toast.error(`Score must be between 0 and ${criterion.maxScore}`);
      return;
    }

    setSavingKey(key);
    try {
      const target = targets.find(t => t.id === targetId);
      const res = await fetch(`/api/events/${selectedEventId}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: selectedRoundId,
          targetId,
          criterionName,
          score: value,
          maxScore: criterion.maxScore,
          judgeId: user.id,
          weight: criterion.weight,
          targetType: target?.type || 'INDIVIDUAL',
          comments: commentInputs[key] || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }

      setSavedKeys(prev => new Set(prev).add(key));
      setPendingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      // Update local scores state
      setScores(prev => {
        const existing = prev.find(s => s.targetId === targetId && s.criterionName === criterionName);
        if (existing) {
          return prev.map(s => s.id === existing.id ? { ...s, score: value } : s);
        }
        return [...prev, data.score];
      });

      toast.success(`Saved: ${criterionName}`);
    } catch {
      toast.error('Failed to save score');
    }
    setSavingKey(null);
  }, [user, selectedEventId, selectedRoundId, scoreInputs, criteria, targets, commentInputs]);

  // Save all scores for a target
  const saveAllForTarget = useCallback(async (targetId: string) => {
    for (const c of criteria) {
      const key = `${targetId}_${c.name}`;
      if (scoreInputs[key] !== undefined && scoreInputs[key] !== '') {
        await saveScore(targetId, c.name);
      }
    }
  }, [criteria, scoreInputs, saveScore]);

  // Toggle scoring open/close
  const toggleScoring = useCallback(async (roundId: string, open: boolean) => {
    if (!user || !selectedEventId) return;
    setTogglingRound(roundId);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/scores`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, userId: user.id, scoringOpen: open }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      // Update local round state
      setEvent((prev: any) => ({
        ...prev,
        competitionConfig: {
          ...prev.competitionConfig,
          rounds: prev.competitionConfig.rounds.map((r: Round) =>
            r.id === roundId ? { ...r, scoringOpen: open } : r
          ),
        },
      }));
      toast.success(`Scoring ${open ? 'opened' : 'closed'} for ${data.round?.name || 'round'}`);
    } catch {
      toast.error('Failed to toggle scoring');
    }
    setTogglingRound(null);
  }, [user, selectedEventId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading scoring panel...</p>
        </div>
      </div>
    );
  }

  if (!event || !canScore) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-sm text-muted-foreground">You do not have permission to score participants in this event.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate(previousView || 'event-detail', selectedEventId || undefined)}>
              <ArrowLeft className="w-3 h-3 mr-1" /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rounds: Round[] = event.competitionConfig?.rounds || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4"
      >
        <button onClick={() => navigate(previousView || 'event-detail', selectedEventId || undefined)} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Event
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">Judge Scoring</span>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Judge Scoring</h1>
            <p className="text-sm text-muted-foreground">{event.title}</p>
          </div>
          <Badge className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            <Swords className="w-3 h-3 mr-1" /> Competition
          </Badge>
        </div>
      </motion.div>

      {/* Round Selector */}
      {rounds.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Tabs value={selectedRoundId} onValueChange={setSelectedRoundId}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              {rounds.map((round) => {
                const roundCriteria: Criterion[] = (() => { try { return JSON.parse(round.criteria || '[]'); } catch { return []; } })();
                return (
                  <TabsTrigger key={round.id} value={round.id} className="text-xs sm:text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {round.roundNumber}
                      </span>
                      {round.name}
                      {round.scoringOpen ? (
                        <Unlock className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Lock className="w-3 h-3 text-amber-500" />
                      )}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {rounds.map((round) => (
              <TabsContent key={round.id} value={round.id}>
                <RoundScoringPanel
                  round={round}
                  criteria={(() => { try { return JSON.parse(round.criteria || '[]'); } catch { return []; } })()}
                  targets={targets}
                  user={user}
                  eventId={selectedEventId!}
                  canToggle={canToggle}
                  togglingRound={togglingRound}
                  onToggleScoring={toggleScoring}
                  scoreInputs={scoreInputs}
                  commentInputs={commentInputs}
                  savingKey={savingKey}
                  savedKeys={savedKeys}
                  pendingKeys={pendingKeys}
                  expandedTarget={expandedTarget}
                  onScoreChange={handleScoreChange}
                  onCommentChange={(targetId, criterionName, value) => {
                    const key = `${targetId}_${criterionName}`;
                    setCommentInputs(prev => ({ ...prev, [key]: value }));
                  }}
                  onSaveScore={saveScore}
                  onSaveAll={saveAllForTarget}
                  onExpandTarget={setExpandedTarget}
                  getScoreValue={getScoreValue}
                  getTargetTotal={getTargetTotal}
                />
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>
      )}

      {rounds.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No rounds configured for this competition.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Round Scoring Panel Sub-component
function RoundScoringPanel({
  round,
  criteria,
  targets,
  user,
  eventId,
  canToggle,
  togglingRound,
  onToggleScoring,
  scoreInputs,
  commentInputs,
  savingKey,
  savedKeys,
  pendingKeys,
  expandedTarget,
  onScoreChange,
  onCommentChange,
  onSaveScore,
  onSaveAll,
  onExpandTarget,
  getScoreValue,
  getTargetTotal,
}: {
  round: Round;
  criteria: Criterion[];
  targets: { id: string; name: string; type: string }[];
  user: any;
  eventId: string;
  canToggle: boolean;
  togglingRound: string | null;
  onToggleScoring: (roundId: string, open: boolean) => void;
  scoreInputs: Record<string, string>;
  commentInputs: Record<string, string>;
  savingKey: string | null;
  savedKeys: Set<string>;
  pendingKeys: Set<string>;
  expandedTarget: string | null;
  onScoreChange: (targetId: string, criterionName: string, value: string) => void;
  onCommentChange: (targetId: string, criterionName: string, value: string) => void;
  onSaveScore: (targetId: string, criterionName: string) => void;
  onSaveAll: (targetId: string) => void;
  onExpandTarget: (id: string | null) => void;
  getScoreValue: (targetId: string, criterionName: string) => string;
  getTargetTotal: (targetId: string) => number;
}) {
  const isScoringOpen = round.scoringOpen;
  const deadlinePassed = round.scoringDeadline ? new Date() > new Date(round.scoringDeadline) : false;

  return (
    <div className="space-y-4">
      {/* Round Info Card */}
      <Card className="border-primary/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {round.roundNumber}
              </span>
              <div>
                <p className="font-semibold">{round.name}</p>
                {round.description && <p className="text-xs text-muted-foreground">{round.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <Badge variant="outline" className="text-xs">
                <Trophy className="w-3 h-3 mr-1" /> Max: {round.maxScore}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Weight: {round.weight}x
              </Badge>
              <Badge className={`text-xs ${isScoringOpen && !deadlinePassed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                {isScoringOpen && !deadlinePassed ? (
                  <><Unlock className="w-3 h-3 mr-1" /> Scoring Open</>
                ) : deadlinePassed ? (
                  <><Clock className="w-3 h-3 mr-1" /> Deadline Passed</>
                ) : (
                  <><Lock className="w-3 h-3 mr-1" /> Scoring Closed</>
                )}
              </Badge>
              {round.scoringDeadline && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" /> Deadline: {new Date(round.scoringDeadline).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Badge>
              )}
              {round.isElimination && (
                <Badge className="text-xs bg-rose-100 text-rose-700">Elimination</Badge>
              )}
            </div>
          </div>
          {canToggle && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <Button
                size="sm"
                variant={isScoringOpen ? 'outline' : 'default'}
                onClick={() => onToggleScoring(round.id, !isScoringOpen)}
                disabled={togglingRound === round.id}
                className={isScoringOpen ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50' : 'bg-emerald-600 hover:bg-emerald-700'}
              >
                {togglingRound === round.id ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : isScoringOpen ? (
                  <Lock className="w-3 h-3 mr-1" />
                ) : (
                  <Unlock className="w-3 h-3 mr-1" />
                )}
                {isScoringOpen ? 'Close Scoring' : 'Open Scoring'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scoring Grid */}
      {criteria.length > 0 && targets.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Scoring Grid
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground w-8">#</th>
                    <th className="text-left p-3 font-medium text-muted-foreground min-w-[140px]">Team / Participant</th>
                    {criteria.map(c => (
                      <th key={c.name} className="text-center p-3 font-medium text-muted-foreground min-w-[100px]">
                        <div className="text-xs">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground/60">/ {c.maxScore}</div>
                      </th>
                    ))}
                    <th className="text-center p-3 font-medium text-muted-foreground min-w-[80px]">Total</th>
                    <th className="text-center p-3 font-medium text-muted-foreground w-[80px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((target, idx) => {
                    const isExpanded = expandedTarget === target.id;
                    const total = getTargetTotal(target.id);
                    return (
                      <React.Fragment key={target.id}>
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          className={`border-b border-border/30 hover:bg-muted/10 transition-colors ${idx % 2 === 0 ? 'bg-muted/5' : ''}`}
                        >
                          <td className="p-3 text-muted-foreground font-medium">{idx + 1}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                                {target.type === 'TEAM' ? <Users className="w-3.5 h-3.5" /> : target.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{target.name}</p>
                                <Badge variant="outline" className="text-[9px] mt-0.5">{target.type}</Badge>
                              </div>
                              <button
                                className="ml-auto p-0.5 rounded hover:bg-muted/50 transition-colors"
                                onClick={() => onExpandTarget(isExpanded ? null : target.id)}
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                          {criteria.map(c => {
                            const key = `${target.id}_${c.name}`;
                            const isSaved = savedKeys.has(key);
                            const isPending = pendingKeys.has(key);
                            const isSaving = savingKey === key;
                            return (
                              <td key={c.name} className="p-2 text-center">
                                <div className="relative">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={c.maxScore}
                                    step={0.5}
                                    value={getScoreValue(target.id, c.name)}
                                    onChange={e => onScoreChange(target.id, c.name, e.target.value)}
                                    onBlur={() => {
                                      if (getScoreValue(target.id, c.name) !== '') {
                                        onSaveScore(target.id, c.name);
                                      }
                                    }}
                                    disabled={!isScoringOpen && !canToggle}
                                    className={`w-20 h-8 text-center text-sm mx-auto ${
                                      isSaved && !isPending
                                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20'
                                        : isPending
                                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20'
                                        : ''
                                    }`}
                                  />
                                  {isSaving && (
                                    <Loader2 className="w-3 h-3 animate-spin absolute -right-1 -top-1 text-primary" />
                                  )}
                                  {isSaved && !isPending && !isSaving && (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 absolute -right-1 -top-1" />
                                  )}
                                  {isPending && !isSaving && (
                                    <AlertCircle className="w-3 h-3 text-amber-500 absolute -right-1 -top-1" />
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-3 text-center">
                            <span className={`font-bold ${total > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                              {total > 0 ? total : '-'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">/{round.maxScore}</span>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => onSaveAll(target.id)}
                              disabled={!isScoringOpen && !canToggle}
                            >
                              <Save className="w-3 h-3 mr-1" /> Save
                            </Button>
                          </td>
                        </motion.tr>
                        {/* Expanded row - comments */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.tr
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-muted/5"
                            >
                              <td colSpan={criteria.length + 4} className="p-4">
                                <div className="space-y-2">
                                  <p className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                                    <MessageSquare className="w-3 h-3" /> Judge Comments
                                  </p>
                                  <div className="grid sm:grid-cols-2 gap-2">
                                    {criteria.map(c => {
                                      const key = `${target.id}_${c.name}`;
                                      return (
                                        <div key={c.name} className="flex items-start gap-2">
                                          <Badge variant="secondary" className="text-[10px] shrink-0 mt-1">{c.name}</Badge>
                                          <Input
                                            placeholder="Add comment..."
                                            value={commentInputs[key] || ''}
                                            onChange={e => onCommentChange(target.id, c.name, e.target.value)}
                                            disabled={!isScoringOpen && !canToggle}
                                            className="h-7 text-xs"
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/50 bg-muted/20">
                    <td colSpan={2} className="p-3 text-xs font-medium text-muted-foreground">
                      Criteria Totals Given
                    </td>
                    {criteria.map(c => {
                      const totalGiven = targets.reduce((sum, t) => {
                        const val = parseFloat(getScoreValue(t.id, c.name));
                        return sum + (isNaN(val) ? 0 : val);
                      }, 0);
                      return (
                        <td key={c.name} className="p-3 text-center text-xs font-medium text-muted-foreground">
                          {totalGiven > 0 ? totalGiven : '-'}
                        </td>
                      );
                    })}
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            {criteria.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scoring criteria defined for this round.</p>
            ) : (
              <p className="text-sm text-muted-foreground">No teams or participants to score.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Saved</span>
        <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-amber-500" /> Pending</span>
        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 text-primary" /> Saving...</span>
      </div>
    </div>
  );
}
