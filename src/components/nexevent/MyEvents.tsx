'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { Calendar, MapPin, Clock, Users, CheckCircle2, XCircle, QrCode, Loader2, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const statusColors: Record<string, string> = {
  CONFIRMED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  REGISTERED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  WAITLISTED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
};

export function MyEvents() {
  const { user } = useAuthStore();
  const { navigate } = useUIStore();
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [qrDialog, setQrDialog] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const res = await fetch(`/api/users/me/events?userId=${user.id}`);
        if (res.ok) { const d = await res.json(); setRegistrations(d.registrations || []); }
      } catch {}
      setIsLoading(false);
    };
    load();
  }, [user]);

  if (!user) return null;
  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const active = registrations.filter(r => r.status !== 'CANCELLED');
  const cancelled = registrations.filter(r => r.status === 'CANCELLED');

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Events</h1>
        <p className="text-sm text-muted-foreground">{active.length} active registrations</p>
      </div>

      {active.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">You haven&apos;t registered for any events yet</p>
            <Button onClick={() => navigate('feed')} className="mt-3 bg-primary hover:bg-primary/90">Browse Events</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 mb-8">
          {active.map((reg, i) => (
            <motion.div key={reg.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate('event-detail', reg.event.id)}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{reg.event.title}</h3>
                      <Badge className={`text-[10px] shrink-0 ${statusColors[reg.status]}`}>{reg.status}</Badge>
                      {reg.attendance && (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Checked in
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(reg.event.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {reg.event.venue}</span>
                    </div>
                  </div>
                  {reg.qrCode && !reg.attendance && (
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setQrDialog(reg.id); }}>
                      <QrCode className="w-3 h-3 mr-1" /> QR
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {cancelled.length > 0 && (
        <>
          <h2 className="font-semibold text-sm text-muted-foreground mb-3">Cancelled</h2>
          <div className="space-y-2">
            {cancelled.map((reg) => (
              <Card key={reg.id} className="opacity-60">
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="text-sm line-through">{reg.event.title}</span>
                  <Badge variant="secondary" className="text-[10px]">Cancelled</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* QR Dialog */}
      <Dialog open={!!qrDialog} onOpenChange={() => { setQrDialog(null); setCopiedCode(false); }}>
        <DialogContent className="sm:max-w-xs" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-center">Your Check-in QR</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {qrDialog && (() => {
              const reg = registrations.find(r => r.id === qrDialog);
              return reg?.qrCode ? (
                <>
                  <div className="bg-white p-4 rounded-xl shadow-sm">
                    <QRCodeSVG value={reg.qrCode} size={180} />
                  </div>
                  <div className="mt-3 text-center">
                    <p className="font-semibold text-sm">{reg.event.title}</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <Badge className={`text-[10px] ${statusColors[reg.status]}`}>{reg.status}</Badge>
                      {reg.attendance && (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Checked in
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">Show this at the venue entrance</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(reg.qrCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                  >
                    {copiedCode ? (
                      <><Check className="w-3 h-3 mr-1.5 text-emerald-500" /> Copied!</>
                    ) : (
                      <><Copy className="w-3 h-3 mr-1.5" /> Copy Code</>
                    )}
                  </Button>
                  <p className="text-[9px] text-muted-foreground mt-2 font-mono break-all max-w-[250px]">{reg.qrCode}</p>
                </>
              ) : null;
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
