'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { useClubStore, Club } from '@/store/club-store';
import { Users, UserPlus, UserMinus, Loader2, Crown, Sparkles, Calendar, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export function ClubsView() {
  const { user, isAuthenticated } = useAuthStore();
  const { navigate } = useUIStore();
  const { clubs, isLoading, fetchClubs, joinClub, leaveClub } = useClubStore();
  const [expandedClub, setExpandedClub] = useState<string | null>(null);
  const [clubDetails, setClubDetails] = useState<Record<string, any>>({});

  useEffect(() => { fetchClubs(); }, [fetchClubs]);

  const loadClubDetail = async (id: string) => {
    if (clubDetails[id]) return;
    const res = await fetch(`/api/clubs/${id}`);
    if (res.ok) {
      const d = await res.json();
      setClubDetails(prev => ({ ...prev, [id]: d.club }));
    }
  };

  const handleJoin = async (clubId: string) => {
    try { await joinClub(clubId); toast.success('Joined club! 🎉'); fetchClubs(); }
    catch (e: any) { toast.error(e.message || 'Failed to join'); }
  };

  const handleLeave = async (clubId: string) => {
    try { await leaveClub(clubId); toast.success('Left club'); fetchClubs(); }
    catch (e: any) { toast.error(e.message || 'Failed to leave'); }
  };

  const isMember = (club: any) => user && club.members?.some((m: any) => m.userId === user.id);

  if (isLoading && clubs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading clubs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden mb-6 p-6 sm:p-8 bg-gradient-to-br from-chart-2/10 via-primary/5 to-chart-4/10 border border-primary/10"
      >
        <div className="absolute inset-0 dot-pattern opacity-20" />
        {[
          { top: 25, left: 15, duration: 4.2, delay: 0.3 },
          { top: 55, left: 75, duration: 5.1, delay: 1.1 },
          { top: 70, left: 40, duration: 3.8, delay: 0.7 },
          { top: 35, left: 85, duration: 4.7, delay: 0.5 },
        ].map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-chart-2/20"
            style={{ top: `${p.top}%`, left: `${p.left}%` }}
            animate={{ y: [0, -10, 0], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity }}
          />
        ))}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold">Campus Clubs</h1>
            <Badge className="bg-chart-2/10 text-chart-2 border-chart-2/20 text-xs">
              <Users className="w-2.5 h-2.5 mr-1" /> {clubs.length} Active
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Join clubs and discover their events</p>
        </div>
      </motion.div>

      {/* Clubs Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clubs.map((club, i) => (
          <motion.div
            key={club.id}
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 100 }}
            whileHover={{ y: -4 }}
          >
            <Card className="group hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 overflow-hidden border-border/50 hover:border-primary/30 cursor-pointer"
              onClick={() => navigate('club-detail', club.id)}>
              {/* Gradient top bar */}
              <div className={`h-2 bg-gradient-to-r ${categoryColors[club.category] || categoryColors.OTHER}`} />

              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{categoryIcons[club.category] || '📌'}</span>
                    <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{club.name}</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{club.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">{club.description}</p>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-primary/60" />
                    {club._count?.members || 0} members
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-primary/60" />
                    {club._count?.events || 0} events
                  </span>
                </div>

                {club.facultyAdvisor && (
                  <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
                    <Crown className="w-3 h-3 text-amber-500" />
                    <span>Advisor: <span className="font-medium text-foreground">{club.facultyAdvisor.name}</span></span>
                  </div>
                )}

                {isAuthenticated && (
                  <div className="flex gap-2 pt-3 border-t border-border/30">
                    {isMember(club) ? (
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive text-xs flex-1"
                        onClick={(e) => { e.stopPropagation(); handleLeave(club.id); }}>
                        <UserMinus className="w-3 h-3 mr-1" /> Leave
                      </Button>
                    ) : (
                      <Button size="sm" className="text-xs bg-primary hover:bg-primary/90 flex-1 shadow-md shadow-primary/10"
                        onClick={(e) => { e.stopPropagation(); handleJoin(club.id); }}>
                        <UserPlus className="w-3 h-3 mr-1" /> Join Club
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        const isExpanded = expandedClub === club.id;
                        setExpandedClub(isExpanded ? null : club.id);
                        if (!isExpanded) loadClubDetail(club.id);
                      }}>
                      {expandedClub === club.id ? 'Less' : 'Members'}
                    </Button>
                  </div>
                )}

                <AnimatePresence>
                  {expandedClub === club.id && clubDetails[club.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-border/30 space-y-2 max-h-48 overflow-y-auto">
                        {clubDetails[club.id].members?.map((m: any, mi: number) => (
                          <motion.div
                            key={m.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: mi * 0.05 }}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary">
                                {m.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </div>
                              <span className="font-medium">{m.user.name}</span>
                            </div>
                            {m.role !== 'member' && (
                              <Badge variant="secondary" className="text-[10px]">
                                {m.role === 'president' && <Crown className="w-2.5 h-2.5 mr-0.5 text-amber-500" />}
                                {m.role}
                              </Badge>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
