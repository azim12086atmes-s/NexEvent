'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { useEventStore, EventCategory } from '@/store/event-store';
import {
  Calendar, MapPin, Clock, Users, Filter, Search,
  Sparkles, Zap, Loader2, ArrowUpRight, TrendingUp,
  Radio, Timer, Hash, Flame, Swords
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

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

const categoryBgColors: Record<string, string> = {
  HACKATHON: 'bg-violet-50 dark:bg-violet-950/20',
  TECHNICAL: 'bg-cyan-50 dark:bg-cyan-950/20',
  CULTURAL: 'bg-rose-50 dark:bg-rose-950/20',
  WORKSHOP: 'bg-amber-50 dark:bg-amber-950/20',
  SEMINAR: 'bg-emerald-50 dark:bg-emerald-950/20',
  SPORTS: 'bg-green-50 dark:bg-green-950/20',
  SOCIAL: 'bg-fuchsia-50 dark:bg-fuchsia-950/20',
  OTHER: 'bg-gray-50 dark:bg-gray-950/20',
};

const categoryIcons: Record<string, string> = {
  HACKATHON: '💻', TECHNICAL: '⚡', CULTURAL: '🎭', WORKSHOP: '🔧',
  SEMINAR: '🎓', SPORTS: '🏆', SOCIAL: '🌱', OTHER: '📌',
};

const statusColors: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  LIVE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  COMPLETED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getTimeUntil(d: string | Date): { text: string; urgent: boolean } {
  const now = new Date();
  const target = new Date(d);
  const diff = target.getTime() - now.getTime();
  if (diff < 0) return { text: 'Started', urgent: false };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 7) return { text: `${Math.floor(days / 7)}w ${days % 7}d`, urgent: false };
  if (days > 0) return { text: `${days}d ${hours % 24}h`, urgent: days <= 2 };
  if (hours > 0) return { text: `${hours}h`, urgent: hours <= 6 };
  const mins = Math.floor(diff / (1000 * 60));
  return { text: `${mins}m`, urgent: true };
}

