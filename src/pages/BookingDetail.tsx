import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import { bookingsApi, type Booking } from '../services/api';
import { onBookingUpdated } from '../services/appSocket';
import { BookingDetailSkeleton } from '../components/booking/BookingDetailSkeleton';
import { BookingManageView } from '../components/booking/BookingManageView';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { getLawyerNav } from '../utils/lawyerWorkspace';
import { getErrorMessage } from '../utils/userFacingError';
import { useBookingDock } from '../context/BookingDockContext';
import { isDockableBooking } from '../utils/dockableBooking';

export const BookingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLawyer = user?.role === 'LAWYER';
  const nav = isLawyer ? getLawyerNav(user) : getCitizenNav(user);
  const backTo = isLawyer ? '/lawyer/dashboard' : '/dashboard';
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [analysisReloadKey, setAnalysisReloadKey] = useState(0);
  const bookingDock = useBookingDock();
  const prevStatusRef = React.useRef<Booking['status'] | null>(null);

  const reload = React.useCallback(async () => {
    if (!id) return;
    try {
      const { booking: next } = await bookingsApi.getById(id);
      setBooking(next);
      setAnalysisReloadKey((k) => k + 1);
      setError('');
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Booking not found.'));
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [id, reload]);

  useEffect(() => {
    if (!id) return;
    return onBookingUpdated((payload) => {
      if (payload.bookingId === id) reload();
    });
  }, [id, reload]);

  useEffect(() => {
    if (!booking) return;
    const prev = prevStatusRef.current;
    if (prev !== 'CONFIRMED' && booking.status === 'CONFIRMED' && isDockableBooking(booking)) {
      bookingDock.openBooking(booking.id, { expand: true });
    }
    prevStatusRef.current = booking.status;
  }, [booking, bookingDock]);

  const wrap = async (fn: () => Promise<{ booking: Booking }>) => {
    setActionLoading(true);
    try {
      const { booking: next } = await fn();
      setBooking(next);
      if (isDockableBooking(next)) {
        bookingDock.openBooking(next.id, { expand: true });
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Action failed. Please try again.'));
    } finally {
      setActionLoading(false);
    }
  };

  if (!id) return <Navigate to="/dashboard" replace />;
  if (loading) {
    return (
      <AppShell title="Booking Confirmation" navItems={nav} variant="flow" stepLabel="Confirmation" backTo={backTo}>
        <BookingDetailSkeleton />
      </AppShell>
    );
  }
  if (error || !booking) {
    return (
      <AppShell title="Booking Confirmation" navItems={nav} variant="flow" stepLabel="Confirmation" backTo={backTo}>
        <div className="dash-empty-state">
          <div className="dash-empty-state__icon-wrap">
            <span className="material-symbols-outlined">error_outline</span>
          </div>
          <p className="dash-empty-state__title">Booking unavailable</p>
          <p className="dash-empty-state__text">{error || 'Booking not found.'}</p>
          <button type="button" className="ox-btn ox-btn-primary" onClick={() => navigate(backTo)}>
            Back to dashboard
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Booking Confirmation" navItems={nav} variant="flow" stepLabel="Confirmation" backTo={backTo}>
      {error ? (
        <div className="callout-error dash-callout-error" role="alert">
          <p className="callout-error__text">{error}</p>
        </div>
      ) : null}
      <BookingManageView
        booking={booking}
        actionLoading={actionLoading}
        onAction={wrap}
        analysisReloadKey={analysisReloadKey}
      />
    </AppShell>
  );
};

export default BookingDetail;
