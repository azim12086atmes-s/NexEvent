'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import {
  ScanLine, CheckCircle2, XCircle, AlertTriangle, Loader2,
  MapPin, Camera, Keyboard, Zap, Shield, Users, Copy, User, Hash, Building2, Clock,
  LogOut, ArrowRight, QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// Parse the NEXEVENT-{eventId}-{userId}-{timestamp} format
function parseQRCode(qrCode: string): { eventId: string; studentUserId: string; timestamp: string } | null {
  if (!qrCode || !qrCode.startsWith('NEXEVENT-')) return null;

  // Check for NEXEVENT-CHECKIN-{eventId} format
  if (qrCode.startsWith('NEXEVENT-CHECKIN-')) {
    const eventId = qrCode.replace('NEXEVENT-CHECKIN-', '');
    return { eventId, studentUserId: '', timestamp: '' };
  }

  const parts = qrCode.split('-');
  if (parts.length < 4) return null;
  const eventId = parts[1];
  const userId = parts[2];
  const timestamp = parts.slice(3).join('-');
  return { eventId, studentUserId: userId, timestamp };
}

// Detect QR code type
function getQRCodeType(qrCode: string): 'individual' | 'event-checkin' | 'unknown' {
  if (!qrCode) return 'unknown';
  if (qrCode.startsWith('NEXEVENT-CHECKIN-')) return 'event-checkin';
  if (qrCode.startsWith('NEXEVENT-')) return 'individual';
  return 'unknown';
}

