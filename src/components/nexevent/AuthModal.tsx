'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { Mail, Lock, User, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// Simple hash to generate a googleId from email
function generateGoogleId(email: string): string {
  let hash = 0;
  const str = `google-oauth-${email}-${Date.now()}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `g-${Math.abs(hash).toString(36)}`;
}

// Google SVG icon component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

export function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const { login, register, googleLogin, isLoading, error, clearError } = useAuthStore();

  const [form, setForm] = useState({
    email: '', password: '', name: '',
  });

  // Google sign-in dialog state
  const [showGoogleDialog, setShowGoogleDialog] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleStep, setGoogleStep] = useState<'email' | 'loading' | 'success' | 'pending-approval'>('email');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form);
        // After registration, show message and switch to login
        // User needs admin approval before they can log in
      }
      onClose();
      setForm({ email: '', password: '', name: '' });
    } catch {}
  };

  const handleGoogleClick = () => {
    setGoogleEmail('');
    setGoogleName('');
    setGoogleStep('email');
    setShowGoogleDialog(true);
  };

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = googleEmail.includes('@') ? googleEmail : `${googleEmail}@vvce.ac.in`;

    if (!email.endsWith('@vvce.ac.in')) {
      toast.error('Only @vvce.ac.in email addresses are allowed');
      return;
    }

    setGoogleStep('loading');

    try {
      const googleId = generateGoogleId(email);
      const result = await googleLogin({
        googleToken: `sim-${Date.now()}`,
        email,
        name: googleName || email.split('@')[0],
        googleId,
      });

      if (result.isNewUser) {
        setGoogleStep('pending-approval');
      } else {
        setGoogleStep('success');
        setTimeout(() => {
          setShowGoogleDialog(false);
          onClose();
        }, 1200);
      }
    } catch {
      setGoogleStep('email');
    }
  };

  const closeGoogleDialog = () => {
    if (googleStep !== 'loading') {
      setShowGoogleDialog(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    clearError();
  };

  return (
    <>
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
                <p className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-md">
                  Your role and department will be assigned by the admin after approval.
                </p>
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

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/40" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            {/* Sign in with Google button */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-10 bg-white hover:bg-gray-50 border-gray-300 text-gray-700 font-medium transition-all hover:shadow-md"
              onClick={handleGoogleClick}
              disabled={isLoading}
            >
              <GoogleIcon className="w-4 h-4 mr-2" />
              Sign in with Google
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button type="button" onClick={switchMode} className="text-primary font-medium hover:underline">
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>

            {mode === 'login' && (
              <div className="border-t border-border/40 pt-3 space-y-1.5">
                <p className="text-[10px] text-muted-foreground text-center font-medium">DEMO ACCOUNTS <span className="opacity-60">(password: demo123)</span></p>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  {[
                    { label: '👑 Admin', email: 'admin@vvce.ac.in', color: 'bg-rose-50 dark:bg-rose-950/30' },
                    { label: '🎓 HOD', email: 'hod.cs@vvce.ac.in', color: 'bg-amber-50 dark:bg-amber-950/30' },
                    { label: '🏫 Faculty', email: 'priya.sharma@vvce.ac.in', color: 'bg-violet-50 dark:bg-violet-950/30' },
                    { label: '📚 Student', email: 'aditi.n@vvce.ac.in', color: 'bg-emerald-50 dark:bg-emerald-950/30' },
                    { label: '👤 Guest', email: 'guest@vvce.ac.in', color: 'bg-slate-50 dark:bg-slate-950/30' },
                  ].map((d) => (
                    <button key={d.label} type="button"
                      onClick={() => setForm({ ...form, email: d.email, password: 'demo123' })}
                      className={`px-2 py-1.5 rounded-md ${d.color} hover:opacity-80 text-muted-foreground hover:text-foreground transition-colors text-left`}>
                      <span className="font-medium">{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Simulated Google Sign-In Dialog */}
      <Dialog open={showGoogleDialog} onOpenChange={closeGoogleDialog}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <AnimatePresence mode="wait">
            {googleStep === 'email' && (
              <motion.div
                key="email-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-center flex items-center justify-center gap-2">
                    <GoogleIcon className="w-6 h-6" />
                    Sign in with Google
                  </DialogTitle>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                  {/* Simulated Google account chooser */}
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                    <p className="text-sm text-center text-muted-foreground">
                      Choose an account to continue to <span className="font-semibold text-foreground">NexEvent</span>
                    </p>

                    {/* Simulated existing account suggestion */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setGoogleEmail('aditi.n@vvce.ac.in');
                          setGoogleName('Aditi N');
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium text-sm">
                          AN
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">Aditi N</p>
                          <p className="text-xs text-muted-foreground truncate">aditi.n@vvce.ac.in</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGoogleEmail('priya.sharma@vvce.ac.in');
                          setGoogleName('Priya Sharma');
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                          PS
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">Priya Sharma</p>
                          <p className="text-xs text-muted-foreground truncate">priya.sharma@vvce.ac.in</p>
                        </div>
                      </button>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                      <p className="text-xs text-muted-foreground mb-2">Or use another account:</p>
                      <form onSubmit={handleGoogleSubmit} className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="google-name" className="text-xs font-medium">Full Name</Label>
                          <Input
                            id="google-name"
                            placeholder="Your name"
                            value={googleName}
                            onChange={(e) => setGoogleName(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="google-email" className="text-xs font-medium">College Email</Label>
                          <div className="flex items-center gap-0">
                            <Input
                              id="google-email"
                              placeholder="your.name"
                              value={googleEmail.includes('@') ? googleEmail.split('@')[0] : googleEmail}
                              onChange={(e) => setGoogleEmail(e.target.value)}
                              className="h-9 rounded-r-none focus:z-10"
                              autoFocus
                            />
                            <div className="h-9 px-3 flex items-center bg-muted border border-l-0 border-input rounded-r-md text-xs text-muted-foreground whitespace-nowrap">
                              @vvce.ac.in
                            </div>
                          </div>
                        </div>
                        <Button type="submit" className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white">
                          Continue with Google
                        </Button>
                      </form>
                    </div>
                  </div>

                  <p className="text-[10px] text-center text-muted-foreground">
                    This is a simulated Google Sign-In for demo purposes.
                    <br />
                    Only @vvce.ac.in emails are accepted.
                  </p>
                </div>
              </motion.div>
            )}

            {googleStep === 'loading' && (
              <motion.div
                key="loading-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="py-12 flex flex-col items-center justify-center gap-4"
              >
                <div className="relative">
                  <GoogleIcon className="w-12 h-12" />
                  <Loader2 className="w-5 h-5 absolute -bottom-1 -right-1 animate-spin text-blue-600" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Signing you in...</p>
                  <p className="text-xs text-muted-foreground">Verifying your Google account</p>
                </div>
              </motion.div>
            )}

            {googleStep === 'success' && (
              <motion.div
                key="success-step"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="py-12 flex flex-col items-center justify-center gap-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
                >
                  <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                </motion.div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-semibold">Welcome back!</p>
                  <p className="text-sm text-muted-foreground">Successfully signed in with Google</p>
                </div>
              </motion.div>
            )}

            {googleStep === 'pending-approval' && (
              <motion.div
                key="pending-step"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="py-8 flex flex-col items-center justify-center gap-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  <AlertCircle className="w-16 h-16 text-amber-500" />
                </motion.div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-semibold">Account Created!</p>
                  <p className="text-sm text-muted-foreground">
                    Your account has been created via Google Sign-In.
                  </p>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Your account is pending admin approval.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You&apos;ll be able to sign in once an administrator approves your account.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setShowGoogleDialog(false);
                    setMode('login');
                  }}
                  className="mt-2"
                >
                  Got it
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
