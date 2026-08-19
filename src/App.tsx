import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import './styles/design-system.css';
import './styles/landing-marketing.css';
import './styles/consult-booking.css';
import './styles/staff-portal-panels.css';
import './styles/analysis-describe.css';
import './styles/marketplace-panels.css';
import './styles/citizen-shell.css';
import './styles/ordinex-portal-layout.css';
import './styles/pwa-mobile.css';
import './styles/account-ui.css';
import './styles/docked-messenger.css';
import { ProtectedRoute } from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import {
  LegacyPaymentRedirect,
  LegacyBookingConfirmationRedirect,
} from './routes/LegacyRedirects';
import RegisterPage from './pages/RegisterPage';
import GoogleAuthDone from './pages/GoogleAuthDone';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import LicensesPage from './pages/LicensesPage';
import NotFoundPage from './pages/NotFoundPage';
import { BookingDockProvider } from './context/BookingDockContext';
import { SideNavProvider } from './context/SideNavContext';
import { FloatingBookingDock } from './components/booking/FloatingBookingDock';
import { InstallPrompt } from './components/pwa/InstallPrompt';

const CitizenDashboard = lazy(() => import('./pages/CitizenDashboardPremium'));
const AiCaseAnalysis = lazy(() => import('./pages/AiCaseAnalysis'));
const DirectoryPage = lazy(() => import('./pages/DirectoryPage'));
const DirectorySearchRedirect = lazy(() =>
  import('./pages/DirectoryPage').then((m) => ({ default: m.DirectorySearchRedirect })),
);
const LawyerProfile = lazy(() => import('./pages/LawyerProfile'));
const BriefRequestDetail = lazy(() => import('./pages/BriefRequestDetail'));
const LawyerBookConsultation = lazy(() => import('./pages/LawyerBookConsultation'));
const ScheduleConsultation = lazy(() => import('./pages/ScheduleConsultation'));
const BookingDetail = lazy(() => import('./pages/BookingDetail'));
const AccountSettings = lazy(() => import('./pages/AccountSettings'));
const AdminKycPage = lazy(() => import('./pages/AdminKycPage'));
const LawyerDashboard = lazy(() => import('./pages/LawyerDashboard'));
const LawyerSchedule = lazy(() => import('./pages/LawyerSchedule'));
const VideoConsultation = lazy(() => import('./pages/VideoConsultation'));
const VideoConsultationSession = lazy(() => import('./pages/VideoConsultationSession'));
const ConsultationPreflightPage = lazy(() => import('./pages/ConsultationPreflightPage'));
const AnalysisHistoryList = lazy(() => import('./pages/AnalysisHistoryList'));
const AnalysisDetail = lazy(() => import('./pages/AnalysisDetail'));
const ActivityHistory = lazy(() => import('./pages/ActivityHistory'));
const ScheduleCalendar = lazy(() => import('./pages/ScheduleCalendar'));
const LawyerActivityHistory = lazy(() => import('./pages/LawyerActivityHistory'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));

function PageFallback() {
  return <p className="staff-empty-hint" style={{ padding: '1.5rem' }}>Loading…</p>;
}

