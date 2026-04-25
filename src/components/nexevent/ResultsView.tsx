'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  ArrowLeft, Zap, Trophy, Medal, Award, Users,
  AlertCircle, ChevronDown, ChevronUp, Download,
  Swords, Target, ChevronRight, Loader2, Star,
  Crown, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CriterionBreakdown {
  criterionName: string;
  avgScore: number;
  maxScore: number;
  judgeCount: number;
}

interface RoundBreakdown {
  roundId: string;
  roundName: string;
  roundNumber: number;
  weight: number;
  maxScore: number;
  criteriaBreakdown: CriterionBreakdown[];
  roundTotal: number;
  weightedScore: number;
}

interface ResultEntry {
  rank: number;
  targetId: string;
  targetName: string;
  targetType: string;
  team?: {
    id: string;
    name: string;
    status: string;
    leader: { id: string; name: string };
    members: { id: string; user: { id: string; name: string } }[];
  };
  roundBreakdowns: RoundBreakdown[];
  totalScore: number;
}

const rankStyles: Record<number, { bg: string; text: string; icon: React.ReactNode }> = {
  1: {
    bg: 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    icon: <Crown className="w-5 h-5 text-amber-500" />,
  },
  2: {
    bg: 'bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border-slate-300 dark:border-slate-700',
    text: 'text-slate-600 dark:text-slate-300',
    icon: <Medal className="w-5 h-5 text-slate-400" />,
  },
  3: {
    bg: 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-200 dark:border-orange-800',
    text: 'text-orange-600 dark:text-orange-300',
    icon: <Award className="w-5 h-5 text-orange-400" />,
  },
};