function EventCard({ event, index, onRegister, registering, isFeatured }: {
  event: any; index: number; onRegister: (id: string) => void; registering: string | null; isFeatured: boolean;
}) {
  const { navigate } = useUIStore();
  const { user } = useAuthStore();
  const timeUntil = getTimeUntil(event.startDate);
  const regCount = event._count?.registrations || 0;
  const maxP = event.maxParticipants;
  const regPercent = maxP ? Math.min((regCount / maxP) * 100, 100) : 0;
  const isTrending = regCount >= 3;
  const isLive = event.status === 'LIVE';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 100 }}
      layout
      className={isFeatured ? 'sm:col-span-2 lg:col-span-2' : ''}
    >
      <Card
        className="group cursor-pointer hover:shadow-xl hover:shadow-primary/8 transition-all duration-500 border-border/50 hover:border-primary/30 overflow-hidden relative"
        onClick={() => navigate('event-detail', event.id)}
      >
        {/* Gradient top bar */}
        <div className={`h-2 bg-gradient-to-r ${categoryColors[event.category] || categoryColors.OTHER} relative`}>
          {isLive && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-rose-400 to-rose-600"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>

        {/* Shimmer on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </div>

        <CardContent className={`p-5 ${isFeatured ? 'p-6' : ''}`}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">{categoryIcons[event.category] || '📌'}</span>
              <Badge variant="secondary" className={`text-[10px] font-semibold ${statusColors[event.status]}`}>
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 animate-pulse" />}
                {event.status}
              </Badge>
              {isTrending && (
                <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  <Flame className="w-2.5 h-2.5 mr-0.5" /> Trending
                </Badge>
              )}
              {(event as any).eventType === 'COMPETITION' && (
                <Badge className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                  <Swords className="w-2.5 h-2.5 mr-0.5" /> Competition
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {(event as any).userRegistration && (
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  ✓ Registered
                </Badge>
              )}
              {timeUntil.urgent && !isLive && (
                <Badge className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 animate-pulse">
                  <Timer className="w-2.5 h-2.5 mr-0.5" /> {timeUntil.text}
                </Badge>
              )}
            </div>
          </div>

          <h3 className={`font-semibold mb-1.5 group-hover:text-primary transition-colors line-clamp-2 ${isFeatured ? 'text-xl' : 'text-base'}`}>
            {event.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{event.description}</p>

          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 shrink-0 text-primary/60" />
              <span className="truncate">{event.venue}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 shrink-0 text-primary/60" />
              <span>{formatDate(event.startDate)} • {formatTime(event.startDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 shrink-0 text-primary/60" />
                <span>{regCount} registered{maxP ? ` / ${maxP}` : ''}</span>
              </div>
              {!isLive && !timeUntil.urgent && (
                <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> in {timeUntil.text}
                </span>
              )}
            </div>
          </div>

          {/* Registration progress bar */}
          {maxP && (
            <div className="mt-3">
              <Progress value={regPercent} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {regPercent >= 90 ? '🔥 Almost full!' : regPercent >= 50 ? 'Filling up fast' : 'Spots available'}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
            <div className="flex items-center gap-2">
              {event.club && (
                <Badge variant="outline" className="text-[10px]">{event.club.name}</Badge>
              )}
              {event.tags && event.tags.split(',').filter(Boolean).slice(0, 2).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[10px] bg-muted/50">#{tag.trim()}</Badge>
              ))}
            </div>
            <motion.div
              whileHover={{ scale: 1.1, rotate: -10 }}
              className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function EventFeed() {
  const { user } = useAuthStore();
  const { navigate, searchQuery } = useUIStore();
  const { events, filters, isLoading, fetchEvents, setFilters, clearFilters } = useEventStore();
  const [registering, setRegistering] = useState<string | null>(null);
  const [activeCategoryPill, setActiveCategoryPill] = useState<EventCategory | null>(null);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const categories: EventCategory[] = ['TECHNICAL', 'CULTURAL', 'SPORTS', 'WORKSHOP', 'SEMINAR', 'HACKATHON', 'SOCIAL', 'OTHER'];

  const filtered = useMemo(() => {
    let result = events;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q) ||
        e.tags?.toLowerCase().includes(q)
      );
    }
    const cat = activeCategoryPill || filters.category;
    if (cat) result = result.filter(e => e.category === cat);
    return result;
  }, [events, searchQuery, filters.category, activeCategoryPill]);

  const handleRegister = async (eventId: string) => {
    setRegistering(eventId);
    try {
      await useEventStore.getState().registerForEvent(eventId);
    } catch {}
    setRegistering(null);
  };

  // Separate featured events (most registered) from regular
  const sortedEvents = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aReg = a._count?.registrations || 0;
      const bReg = b._count?.registrations || 0;
      return bReg - aReg;
    });
  }, [filtered]);

  if (isLoading && events.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden mb-6 p-6 sm:p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-chart-4/10 border border-primary/10"
      >
        <div className="absolute inset-0 dot-pattern opacity-20" />
        {/* Floating particles */}
        {[
          { top: 25, left: 15, duration: 4.2, delay: 0.3 },
          { top: 55, left: 75, duration: 5.1, delay: 1.1 },
          { top: 70, left: 40, duration: 3.8, delay: 0.7 },
          { top: 35, left: 85, duration: 4.7, delay: 0.5 },
          { top: 80, left: 20, duration: 5.5, delay: 1.5 },
          { top: 40, left: 55, duration: 3.5, delay: 2.3 },
        ].map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-primary/20"
            style={{ top: `${p.top}%`, left: `${p.left}%` }}
            animate={{ y: [0, -15, 0], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity }}
          />
        ))}

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold">Campus Events</h1>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                <Radio className="w-2.5 h-2.5 mr-1" /> Live
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Discover and register for events at VVCE</p>
          </div>
          {(user?.role === 'ORGANIZER' || user?.role === 'FACULTY' || user?.role === 'ADMIN') && (
            <Button onClick={() => navigate('create-event')} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              <Zap className="w-4 h-4 mr-2" /> Create Event
            </Button>
          )}
        </div>
      </motion.div>

      {/* Category Pills */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-2 mb-4"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { setActiveCategoryPill(null); setFilters({ category: null }); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
            !activeCategoryPill && !filters.category
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          All
        </motion.button>
        {categories.map(c => (
          <motion.button
            key={c}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setActiveCategoryPill(c); setFilters({ category: c }); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 flex items-center gap-1 ${
              activeCategoryPill === c || filters.category === c
                ? `bg-gradient-to-r ${categoryColors[c]} text-white shadow-md`
                : `${categoryBgColors[c] || 'bg-muted/50'} text-muted-foreground hover:text-foreground`
            }`}
          >
            <span>{categoryIcons[c]}</span>
            <span className="hidden sm:inline">{c}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button variant="outline" size="sm"
          className={filters.upcoming ? 'bg-primary/10 text-primary border-primary/30' : ''}
          onClick={() => setFilters({ upcoming: !filters.upcoming })}>
          <Clock className="w-3 h-3 mr-1" /> Upcoming
        </Button>
        {(activeCategoryPill || filters.category) && (
          <Button variant="ghost" size="sm" onClick={() => { setActiveCategoryPill(null); clearFilters(); }}>
            Clear Filters
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <Hash className="w-3 h-3" /> {filtered.length} events
        </span>
      </div>

      {/* Event Cards Grid */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-20"
        >
          {/* Animated empty state */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <motion.div
              className="absolute inset-0 rounded-2xl border-2 border-dashed border-muted-foreground/20"
              animate={{ rotate: [0, 90, 180, 270, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            />
            <Calendar className="w-10 h-10 text-muted-foreground/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-lg font-medium text-muted-foreground">No events found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your filters or check back later</p>
          {(user?.role === 'ORGANIZER' || user?.role === 'FACULTY' || user?.role === 'ADMIN') && (
            <Button onClick={() => navigate('create-event')} className="mt-4 bg-primary hover:bg-primary/90">
              <Zap className="w-4 h-4 mr-2" /> Create One Now
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {sortedEvents.map((event, i) => (
              <EventCard
                key={event.id}
                event={event}
                index={i}
                onRegister={handleRegister}
                registering={registering}
                isFeatured={i === 0 && (event._count?.registrations || 0) >= 2}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