function App() {
  return (
    <BrowserRouter>
      <a href="#main-content" className="ox-skip-link">
        Skip to main content
      </a>
      <SideNavProvider>
      <BookingDockProvider>
      <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/licenses" element={<LicensesPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/lawyer/register" element={<RegisterPage defaultRole="LAWYER" />} />
        <Route path="/auth/google/done" element={<GoogleAuthDone />} />

        {/* Citizen Workspace */}
        <Route path="/dashboard" element={
          <ProtectedRoute requiredRole="CITIZEN">
            <CitizenDashboard />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/free" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard/premium" element={<Navigate to="/dashboard" replace />} />
        <Route path="/ai-analysis" element={
          <ProtectedRoute requiredRole="CITIZEN">
            <AiCaseAnalysis />
          </ProtectedRoute>
        } />
        <Route path="/analyses" element={
          <ProtectedRoute requiredRole="CITIZEN">
            <AnalysisHistoryList />
          </ProtectedRoute>
        } />
        <Route path="/analyses/:id" element={
          <ProtectedRoute requiredRole="CITIZEN">
            <AnalysisDetail />
          </ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute requiredRole="CITIZEN">
            <ActivityHistory />
          </ProtectedRoute>
        } />
        <Route path="/schedule-calendar" element={
          <ProtectedRoute requiredRole="CITIZEN" requireCitizenVerified>
            <ScheduleCalendar />
          </ProtectedRoute>
        } />
        <Route path="/directory" element={
          <ProtectedRoute>
            <DirectoryPage />
          </ProtectedRoute>
        } />
        <Route path="/directory/requests/:briefId" element={
          <ProtectedRoute requiredRole="LAWYER" requireLawyerVerified>
            <BriefRequestDetail />
          </ProtectedRoute>
        } />
        <Route path="/lawyers" element={
          <ProtectedRoute>
            <DirectorySearchRedirect />
          </ProtectedRoute>
        } />
        <Route path="/lawyers/:id" element={
          <ProtectedRoute requiredRole="CITIZEN" requireCitizenVerified>
            <LawyerProfile />
          </ProtectedRoute>
        } />
        <Route path="/lawyers/:id/book" element={
          <ProtectedRoute requiredRole="CITIZEN" requireCitizenVerified>
            <LawyerBookConsultation />
          </ProtectedRoute>
        } />
        <Route path="/schedule" element={
          <ProtectedRoute requiredRole="CITIZEN" requireCitizenVerified>
            <ScheduleConsultation />
          </ProtectedRoute>
        } />
        <Route path="/booking/:id" element={
          <ProtectedRoute>
            <BookingDetail />
          </ProtectedRoute>
        } />
        <Route path="/payment" element={
          <ProtectedRoute requiredRole="CITIZEN">
            <LegacyPaymentRedirect />
          </ProtectedRoute>
        } />
        <Route path="/booking-confirmation" element={
          <ProtectedRoute requiredRole="CITIZEN">
            <LegacyBookingConfirmationRedirect />
          </ProtectedRoute>
        } />
        <Route path="/checkout" element={
          <ProtectedRoute requiredRole="CITIZEN">
            <CheckoutPage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <AccountSettings />
          </ProtectedRoute>
        } />
        <Route path="/profile/complete" element={<Navigate to="/settings?tab=verification" replace />} />
        <Route path="/admin/kyc" element={
          <ProtectedRoute>
            <AdminKycPage />
          </ProtectedRoute>
        } />
        <Route path="/consultation/video" element={
          <ProtectedRoute>
            <VideoConsultation />
          </ProtectedRoute>
        } />
        <Route path="/consultation/:id/preflight" element={
          <ProtectedRoute>
            <ConsultationPreflightPage />
          </ProtectedRoute>
        } />
        <Route path="/consultation/:id" element={
          <ProtectedRoute>
            <VideoConsultationSession />
          </ProtectedRoute>
        } />

        <Route path="/lawyer/onboarding" element={<Navigate to="/lawyer/register" replace />} />

        {/* Lawyer Workspace */}
        <Route path="/lawyer/dashboard" element={
          <ProtectedRoute requiredRole="LAWYER">
            <LawyerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/lawyer/schedule" element={
          <ProtectedRoute requiredRole="LAWYER">
            <LawyerSchedule />
          </ProtectedRoute>
        } />
        <Route path="/lawyer/requests" element={
          <ProtectedRoute requiredRole="LAWYER">
            <Navigate to="/directory" replace />
          </ProtectedRoute>
        } />
        <Route path="/lawyer/history" element={
          <ProtectedRoute requiredRole="LAWYER">
            <LawyerActivityHistory />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      <FloatingBookingDock />
      <InstallPrompt />
      </BookingDockProvider>
      </SideNavProvider>
    </BrowserRouter>
  );
}

export default App;
