'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { ScanLine, CheckCircle2, XCircle, AlertTriangle, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function QRScanner() {
  const { user } = useAuthStore();
  const { navigate } = useUIStore();
  const [eventId, setEventId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleCheckIn = async () => {
    if (!user || !eventId || !qrCode) return;
    setIsCheckingIn(true);
    setResult(null);

    // Try to get geolocation
    let lat: number | undefined, lng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    try {
      const res = await fetch(`/api/events/${eventId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, qrCode, latitude: lat, longitude: lng }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, data });
      if (res.ok) toast.success(data.message);
      else toast.error(data.error);
    } catch {
      setResult({ ok: false, data: { error: 'Check-in failed' } });
      toast.error('Check-in failed');
    }
    setIsCheckingIn(false);
  };

  if (!user || (user.role !== 'FACULTY' && user.role !== 'ADMIN' && user.role !== 'ORGANIZER')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ScanLine className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-lg font-medium">Access Restricted</p>
          <p className="text-sm text-muted-foreground">Only faculty and organizers can scan QR codes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-primary" /> QR Check-in
          </h1>
          <p className="text-sm text-muted-foreground">Scan student QR codes for attendance</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manual QR Check-in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Event ID</Label>
              <Input placeholder="Enter event ID" value={eventId}
                onChange={(e) => setEventId(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">QR Code Value</Label>
              <Input placeholder="Paste or scan QR code value" value={qrCode}
                onChange={(e) => setQrCode(e.target.value)} className="h-9 font-mono text-xs" />
            </div>

            <Button onClick={handleCheckIn} disabled={isCheckingIn || !eventId || !qrCode}
              className="w-full bg-primary hover:bg-primary/90">
              {isCheckingIn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ScanLine className="w-4 h-4 mr-2" />}
              Check In
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className={`mt-4 ${result.ok ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    {result.ok ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                    <div>
                      <p className={`font-semibold ${result.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                        {result.ok ? 'Check-in Successful' : 'Check-in Failed'}
                      </p>
                      <p className="text-sm text-muted-foreground">{result.data.message || result.data.error}</p>
                    </div>
                  </div>
                  {result.ok && result.data.attendance && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p>Status: <Badge variant="outline" className="text-[10px]">{result.data.attendance.status}</Badge></p>
                      {result.data.attendance.isWithinGeoFence === false && (
                        <p className="text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Outside geo-fence radius
                        </p>
                      )}
                      <p>Time: {new Date(result.data.attendance.checkInTime).toLocaleTimeString('en-IN')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info */}
        <Card className="mt-4 bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>How it works:</strong> Students register for an event and receive a unique QR code.
              At the venue, scan or enter the QR code value to check them in. If the event has geo-fencing enabled,
              the system validates that the student is physically at the venue within the configured radius.
              Proxy attendance from outside the venue will be flagged.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
