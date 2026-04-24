'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { useEventStore } from '@/store/event-store';
import {
  Zap, Calendar, Users, QrCode, FileText, ArrowRight,
  Sparkles, MapPin, Clock, CheckCircle2, Globe2, Leaf,
  Shield, BarChart3, ChevronDown, MousePointer2, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

// Floating shape component
function FloatingShape({ delay, duration, size, color, top, left, shape }: {
  delay: number; duration: number; size: number; color: string;
  top: string; left: string; shape: 'circle' | 'triangle' | 'hex' | 'square';
}) {
  const pathD = shape === 'triangle'
    ? `M${size/2} 0 L${size} ${size} L0 ${size} Z`
    : shape === 'hex'
    ? `M${size*0.25} 0 L${size*0.75} 0 L${size} ${size*0.5} L${size*0.75} ${size} L${size*0.25} ${size} L0 ${size*0.5} Z`
    : '';

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ top, left }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0.15, 0.3, 0.15],
        scale: [0.8, 1.1, 0.8],
        rotate: [0, 180, 360],
        y: [0, -20, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {shape === 'circle' ? (
        <div className="rounded-full" style={{ width: size, height: size, background: color, filter: 'blur(1px)' }} />
      ) : shape === 'square' ? (
        <div className="rounded-lg" style={{ width: size, height: size, background: color, filter: 'blur(1px)', transform: 'rotate(45deg)' }} />
      ) : (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: 'blur(1px)' }}>
          <path d={pathD} fill={color} />
        </svg>
      )}
    </motion.div>
  );
}

