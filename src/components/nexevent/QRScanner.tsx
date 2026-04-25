'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  ScanLine, CheckCircle2, XCircle, AlertTriangle, Loader2,
  MapPin, Camera, Keyboard, Zap, Shield, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export function QRScanner() {
  const { user } = useAuthStore();
  const { navigate } = useUIStore();
  const [eventId, setEventId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const scannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Load events for dropdown
  useEffect(() => {
    if (!user) return;
    const loadEvents = async () => {
      try {
        const res = await fetch(`/api/events?status=APPROVED,LIVE&userId=${user.id}&limit=50`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch {}
    };
    loadEvents();
  }, [user]);

  // Start/stop camera scanner
  const startScanner = useCallback(async () => {
    if (!scannerContainerRef.current) return;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          // QR code detected!
          setQrCode(decodedText);
          toast.success('QR code detected!');
          // Stop scanner after detection
          scanner.stop().then(() => {
            setIsScanning(false);
          }).catch(() => {});
        },
        () => {
          // QR code not found (this fires continuously, ignore)
        }
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error('Camera error:', err);
      toast.error('Camera access denied or not available. Use manual input instead.');
      setScanMode('manual');
    }
  }, []);

  const stopScanner = useCallback(() => {
    if (scannerRef.current && isScanning) {
      scannerRef.current.stop().then(() => {
        scannerRef.current.clear();
        setIsScanning(false);
      }).catch(() => {
        setIsScanning(false);
      });
    }
  }, [isScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && isScanning) {
        try { scannerRef.current.stop(); } catch {}
      }
    };
  }, [isScanning]);

  // Auto-start when switching to camera mode
  useEffect(() => {
    if (scanMode === 'camera' && !isScanning) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => startScanner(), 300);
      return () => clearTimeout(timer);
    } else if (scanMode === 'manual' && isScanning) {
      stopScanner();
    }
  }, [scanMode, startScanner, stopScanner, isScanning]);

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
      if (res.ok) {
        toast.success(data.message);
        setQrCode(''); // Clear for next scan
      }
      else toast.error(data.error);
    } catch {
      setResult({ ok: false, data: { error: 'Check-in failed' } });
      toast.error('Check-in failed');
    }
    setIsCheckingIn(false);
  };

  if (!user || (user.role !== 'FACULTY' && user.role !== 'ADMIN' && user.role !== 'HOD')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ScanLine className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-lg font-medium">Access Restricted</p>
          <p className="text-sm text-muted-foreground">Only faculty, HODs, and admins can scan QR codes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-primary" /> QR Check-in
          </h1>
          <p className="text-sm text-muted-foreground">Scan student QR codes for attendance</p>
        </div>

        {/* Event Selection */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Select Event
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setEventId(event.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                      eventId === event.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{event.title}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(event.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {event.venue}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{event._count?.registrations || 0} reg</Badge>
                        {eventId === event.id && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Event ID</Label>
                <Input
                  placeholder="Paste event ID"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="h-9"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={scanMode === 'camera' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setScanMode('camera')}
          >
            <Camera className="w-3.5 h-3.5 mr-1.5" /> Camera Scan
          </Button>
          <Button
            variant={scanMode === 'manual' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setScanMode('manual')}
          >
            <Keyboard className="w-3.5 h-3.5 mr-1.5" /> Manual Input
          </Button>
        </div>

        {/* Camera Scanner */}
        {scanMode === 'camera' && (
          <Card className="mb-4 overflow-hidden">
            <CardContent className="p-4">
              <div
                ref={scannerContainerRef}
                id="qr-reader"
                className="w-full min-h-[280px] rounded-lg overflow-hidden bg-black/5 flex items-center justify-center"
              >
                {!isScanning && (
                  <div className="text-center py-12">
                    <Camera className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Starting camera...</p>
                  </div>
                )}
              </div>
              {qrCode && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> QR Code detected:
                  </p>
                  <p className="text-xs font-mono mt-1 break-all text-emerald-800 dark:text-emerald-200">{qrCode}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Manual Input */}
        {scanMode === 'manual' && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Manual QR Check-in</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">QR Code Value</Label>
                <Input
                  placeholder="Paste or type QR code value"
                  value={qrCode}
                  onChange={(e) => setQrCode(e.target.value)}
                  className="h-9 font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Check-in Button */}
        <Button
          onClick={handleCheckIn}
          disabled={isCheckingIn || !eventId || !qrCode}
          className="w-full bg-primary hover:bg-primary/90 h-11"
        >
          {isCheckingIn ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
          ) : (
            <><ScanLine className="w-4 h-4 mr-2" /> Check In Student</>
          )}
        </Button>

        {/* Geo-fence indicator */}
        {eventId && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>Geolocation will be captured for geo-fence validation</span>
          </div>
        )}

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
                      {result.data.attendance.attendancePercentage !== undefined && (
                        <p>Attendance: {Math.round(result.data.attendance.attendancePercentage)}%</p>
                      )}
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