export function ResultsView() {
  const { user } = useAuthStore();
  const { navigate, selectedEventId, previousView } = useUIStore();
  const [event, setEvent] = useState<any>(null);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [rounds, setRounds] = useState<{ id: string; name: string; roundNumber: number; weight: number }[]>([]);
  const [scoringType, setScoringType] = useState<string>('CUMULATIVE');
  const [loading, setLoading] = useState(true);
  const [canView, setCanView] = useState(false);
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Fetch event and results
  useEffect(() => {
    if (!selectedEventId) return;
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch event
        const eventRes = await fetch(`/api/events/${selectedEventId}`);
        if (eventRes.ok) {
          const eventData = await eventRes.json();
          setEvent(eventData.event);

          // Check permissions
          if (user) {
            const isPrivileged = user.role === 'ADMIN' || user.role === 'FACULTY' || user.role === 'HOD' || eventData.event?.organizerId === user.id;

            // Check event role assignments
            const assignmentsRes = await fetch(`/api/events/${selectedEventId}/roles/assign?userId=${user.id}`);
            const roleAssignments: any[] = assignmentsRes.ok ? (await assignmentsRes.json()).assignments || [] : [];

            const permissions = new Set<string>();
            for (const a of roleAssignments) {
              try {
                const perms: string[] = JSON.parse(a.role?.permissions || '[]');
                perms.forEach(p => permissions.add(p));
              } catch { /* ignore */ }
            }

            const viewAllowed = isPrivileged || permissions.has('VIEW_RESULTS');
            setCanView(viewAllowed);

            if (viewAllowed) {
              // Fetch aggregated scores
              const scoresRes = await fetch(`/api/events/${selectedEventId}/scores?aggregate=true`);
              if (scoresRes.ok) {
                const scoresData = await scoresRes.json();
                setResults(scoresData.results || []);
                setRounds(scoresData.rounds || []);
                setScoringType(scoresData.scoringType || 'CUMULATIVE');
              }
            }
          }
        }
      } catch {
        toast.error('Failed to load results');
      }
      setLoading(false);
    };
    loadData();
  }, [selectedEventId, user]);

  // Export PDF
  const exportPDF = useCallback(async () => {
    if (!event || results.length === 0) return;
    setExporting(true);
    try {
      const doc = new jsPDF('landscape');

      // Header
      doc.setFillColor(55, 48, 163);
      doc.rect(0, 0, 297, 30, 'F');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text('NexEvent - Competition Results', 14, 18);
      doc.setFontSize(10);
      doc.text('VVCE Campus Innovation 2026', 14, 26);

      // Event info
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(14);
      doc.text(event.title, 14, 42);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Scoring Type: ${scoringType}  |  Total Participants: ${results.length}  |  Rounds: ${rounds.length}`, 14, 50);

      // Main rankings table
      const head = [['Rank', 'Team / Participant', 'Type', ...rounds.map(r => `${r.name} (x${r.weight})`), 'Total Score']];
      const body = results.map(r => [
        r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : String(r.rank),
        r.targetName,
        r.targetType,
        ...rounds.map(rd => {
          const rb = r.roundBreakdowns.find(b => b.roundId === rd.id);
          return rb ? String(rb.roundTotal) : '-';
        }),
        String(r.totalScore),
      ]);

      autoTable(doc, {
        startY: 56,
        head,
        body,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [55, 48, 163], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 255] },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 50 },
          2: { cellWidth: 20, halign: 'center' },
        },
      });

      // Per-criterion breakdown for each result
      let yPos = (doc as any).lastAutoTable?.finalY + 10 || 120;

      for (const result of results.slice(0, 10)) { // Limit to top 10 for PDF
        if (yPos > 170) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(10);
        doc.setTextColor(55, 48, 163);
        doc.text(`#${result.rank} - ${result.targetName}`, 14, yPos);
        yPos += 2;

        const criteriaHead = [['Round', 'Criterion', 'Avg Score', 'Max', 'Judges']];
        const criteriaBody: string[][] = [];
        for (const rb of result.roundBreakdowns) {
          for (const cb of rb.criteriaBreakdown) {
            criteriaBody.push([rb.roundName, cb.criterionName, String(cb.avgScore), String(cb.maxScore), String(cb.judgeCount)]);
          }
          criteriaBody.push(['', 'Round Total', String(rb.roundTotal), String(rb.maxScore), '']);
        }

        autoTable(doc, {
          startY: yPos,
          head: criteriaHead,
          body: criteriaBody,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [100, 100, 163], textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [250, 250, 255] },
          margin: { left: 14 },
        });

        yPos = (doc as any).lastAutoTable?.finalY + 8 || yPos + 40;
      }

      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text('Generated by NexEvent | VVCE Campus Innovation 2026 | Team Jungly Billi', 14, doc.internal.pageSize.height - 8);

      doc.save(`${event.title.replace(/\s+/g, '_')}_Results.pdf`);
      toast.success('Results PDF downloaded! 📄');
    } catch {
      toast.error('PDF export failed');
    }
    setExporting(false);
  }, [event, results, rounds, scoringType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!event || !canView) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-sm text-muted-foreground">You do not have permission to view results for this event.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate(previousView || 'event-detail', selectedEventId || undefined)}>
              <ArrowLeft className="w-3 h-3 mr-1" /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <span className="text-foreground font-medium">Results & Leaderboard</span>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Results & Leaderboard</h1>
            <p className="text-sm text-muted-foreground">{event.title}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              <Swords className="w-3 h-3 mr-1" /> {scoringType}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <BarChart3 className="w-3 h-3 mr-1" /> {results.length} Participants
            </Badge>
          </div>
        </div>

        {/* Podium - Top 3 */}
        {results.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {/* 2nd Place */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="order-1"
            >
              <Card className={`border-2 ${rankStyles[2].bg} h-full`}>
                <CardContent className="p-4 text-center">
                  <Medal className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 mb-2">2nd Place</Badge>
                  <p className="font-bold text-sm truncate">{results[1].targetName}</p>
                  <p className="text-lg font-bold text-slate-600 dark:text-slate-300 mt-1">{results[1].totalScore}</p>
                  <p className="text-[10px] text-muted-foreground">{results[1].targetType}</p>
                </CardContent>
              </Card>
            </motion.div>

            {/* 1st Place */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="order-2"
            >
              <Card className={`border-2 ${rankStyles[1].bg} h-full shadow-lg shadow-amber-500/10`}>
                <CardContent className="p-4 text-center">
                  <Crown className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                  <Badge className="bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200 mb-2">🏆 Champion</Badge>
                  <p className="font-bold truncate">{results[0].targetName}</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{results[0].totalScore}</p>
                  <p className="text-[10px] text-muted-foreground">{results[0].targetType}</p>
                </CardContent>
              </Card>
            </motion.div>

            {/* 3rd Place */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="order-3"
            >
              <Card className={`border-2 ${rankStyles[3].bg} h-full`}>
                <CardContent className="p-4 text-center">
                  <Award className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                  <Badge className="bg-orange-200 text-orange-700 dark:bg-orange-800 dark:text-orange-200 mb-2">3rd Place</Badge>
                  <p className="font-bold text-sm truncate">{results[2].targetName}</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-300 mt-1">{results[2].totalScore}</p>
                  <p className="text-[10px] text-muted-foreground">{results[2].targetType}</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Export Button */}
        {results.length > 0 && (
          <Button variant="outline" onClick={exportPDF} disabled={exporting} className="mb-4">
            {exporting ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Exporting...</>
            ) : (
              <><Download className="w-3 h-3 mr-1" /> Export Results as PDF</>
            )}
          </Button>
        )}
      </motion.div>

      {/* Full Ranking Table */}
      {results.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Full Rankings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-center p-3 font-medium text-muted-foreground w-12">Rank</th>
                      <th className="text-left p-3 font-medium text-muted-foreground min-w-[160px]">Team / Participant</th>
                      <th className="text-center p-3 font-medium text-muted-foreground w-16">Type</th>
                      {rounds.map(r => (
                        <th key={r.id} className="text-center p-3 font-medium text-muted-foreground min-w-[80px]">
                          <div className="text-xs">{r.name}</div>
                          <div className="text-[10px] text-muted-foreground/60">x{r.weight}</div>
                        </th>
                      ))}
                      <th className="text-center p-3 font-medium text-muted-foreground min-w-[80px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, idx) => {
                      const style = rankStyles[result.rank];
                      const isExpanded = expandedTarget === result.targetId;
                      return (
                        <React.Fragment key={result.targetId}>
                          <motion.tr
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className={`border-b border-border/30 cursor-pointer hover:bg-muted/10 transition-colors ${style ? style.bg : ''}`}
                            onClick={() => setExpandedTarget(isExpanded ? null : result.targetId)}
                          >
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center">
                                {style ? style.icon : <span className="font-bold text-muted-foreground">{result.rank}</span>}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  result.rank === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' :
                                  result.rank === 2 ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                                  result.rank === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                                  'bg-primary/10 text-primary'
                                }`}>
                                  {result.targetType === 'TEAM' ? <Users className="w-4 h-4" /> : result.targetName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{result.targetName}</p>
                                  {result.team && (
                                    <p className="text-[10px] text-muted-foreground">
                                      Leader: {result.team.leader?.name} • {result.team.members?.length || 0} members
                                    </p>
                                  )}
                                </div>
                                <span className="ml-auto">
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <Badge variant="outline" className="text-[10px]">{result.targetType}</Badge>
                            </td>
                            {rounds.map(r => {
                              const rb = result.roundBreakdowns.find(b => b.roundId === r.id);
                              return (
                                <td key={r.id} className="p-3 text-center">
                                  {rb ? (
                                    <span className="font-medium">{rb.roundTotal}</span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="p-3 text-center">
                              <span className={`font-bold text-base ${style ? style.text : 'text-primary'}`}>
                                {result.totalScore}
                              </span>
                            </td>
                          </motion.tr>

                          {/* Expanded: Per-criterion breakdown */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.tr
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="bg-muted/5"
                              >
                                <td colSpan={rounds.length + 4} className="p-4">
                                  <div className="space-y-3">
                                    {result.roundBreakdowns.map(rb => (
                                      <div key={rb.roundId}>
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge variant="secondary" className="text-xs">{rb.roundName}</Badge>
                                          <span className="text-xs text-muted-foreground">
                                            Total: {rb.roundTotal} / {rb.maxScore} (Weight: {rb.weight}x → {rb.weightedScore})
                                          </span>
                                        </div>
                                        {rb.criteriaBreakdown.length > 0 ? (
                                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                            {rb.criteriaBreakdown.map(cb => (
                                              <div key={cb.criterionName} className="p-2 rounded-lg border border-border/50 bg-background text-xs">
                                                <p className="font-medium text-muted-foreground">{cb.criterionName}</p>
                                                <div className="flex items-center gap-1 mt-1">
                                                  <span className="font-bold text-sm">{cb.avgScore}</span>
                                                  <span className="text-muted-foreground">/ {cb.maxScore}</span>
                                                </div>
                                                <div className="w-full bg-muted/50 rounded-full h-1.5 mt-1">
                                                  <div
                                                    className="h-1.5 rounded-full bg-primary transition-all"
                                                    style={{ width: `${Math.min((cb.avgScore / cb.maxScore) * 100, 100)}%` }}
                                                  />
                                                </div>
                                                <p className="text-[9px] text-muted-foreground mt-1">{cb.judgeCount} judge{cb.judgeCount !== 1 ? 's' : ''}</p>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-muted-foreground">No scores recorded for this round.</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </motion.tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">No Scores Yet</h3>
              <p className="text-sm text-muted-foreground">
                Results will appear here once judges have submitted their scores.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