// Animated counter
function AnimatedCounter({ target, suffix = '' }: { target: string | number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const num = typeof target === 'string' ? parseInt(target) || 0 : target;
  const displayValue = isInView ? num : 0;

  return <span ref={ref}>{displayValue}{suffix}</span>;
}

// Marquee / Scrolling stats
function ScrollingMarquee() {
  const items = [
    '🎓 50+ Seminars Hosted', '💻 12 Hackathons This Year', '🎭 Cultural Fest Every Quarter',
    '🏆 Inter-College Sports', '⚡ 200+ Events Since Inception', '🌱 Go Green - Zero Paper',
    '📊 Real-time Analytics', '🔒 Secure QR Check-ins', '📱 Mobile-First Design',
  ];

  return (
    <div className="overflow-hidden py-3 bg-primary/5 border-y border-primary/10">
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      >
        {[...items, ...items].map((item, i) => (
          <span key={i} className="text-sm font-medium text-muted-foreground/70 flex items-center gap-2">
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export function LandingPage() {
  const { isAuthenticated } = useAuthStore();
  const { navigate, showLogin, showRegister } = useUIStore();
  const { fetchEvents } = useEventStore();
  const [stats, setStats] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Auto-redirect authenticated users to the feed
  useEffect(() => {
    if (isAuthenticated) {
      fetchEvents();
      navigate('feed');
    }
  }, [isAuthenticated, navigate, fetchEvents]);

  // Deterministic particle positions to avoid hydration mismatch
  const particlePositions = useMemo(() => [
    { top: 18, left: 12, duration: 4.2, delay: 0.3 },
    { top: 45, left: 78, duration: 5.1, delay: 1.1 },
    { top: 72, left: 35, duration: 3.8, delay: 0.7 },
    { top: 30, left: 65, duration: 6.3, delay: 2.0 },
    { top: 55, left: 90, duration: 4.7, delay: 0.5 },
    { top: 82, left: 18, duration: 5.5, delay: 1.5 },
    { top: 22, left: 50, duration: 3.5, delay: 2.3 },
    { top: 65, left: 8, duration: 6.0, delay: 0.9 },
    { top: 38, left: 42, duration: 4.9, delay: 1.8 },
    { top: 75, left: 72, duration: 3.2, delay: 2.6 },
    { top: 48, left: 25, duration: 5.8, delay: 0.2 },
    { top: 60, left: 55, duration: 4.4, delay: 1.3 },
  ], []);

  useEffect(() => {
    fetch('/api/stats?userId=demo').then(r => r.json()).then(d => setStats(d.stats)).catch(() => {});
  }, []);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      fetchEvents();
      navigate('feed');
    } else {
      showRegister();
    }
  };

  const features = [
    { icon: Calendar, title: 'Unified Event Feed', desc: 'Every campus event in one live stream. No more scattered WhatsApp groups.', color: 'from-violet-500 to-purple-600' },
    { icon: QrCode, title: 'QR Check-in', desc: 'Secure, geo-fenced attendance. No proxy, no queues, no paper.', color: 'from-emerald-500 to-teal-600' },
    { icon: FileText, title: 'Auto Reports', desc: 'PDF participation reports generated instantly. 100% reduction in manual filing.', color: 'from-amber-500 to-orange-600' },
    { icon: Shield, title: 'Verified Profiles', desc: 'Authenticated @vvce.ac.in identities. Faculty-approved events.', color: 'from-rose-500 to-pink-600' },
    { icon: BarChart3, title: 'Real-time Analytics', desc: 'Live dashboards for organizers and faculty. Track engagement instantly.', color: 'from-cyan-500 to-blue-600' },
    { icon: Globe2, title: 'Campus Agnostic', desc: 'Deploy at any university. Built to scale beyond VVCE.', color: 'from-fuchsia-500 to-purple-600' },
  ];

  const stats_display = [
    { value: stats?.totalEvents || 7, label: 'Events', icon: Calendar, suffix: '+' },
    { value: stats?.totalClubs || 5, label: 'Clubs', icon: Users, suffix: '' },
    { value: '3-5', label: 'Hrs Saved/Event', icon: Clock, suffix: 'h' },
    { value: 0, label: 'Paper Registers', icon: Leaf, suffix: '' },
  ];

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4">
        {/* Background effects */}
        <div className="absolute inset-0 dot-pattern opacity-40" />

        {/* Floating geometric shapes */}
        <FloatingShape delay={0} duration={6} size={40} color="oklch(0.55 0.2 265 / 0.2)" top="15%" left="8%" shape="circle" />
        <FloatingShape delay={1} duration={8} size={30} color="oklch(0.65 0.18 160 / 0.2)" top="25%" left="85%" shape="triangle" />
        <FloatingShape delay={2} duration={7} size={50} color="oklch(0.75 0.15 45 / 0.15)" top="65%" left="5%" shape="hex" />
        <FloatingShape delay={0.5} duration={9} size={25} color="oklch(0.6 0.22 330 / 0.2)" top="75%" left="90%" shape="square" />
        <FloatingShape delay={1.5} duration={7} size={35} color="oklch(0.55 0.2 265 / 0.15)" top="10%" left="60%" shape="hex" />
        <FloatingShape delay={3} duration={8} size={20} color="oklch(0.7 0.2 25 / 0.2)" top="80%" left="40%" shape="circle" />
        <FloatingShape delay={0.8} duration={6} size={28} color="oklch(0.6 0.18 160 / 0.15)" top="40%" left="92%" shape="triangle" />

        {/* Gradient blobs */}
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-chart-4/5 rounded-full blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[100px]" />

        {/* Animated particles */}
        {particlePositions.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/30"
            style={{
              top: `${p.top}%`,
              left: `${p.left}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}

        <motion.div
          className="relative z-10 max-w-4xl mx-auto text-center"
          style={{ y: heroY, opacity: heroOpacity }}
          variants={stagger}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={fadeUp}>
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium bg-primary/10 text-primary border-primary/20 animate-pulse-glow">
              <Sparkles className="w-3 h-3 mr-1.5" />
              Campus Innovation 2026 • Team Jungly Billi
            </Badge>
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1]">
            Every Campus Event.
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-primary via-chart-4 to-chart-2 bg-clip-text text-transparent animate-gradient">
                One Platform.
              </span>
              {/* Shimmer overlay */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer bg-[length:200%_100%]" />
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            NexEvent replaces scattered WhatsApp groups, paper registers, and manual reports with
            a unified digital ecosystem for VVCE.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={handleGetStarted}
              className="h-12 px-8 text-base font-semibold bg-primary hover:bg-primary/90 group relative overflow-hidden">
              <span className="relative z-10 flex items-center">
                Explore Events
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </span>
              {/* Button shimmer */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => {
              if (!isAuthenticated) showLogin();
              else navigate('feed');
            }} className="h-12 px-8 text-base glass">
              Sign In to Register
            </Button>
          </motion.div>

          {/* Stats row with animated counters */}
          <motion.div variants={fadeUp} className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl mx-auto">
            {stats_display.map((s, i) => (
              <motion.div
                key={i}
                className="text-center glass rounded-xl p-3"
                whileHover={{ scale: 1.05, y: -2 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="flex items-center justify-center mb-1">
                  <s.icon className="w-4 h-4 text-primary mr-1.5" />
                  <span className="text-2xl font-bold">
                    <AnimatedCounter target={s.value} suffix={s.suffix} />
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          animate={{ y: [0, 8, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-xs text-muted-foreground">Scroll to explore</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </section>

      {/* Scrolling Marquee */}
      <ScrollingMarquee />

      {/* Features Grid */}
      <section className="py-20 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <Badge variant="secondary" className="mb-4">Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Built for Campus Life</h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              From discovery to reporting — NexEvent handles the entire event lifecycle.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1, type: 'spring', stiffness: 100 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 hover:border-primary/30 transition-all duration-500 hover:shadow-lg hover:shadow-primary/5 overflow-hidden"
              >
                {/* Glow effect on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

                {/* Top-right accent */}
                <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${f.color} opacity-5 group-hover:opacity-10 transition-opacity duration-500`} />

                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>

                {/* Bottom border glow */}
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${f.color} scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-20 px-4 bg-muted/30 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 dot-pattern opacity-20" />

        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <Badge variant="secondary" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Simple. Fast. Paperless.</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Connecting line */}
            <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5">
              <motion.div
                className="h-full bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, delay: 0.5 }}
              />
            </div>

            {[
              { step: '01', icon: Calendar, title: 'Create Event', desc: 'Organizer submits event for faculty approval', color: 'from-violet-500 to-purple-600' },
              { step: '02', icon: CheckCircle2, title: 'Get Approved', desc: 'Faculty reviews and approves with one click', color: 'from-emerald-500 to-teal-600' },
              { step: '03', icon: QrCode, title: 'Register & Check-in', desc: 'Students register, scan QR at venue with geo-fence', color: 'from-amber-500 to-orange-600' },
              { step: '04', icon: FileText, title: 'Auto Report', desc: 'PDF reports generated instantly — no manual work', color: 'from-rose-500 to-pink-600' },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.2, type: 'spring' }}
                className="relative text-center"
              >
                <motion.div
                  className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4 relative group"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <s.icon className="w-7 h-7 text-primary" />
                  <motion.span
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-primary to-chart-4 text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-lg"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2 + 0.3, type: 'spring', stiffness: 200 }}
                  >
                    {s.step}
                  </motion.span>
                  {/* Pulse ring */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-primary/20"
                    animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                  />
                </motion.div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonials */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <Badge variant="secondary" className="mb-4">Trusted By</Badge>
            <h2 className="text-3xl font-bold">Campus Impact</h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { quote: '"No more 6 AM WhatsApp forwards about event venues."', who: 'Student, CSE Dept', stars: 5 },
              { quote: '"Attendance tracking went from 2 hours to 2 minutes."', who: 'Faculty Advisor', stars: 5 },
              { quote: '"Created and managed a 200-participant hackathon seamlessly."', who: 'Club Organizer', stars: 5 },
            ].map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ y: -4 }}
                className="glass rounded-2xl p-6 border border-border/30 hover:border-primary/20 transition-all duration-300"
              >
                <div className="flex gap-0.5 mb-3">
                  {[...Array(t.stars)].map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-3">{t.quote}</p>
                <p className="text-xs text-muted-foreground font-medium">{t.who}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-chart-4/10 border border-primary/20 p-12 relative overflow-hidden"
        >
          <div className="absolute inset-0 dot-pattern opacity-30" />

          {/* Animated gradient border */}
          <motion.div
            className="absolute inset-0 rounded-3xl"
            style={{
              background: 'conic-gradient(from 0deg, transparent, oklch(0.55 0.2 265 / 0.3), transparent, oklch(0.6 0.22 330 / 0.3), transparent)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />
          <div className="absolute inset-[1px] rounded-3xl bg-background" />

          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-3">Ready to Go Digital?</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Join NexEvent and never miss a campus event again. Registration is free — all you need is your @vvce.ac.in email.
            </p>

            {/* Pulsing CTA */}
            <div className="relative inline-block">
              <motion.div
                className="absolute inset-0 rounded-lg bg-primary/30"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <Button size="lg" onClick={handleGetStarted} className="bg-primary hover:bg-primary/90 relative z-10">
                Get Started Now <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure</span>
              <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Fast Setup</span>
              <span className="flex items-center gap-1"><Leaf className="w-3 h-3" /> Paperless</span>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
