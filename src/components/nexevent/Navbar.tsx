'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  Zap, Calendar, Users, Menu, X, LogOut,
  PlusCircle, LayoutDashboard, Shield, User, Search,
  ScanLine, BookmarkCheck, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NotificationPanel } from './NotificationPanel';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { currentView, navigate, showLogin, showRegister, searchQuery, setSearchQuery } = useUIStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = isAuthenticated ? [
    { icon: Calendar, label: 'Events', view: 'feed' as const },
    { icon: BookmarkCheck, label: 'My Events', view: 'my-events' as const },
    { icon: Users, label: 'Clubs', view: 'clubs' as const },
    ...(user?.role === 'ORGANIZER' || user?.role === 'FACULTY' || user?.role === 'ADMIN'
      ? [
          { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' as const },
          { icon: PlusCircle, label: 'Create', view: 'create-event' as const },
        ]
      : []),
    ...(user?.role === 'FACULTY' || user?.role === 'ADMIN'
      ? [
          { icon: Shield, label: 'Admin', view: 'admin' as const },
          { icon: ScanLine, label: 'Scan QR', view: 'scan-qr' as const },
        ]
      : []),
  ] : [];

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const roleColors: Record<string, string> = {
    STUDENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    ORGANIZER: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    FACULTY: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
    ADMIN: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-4 gap-4">
        {/* Logo */}
        <motion.button
          onClick={() => navigate('landing')}
          className="flex items-center gap-2 shrink-0 group"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="relative w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/20">
            <Zap className="w-4 h-4 text-primary-foreground" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-chart-4 animate-pulse" />
          </div>
          <span className="font-bold text-lg tracking-tight hidden sm:block">
            Nex<span className="text-primary">Event</span>
          </span>
        </motion.button>

        {/* Search bar - only when authenticated */}
        {isAuthenticated && currentView !== 'landing' && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            className="flex-1 max-w-md hidden md:block"
          >
            <div className="relative group">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search events, clubs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30 text-sm transition-all"
              />
            </div>
          </motion.div>
        )}

        {/* Desktop Nav */}
        {isAuthenticated ? (
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => (
              <motion.button
                key={item.view}
                onClick={() => navigate(item.view)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  currentView === item.view
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {currentView === item.view && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-primary/10 rounded-md"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </motion.button>
            ))}
          </nav>
        ) : (
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={showLogin}>Sign In</Button>
            <Button size="sm" onClick={showRegister} className="bg-primary hover:bg-primary/90 shadow-md shadow-primary/20">
              Get Started
            </Button>
          </div>
        )}

        {/* Right side: Notifications + User menu */}
        <div className="flex items-center gap-1.5">
          {isAuthenticated && <NotificationPanel />}

          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-0.5 hover:bg-muted/50 transition-colors">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {user ? getInitials(user.name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-semibold">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  {user?.role && (
                    <Badge variant="secondary" className={`mt-1 text-[10px] ${roleColors[user.role]}`}>
                      {user.role}
                    </Badge>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('profile')} className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('my-events')} className="cursor-pointer">
                  <Calendar className="w-4 h-4 mr-2" /> My Events
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { logout(); navigate('landing'); }} className="text-destructive cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile menu toggle */}
          <Button
            variant="ghost" size="icon" className="md:hidden h-8 w-8"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl"
          >
            <div className="p-3 space-y-1">
              {isAuthenticated ? (
                <>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search events..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 bg-muted/50 border-0"
                    />
                  </div>
                  {navItems.map((item, i) => (
                    <motion.button
                      key={item.view}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => { navigate(item.view); setMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        currentView === item.view ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </motion.button>
                  ))}
                </>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { showLogin(); setMobileMenuOpen(false); }}>Sign In</Button>
                  <Button className="flex-1 bg-primary" onClick={() => { showRegister(); setMobileMenuOpen(false); }}>Get Started</Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
