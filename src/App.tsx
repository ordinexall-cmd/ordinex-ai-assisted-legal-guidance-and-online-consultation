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
import { ProtectedRoute } from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import CitizenDashboard from './pages/CitizenDashboardPremium';
import AiCaseAnalysis from './pages/AiCaseAnalysis';
import LawyerDirectory from './pages/LawyerDirectory';
import LawyerProfile from './pages/LawyerProfile';
import LawyerBookConsultation from './pages/LawyerBookConsultation';
import ScheduleConsultation from './pages/ScheduleConsultation';
import BookingDetail from './pages/BookingDetail';
import {
  LegacyPaymentRedirect,
  LegacyBookingConfirmationRedirect,
} from './routes/LegacyRedirects';
import LawyerRegister from './pages/LawyerRegister';
import CitizenRegister from './pages/CitizenRegister';
import AccountSettings from './pages/AccountSettings';
import AdminKycPage from './pages/AdminKycPage';
import LawyerDashboard from './pages/LawyerDashboard';
import LawyerSchedule from './pages/LawyerSchedule';
import VideoConsultation from './pages/VideoConsultation';
import VideoConsultationSession from './pages/VideoConsultationSession';
import ConsultationPreflightPage from './pages/ConsultationPreflightPage';
import AnalysisHistoryList from './pages/AnalysisHistoryList';
import AnalysisDetail from './pages/AnalysisDetail';
import ActivityHistory from './pages/ActivityHistory';
import ScheduleCalendar from './pages/ScheduleCalendar';
import GoogleAuthDone from './pages/GoogleAuthDone';
import LawyerActivityHistory from './pages/LawyerActivityHistory';
import CheckoutPage from './pages/CheckoutPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import LicensesPage from './pages/LicensesPage';
import NotFoundPage from './pages/NotFoundPage';
import { BookingDockProvider } from './context/BookingDockContext';
import { SideNavProvider } from './context/SideNavContext';
import { FloatingBookingDock } from './components/booking/FloatingBookingDock';
import { InstallPrompt } from './components/pwa/InstallPrompt';

function App() {
  return (
    <BrowserRouter>
      <a href="#main-content" className="ox-skip-link">
        Skip to main content
      </a>
      <SideNavProvider>
      <BookingDockProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/licenses" element={<LicensesPage />} />
        <Route path="/register" element={<CitizenRegister />} />
        <Route path="/lawyer/register" element={<LawyerRegister />} />
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
          <ProtectedRoute requiredRole="CITIZEN">
            <ScheduleCalendar />
          </ProtectedRoute>
        } />
        <Route path="/lawyers" element={
          <ProtectedRoute requiredRole="CITIZEN">
            <LawyerDirectory />
          </ProtectedRoute>
        } />
        <Route path="/lawyers/:id" element={
          <ProtectedRoute requiredRole="CITIZEN">
            <LawyerProfile />
          </ProtectedRoute>
        } />
        <Route path="/lawyers/:id/book" element={
          <ProtectedRoute requiredRole="CITIZEN">
            <LawyerBookConsultation />
          </ProtectedRoute>
        } />
        <Route path="/schedule" element={
          <ProtectedRoute requiredRole="CITIZEN">
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
        <Route path="/lawyer/history" element={
          <ProtectedRoute requiredRole="LAWYER">
            <LawyerActivityHistory />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <FloatingBookingDock />
      <InstallPrompt />
      </BookingDockProvider>
      </SideNavProvider>
    </BrowserRouter>
  );
}

export default App;
