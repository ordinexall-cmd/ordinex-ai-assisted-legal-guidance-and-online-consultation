import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { CitizenBookingWizard } from '../components/consultation/CitizenBookingWizard';
import { ScheduleMonthGrid, type ScheduleCalendarEvent } from '../components/schedule/ScheduleMonthGrid';
import { LawyerPracticeBadge } from '../components/lawyer/LawyerPracticeBadge';
import {
  lawyersApi,
  bookingsApi,
  consultationApi,
  type LawyerProfile,
  type AvailabilitySlot,
  type ConsultationResult,
  type Booking,
} from '../services/api';
import { onAvailabilityChanged } from '../services/appSocket';
import { useAuth } from '../context/AuthContext';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { getErrorMessage } from '../utils/userFacingError';
import { citizenBookingCalendarStyle } from '../utils/calendarEventStyle';
import { BookingFlowStepper } from '../components/booking/BookingFlowStepper';

export const LawyerBookConsultation: React.FC = () => {
  const { id: lawyerId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const consultationIdFromUrl = searchParams.get('consultationId') ?? '';
  const navigate = useNavigate();
  const { user } = useAuth();
  const navItems = getCitizenNav(user);

  const [lawyer, setLawyer] = useState<LawyerProfile | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [history, setHistory] = useState<ConsultationResult[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ date: string; time: string } | null>(null);
  const [preferredDate, setPreferredDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!lawyerId) return;
    setLoading(true);
    setError('');
    try {
      const [{ lawyer: lw }, { slots: sl }, { consultations }, { bookings }] = await Promise.all([
        lawyersApi.getById(lawyerId),
        lawyersApi.getAvailability(lawyerId),
        consultationApi.getHistory(),
        bookingsApi.getMy({ limit: 50 }),
      ]);
      setLawyer(lw);
      setSlots(sl.filter((s) => !s.isBooked));
      setHistory(consultations);
      setMyBookings(
        bookings.filter((b) => b.lawyer.id === lawyerId && b.viewerRole === 'CITIZEN'),
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Could not load booking form.'));
      setLawyer(null);
    } finally {
      setLoading(false);
    }
  }, [lawyerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!lawyerId) return;
    return onAvailabilityChanged((payload) => {
      if (payload.lawyerId === lawyerId) void load();
    });
  }, [lawyerId, load]);

  const calEvents: ScheduleCalendarEvent[] = useMemo(() => {
    const open: ScheduleCalendarEvent[] = slots.map((s) => ({
      id: `open-${s.id}`,
      date: s.date,
      label: `Open ${s.startTime}`,
      colorVariant: 'gold' as const,
      onClick: () => setPreferredDate(s.date.slice(0, 10)),
    }));
    const mine: ScheduleCalendarEvent[] = myBookings.map((b) => {
      const style = citizenBookingCalendarStyle(b.status);
      return {
        id: b.id,
        date: b.availability.date,
        label: `${b.availability.startTime}`,
        colorVariant: style.colorVariant,
        completed: style.completed,
        onClick: () => navigate(`/booking/${b.id}`),
      };
    });
    return [...open, ...mine];
  }, [slots, myBookings, navigate]);

  const handleSubmit = async (payload: {
    availabilityId: string;
    consultationId?: string;
    caseDescription?: string;
  }) => {
    setSubmitting(true);
    setError('');
    setSuccess(null);
    try {
      const slot = slots.find((s) => s.id === payload.availabilityId);
      const { booking } = await bookingsApi.create(payload);
      if (slot) {
        setSuccess({ date: slot.date, time: `${slot.startTime}–${slot.endTime}` });
      }
      window.setTimeout(() => navigate(`/booking/${booking.id}`), 900);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Booking failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!lawyerId) return <Navigate to="/directory" replace />;

  const backTo = consultationIdFromUrl
    ? `/lawyers/${lawyerId}?consultationId=${encodeURIComponent(consultationIdFromUrl)}`
    : `/lawyers/${lawyerId}`;

  return (
    <AppShell
      variant="flow"
      title="Book consultation"
      navItems={navItems}
      stepLabel="Schedule"
      backTo={backTo}
    >
      <div className="staff-workspace marketplace ox-page-narrow">
        <div className="marketplace-profile-stepper">
          <BookingFlowStepper current="schedule" />
        </div>

        {loading && <p className="staff-empty-hint">Loading…</p>}

        {!loading && !lawyer && (
          <div className="staff-panel">
            <p className="staff-empty-hint">{error || 'Lawyer not found.'}</p>
            <button type="button" className="ox-btn ox-btn-primary" onClick={() => navigate('/directory')}>
              Back to directory
            </button>
          </div>
        )}

        {lawyer && !loading && (
          <div className="staff-page-grid staff-page-grid--2">
            <div>
              {success && (
                <div className="staff-alert staff-alert--success">
                  <strong>Scheduled!</strong> Consultation request sent
                  {' · '}
                  {new Date(success.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' @ '}
                  {success.time}
                </div>
              )}
              <CitizenBookingWizard
                lawyer={lawyer}
                slots={slots}
                history={history}
                initialConsultationId={consultationIdFromUrl}
                loading={submitting}
                error={error}
                preferredDate={preferredDate}
                onPreferredDateConsumed={() => setPreferredDate(null)}
                onSubmit={(p) => { void handleSubmit(p); }}
              />
            </div>
            <div>
              <div className="staff-panel" style={{ marginBottom: '0.75rem' }}>
                <div className="staff-panel__title-row">
                  <h3 className="staff-panel__title">About this lawyer</h3>
                  <LawyerPracticeBadge practiceType={lawyer.practiceType} />
                </div>
                <p className="staff-empty-hint">
                  {lawyer.bio?.slice(0, 180) || 'Independent licensed attorney on Ordinex.'}
                  {lawyer.bio && lawyer.bio.length > 180 ? '…' : ''}
                </p>
              </div>
              <ScheduleMonthGrid
                events={calEvents}
                emptyHint={
                  slots.length === 0
                    ? 'No open slots posted yet for this lawyer.'
                    : 'Gold markers are open slots — tap one after entering your case details.'
                }
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default LawyerBookConsultation;
