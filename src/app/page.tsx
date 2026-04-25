'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { useEventStore } from '@/store/event-store';
import { useClubStore } from '@/store/club-store';
import { useAttendanceStore } from '@/store/attendance-store';
import { Toaster, toast } from 'sonner';

import { Navbar } from '@/components/nexevent/Navbar';
import { AuthModal } from '@/components/nexevent/AuthModal';
import { LandingPage } from '@/components/nexevent/LandingPage';
import { EventFeed } from '@/components/nexevent/EventFeed';
import { EventDetail } from '@/components/nexevent/EventDetail';
import { OrganizerDashboard } from '@/components/nexevent/OrganizerDashboard';
import { AdminPanel } from '@/components/nexevent/AdminPanel';
import { ProfileView } from '@/components/nexevent/ProfileView';
import { ClubsView } from '@/components/nexevent/ClubsView';
import { ClubDetailPage } from '@/components/nexevent/ClubDetailPage';
import { MyEvents } from '@/components/nexevent/MyEvents';
import { CreateEventForm } from '@/components/nexevent/CreateEventForm';
import { QRScanner } from '@/components/nexevent/QRScanner';
import { JudgeScoring } from '@/components/nexevent/JudgeScoring';
import { ResultsView } from '@/components/nexevent/ResultsView';
import { CertificateManagement } from '@/components/nexevent/CertificateManagement';
import { StudentDashboard } from '@/components/nexevent/StudentDashboard';
import { HODDashboard } from '@/components/nexevent/HODDashboard';
import { FacultyDashboard } from '@/components/nexevent/FacultyDashboard';

export default function NexEventApp() {
  const { user, isAuthenticated, checkAuth } = useAuthStore();
  const { currentView, showAuthModal, closeAuthModal, authMode } = useUIStore();
  const { fetchEvents } = useEventStore();
  const { fetchClubs } = useClubStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEvents();
      fetchClubs();
    }
  }, [isAuthenticated, fetchEvents, fetchClubs]);

  const renderView = () => {
    switch (currentView) {
      case 'landing': return <LandingPage />;
      case 'feed': return <EventFeed />;
      case 'event-detail': return <EventDetail />;
      case 'dashboard': return <OrganizerDashboard />;
      case 'student-dashboard': return <StudentDashboard />;
      case 'hod-dashboard': return <HODDashboard />;
      case 'faculty-dashboard': return <FacultyDashboard />;
      case 'admin': return <AdminPanel />;
      case 'profile': return <ProfileView />;
      case 'clubs': return <ClubsView />;
      case 'club-detail': return <ClubDetailPage />;
      case 'my-events': return <MyEvents />;
      case 'create-event': return <CreateEventForm />;
      case 'scan-qr': return <QRScanner />;
      case 'judge-scoring': return <JudgeScoring />;
      case 'results': return <ResultsView />;
      case 'certificates': return <CertificateManagement />;
      default: return <LandingPage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">NexEvent</span>
            <span>by Jungly Billi</span>
          </div>
          <div>Vidyavardhaka College of Engineering, Mysuru</div>
          <div>Campus Innovation 2026</div>
        </div>
      </footer>

      <AuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        defaultMode={authMode}
      />
    </div>
  );
}
