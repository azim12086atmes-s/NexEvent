'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { X, Mail, Lock, User, Building2, Hash, Phone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

export function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const { login, register, isLoading, error, clearError } = useAuthStore();

  const [form, setForm] = useState({
    email: '', password: '', name: '', role: 'STUDENT',
    department: '', usn: '', phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      onClose();
      setForm({ email: '', password: '', name: '', role: 'STUDENT', department: '', usn: '', phone: '' });
    } catch {}
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    clearError();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md glass border-border/30" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            {mode === 'login' ? 'Welcome Back' : 'Join NexEvent'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          {mode === 'register' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="name" placeholder="Your full name" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="pl-9 h-9" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="ORGANIZER">Organizer</SelectItem>
                    <SelectItem value="FACULTY">Faculty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(form.role === 'STUDENT' || form.role === 'ORGANIZER') && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">USN</Label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="4VV22CS001" value={form.usn}
                      onChange={(e) => setForm({ ...form, usn: e.target.value })}
                      className="pl-9 h-9" />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Department</Label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Computer Science" value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="pl-9 h-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="9876543210" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="pl-9 h-9" />
                </div>
              </div>
            </motion.div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium">College Email</Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="you@vvce.ac.in" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="pl-9 h-9" required />
            </div>
            <p className="text-[10px] text-muted-foreground">Must be a @vvce.ac.in email address</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium">Password</Label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="password" type="password" placeholder="••••••" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="pl-9 h-9" required minLength={6} />
            </div>
          </div>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </motion.p>
          )}

          <Button type="submit" className="w-full h-9" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={switchMode} className="text-primary font-medium hover:underline">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          {mode === 'login' && (
            <div className="border-t border-border/40 pt-3 space-y-1.5">
              <p className="text-[10px] text-muted-foreground text-center font-medium">DEMO ACCOUNTS</p>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                {[
                  { label: 'Admin', email: 'admin@vvce.ac.in', pw: 'admin123' },
                  { label: 'Faculty', email: 'priya.sharma@vvce.ac.in', pw: 'faculty123' },
                  { label: 'Organizer', email: 'rahul.gowda@vvce.ac.in', pw: 'org123' },
                  { label: 'Student', email: 'aditi.n@vvce.ac.in', pw: 'student123' },
                ].map((d) => (
                  <button key={d.label} type="button"
                    onClick={() => setForm({ ...form, email: d.email, password: d.pw })}
                    className="px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-left">
                    <span className="font-medium">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