interface RecentCheckIn {
  id: string;
  status: string;
  checkInTime: string;
  isWithinGeoFence: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    usn: string | null;
    department: any;
  };
}

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
  const [recentCheckIns, setRecentCheckIns] = useState<RecentCheckIn[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  const isStudent = user?.role === 'STUDENT' || user?.role === 'OTHER';
  const isStaff = user?.role === 'FACULTY' || user?.role === 'HOD' || user?.role === 'ADMIN';

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

  // Load recent check-ins when event is selected (staff only)
  const loadRecentCheckIns = useCallback(async (evId: string) => {
    if (!evId || isStudent) return;
    setLoadingRecent(true);
    try {
      const res = await fetch(`/api/events/${evId}/attendance?recent=5`);
      if (res.ok) {
        const data = await res.json();
        setRecentCheckIns(data.attendances || []);
      }
    } catch {}
    setLoadingRecent(false);
  }, [isStudent]);

  useEffect(() => {
    if (eventId && isStaff) {
      loadRecentCheckIns(eventId);
    } else {
      setRecentCheckIns([]);
    }
  }, [eventId, loadRecentCheckIns, isStaff]);

  // Auto-detect event from QR code
  const handleQRCodeInput = useCallback((code: string) => {
    setQrCode(code);
    setResult(null);

    if (!code) return;

    const parsed = parseQRCode(code);
    if (parsed) {
      // Auto-select the event from QR code
      const matchingEvent = events.find(e => e.id === parsed.eventId);
      if (matchingEvent && eventId !== parsed.eventId) {
        setEventId(parsed.eventId);
        toast.info(`Auto-selected event: ${matchingEvent.title}`);
      } else if (!matchingEvent && !eventId) {
        setEventId(parsed.eventId);
        toast.info('Event detected from QR code');
      }
    }
  }, [events, eventId]);

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
          // QR code detected - auto-submit!
          setQrCode(decodedText);
          scanner.stop().then(() => {
            setIsScanning(false);
          }).catch(() => {});

          // Parse and auto-select event
          const parsed = parseQRCode(decodedText);
          if (parsed) {
            setEventId(prev => {
              if (prev !== parsed.eventId) {
                const matchingEvent = events.find(e => e.id === parsed.eventId);
                if (matchingEvent) {
                  toast.info(`Auto-selected: ${matchingEvent.title}`);
                }
              }
              return parsed.eventId;
            });
          }

          toast.success('QR code detected! Processing...');
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
  }, [events]);

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
      const timer = setTimeout(() => startScanner(), 300);
      return () => clearTimeout(timer);
    } else if (scanMode === 'manual' && isScanning) {
      stopScanner();
    }
  }, [scanMode, startScanner, stopScanner, isScanning]);

  // Auto-submit when QR code is scanned and event is selected
  useEffect(() => {
    if (qrCode && eventId && !isCheckingIn && !result?.ok) {
      const parsed = parseQRCode(qrCode);
      // Only auto-submit if the QR code matches the selected event
      if (!parsed || parsed.eventId === eventId) {
        const timer = setTimeout(() => {
          handleCheckIn();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [qrCode, eventId]);

  const handleCheckIn = async () => {
    if (!user || !eventId || !qrCode || isCheckingIn) return;
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
        // Refresh recent check-ins (staff only)
        if (isStaff) {
          loadRecentCheckIns(eventId);
        }
      } else {
        toast.error(data.error);
      }
    } catch {
      setResult({ ok: false, data: { error: 'Check-in failed' } });
      toast.error('Check-in failed');
    }
    setIsCheckingIn(false);
  };

  const handleReset = () => {
    setQrCode('');
    setResult(null);
    // Restart camera if in camera mode
    if (scanMode === 'camera' && !isScanning) {
      setTimeout(() => startScanner(), 300);
    }
  };

  const selectedEvent = events.find(e => e.id === eventId);
  const qrType = getQRCodeType(qrCode);

  // Access check - now also allow STUDENT and OTHER roles
  if (!user) return null;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-primary" />
            {isStudent ? 'Self Check-in' : 'QR Check-in'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isStudent
              ? 'Scan the event QR code displayed at the venue to check yourself in'
              : 'Scan student QR codes for attendance'}
          </p>
        </div>

        {/* Mode indicator for students */}
        {isStudent && (
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Student Self Check-in</p>
                <p className="text-xs text-muted-foreground">
                  Scan the event QR code displayed at the venue entrance
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Event Selection - Staff mode */}
        {isStaff && (
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
                      onClick={() => { setEventId(event.id); setQrCode(''); setResult(null); }}
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
                    onChange={(e) => { setEventId(e.target.value); setQrCode(''); setResult(null); }}
                    className="h-9"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                {!isScanning && !qrCode && (
                  <div className="text-center py-12">
                    <Camera className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Starting camera...</p>
                  </div>
                )}
              </div>
              {qrCode && !isScanning && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> QR Code detected:
                  </p>
                  <p className="text-xs font-mono mt-1 break-all text-emerald-800 dark:text-emerald-200">{qrCode}</p>
                  {/* QR type indicator */}
                  {qrType !== 'unknown' && (
                    <Badge className={`mt-2 text-[10px] ${
                      qrType === 'event-checkin'
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                    }`}>
                      {qrType === 'event-checkin' ? 'Event Check-in QR' : 'Individual Registration QR'}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Manual Input */}
        {scanMode === 'manual' && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {isStudent ? 'Scan Event QR Code' : 'Manual QR Check-in'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {isStudent ? 'Event QR Code Value' : 'QR Code Value'}
                </Label>
                <Input
                  placeholder={isStudent ? 'Paste event QR code (NEXEVENT-CHECKIN-...)' : 'Paste or type QR code value (NEXEVENT-...)'}
                  value={qrCode}
                  onChange={(e) => handleQRCodeInput(e.target.value)}
                  className="h-9 font-mono text-xs"
                />
                {/* QR type indicator */}
                {qrCode && qrType !== 'unknown' && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-[10px] ${
                      qrType === 'event-checkin'
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                    }`}>
                      {qrType === 'event-checkin' ? '🎯 Event Check-in QR' : '👤 Individual Registration QR'}
                    </Badge>
                    {qrType === 'event-checkin' && isStudent && (
                      <span className="text-[10px] text-primary">You will be checked in automatically</span>
                    )}
                  </div>
                )}
                {!isStudent && (
                  <p className="text-[10px] text-muted-foreground">
                    QR format: NEXEVENT-eventId-userId-timestamp or NEXEVENT-CHECKIN-eventId
                  </p>
                )}
              </div>
              <Button
                onClick={handleCheckIn}
                disabled={isCheckingIn || !qrCode}
                className="w-full bg-primary hover:bg-primary/90 h-11"
              >
                {isCheckingIn ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
                ) : isStudent ? (
                  <><ScanLine className="w-4 h-4 mr-2" /> Check Me In</>
                ) : (
                  <><ScanLine className="w-4 h-4 mr-2" /> Check In Student</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Manual check-in button for camera mode */}
        {scanMode === 'camera' && qrCode && !isCheckingIn && !result?.ok && (
          <Button
            onClick={handleCheckIn}
            disabled={!qrCode}
            className="w-full bg-primary hover:bg-primary/90 h-11 mb-4"
          >
            {isStudent ? (
              <><ScanLine className="w-4 h-4 mr-2" /> Check Me In</>
            ) : (
              <><ScanLine className="w-4 h-4 mr-2" /> Check In Student</>
            )}
          </Button>
        )}

        {/* Geo-fence indicator */}
        {eventId && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>Geolocation will be captured for geo-fence validation</span>
          </div>
        )}

        {/* Result - Enhanced with student info */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className={`mt-4 ${result.ok ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'}`}>
                <CardContent className="p-4">
                  {result.ok ? (
                    <div className="space-y-4">
                      {/* Success header */}
                      <div className="flex items-center gap-3">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          {result.data.isCheckOut ? (
                            <LogOut className="w-8 h-8 text-blue-500" />
                          ) : (
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                          )}
                        </motion.div>
                        <div>
                          <p className={`font-semibold text-lg ${
                            result.data.isCheckOut
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {result.data.isCheckOut ? 'Checked Out!' : result.data.isSelfCheckIn ? 'Self Check-in Successful!' : 'Check-in Successful!'}
                          </p>
                          <p className="text-sm text-muted-foreground">{result.data.message}</p>
                        </div>
                      </div>

                      {/* Student Info Card (for staff scanning or self check-in showing own info) */}
                      {result.data.student && (
                        <div className={`p-4 rounded-xl border ${
                          result.data.isCheckOut
                            ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900'
                            : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-base">{result.data.student.name}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                {result.data.student.usn && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Hash className="w-3 h-3" /> {result.data.student.usn}
                                  </span>
                                )}
                                {result.data.student.department?.name && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Building2 className="w-3 h-3" /> {result.data.student.department.name}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {new Date(result.data.attendance.checkInTime).toLocaleTimeString('en-IN')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Check-out specific info */}
                      {result.data.isCheckOut && result.data.attendance && (
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Attendance Duration:</span>
                            <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                              {result.data.attendance.attendancePercentage}%
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-muted-foreground">Check-out Time:</span>
                            <span className="text-xs">
                              {result.data.attendance.checkOutTime
                                ? new Date(result.data.attendance.checkOutTime).toLocaleTimeString('en-IN')
                                : '--'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Status details */}
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Status:</span>
                          <Badge variant="outline" className="text-[10px]">{result.data.attendance.status}</Badge>
                        </div>
                        {result.data.attendance.isWithinGeoFence === false && (
                          <p className="text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Outside geo-fence radius
                          </p>
                        )}
                        {result.data.aictePointsAwarded > 0 && (
                          <div className="flex items-center justify-between">
                            <span>AICTE Points:</span>
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                              +{result.data.aictePointsAwarded} pts
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Scan next button */}
                      <Button onClick={handleReset} variant="outline" className="w-full">
                        {isStudent ? (
                          <><ScanLine className="w-4 h-4 mr-2" /> Scan Another Code</>
                        ) : (
                          <><ScanLine className="w-4 h-4 mr-2" /> Scan Next Student</>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <XCircle className="w-8 h-8 text-red-500" />
                        <div>
                          <p className="font-semibold text-red-700 dark:text-red-300 text-lg">Check-in Failed</p>
                          <p className="text-sm text-muted-foreground">{result.data.error}</p>
                        </div>
                      </div>
                      {/* If already checked in, show student info from error response */}
                      {result.data.student && (
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Already checked in:</p>
                          <p className="text-sm font-semibold">{result.data.student.name}</p>
                          {result.data.student.usn && (
                            <p className="text-xs text-muted-foreground">{result.data.student.usn}</p>
                          )}
                        </div>
                      )}
                      <Button onClick={handleReset} variant="outline" className="w-full">
                        Try Again
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Check-ins (staff only) */}
        {isStaff && eventId && (
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Recent Check-ins
                {selectedEvent && (
                  <Badge variant="outline" className="text-[10px] ml-auto">{selectedEvent.title}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRecent ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : recentCheckIns.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No check-ins yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentCheckIns.map((ci) => (
                    <div
                      key={ci.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ci.user.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {ci.user.usn && <span>{ci.user.usn}</span>}
                          <span>{new Date(ci.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <Badge
                        className={`text-[10px] shrink-0 ${
                          ci.status === 'PRESENT'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                            : ci.status === 'LATE'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                            : ci.status === 'CHECKED_OUT'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {ci.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <Card className="mt-4 bg-muted/30">
          <CardContent className="p-4">
            {isStudent ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>How it works:</strong> At the event venue, look for the displayed event QR code.
                Scan it or enter the code value to check yourself in. If you are already checked in and scan again,
                you will be checked out and your attendance percentage will be calculated.
                If the event has geo-fencing, make sure you are within the venue for proper validation.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>How it works:</strong> Students register for an event and receive a unique QR code.
                At the venue, scan or enter the QR code value to check them in. Scanning an already checked-in
                student will check them out and calculate their attendance percentage.
                The event is auto-detected from the QR code.
                If the event has geo-fencing enabled, the system validates that the check-in is within the configured radius.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
