import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import {
  bookingsApi,
  consultationApi,
  consultationDisplayTitle,
  type Booking,
  type ConsultationResult,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { getAppBackFallback } from '../utils/navigation';
import { ApiLoadBanner } from '../components/ui/ApiLoadBanner';
import { loadErrorMessage } from '../utils/loadErrorMessage';
import { BookingStatusStepper } from '../components/booking/BookingStatusStepper';
import { statusChipLabel } from '../utils/bookingStatusChip';
import { BookingHistoryRowActions } from '../components/booking/BookingHistoryRowActions';

type Tab = 'analyses' | 'consultations' | 'transcripts';

function fmtSlot(b: Booking) {
  return `${new Date(b.availability.date).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
  })} · ${b.availability.startTime}–${b.availability.endTime}`;
}

export const ActivityHistory: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as Tab | null;
  const tab: Tab = requestedTab && ['analyses', 'consultations', 'transcripts'].includes(requestedTab)
    ? requestedTab
    : 'consultations';

  const [analyses, setAnalyses] = useState<ConsultationResult[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const hist = await consultationApi.getHistory(1, 50);
      setAnalyses(hist.consultations);
      const book = await bookingsApi.getMy({ limit: 50 });
      setBookings(book.bookings);
    } catch (e) {
      setError(loadErrorMessage(e, 'Could not load history.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setTab = (t: Tab) => {
    setSearchParams({ tab: t });
    setSelectedId(null);
    setSearch('');
  };

  const completedWithTranscript = useMemo(
    () => bookings.filter((b) => ['COMPLETED', 'RATED'].includes(b.status) && (b.hasTranscript || b.recordingUrl)),
    [bookings],
  );

  const listItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (tab === 'analyses') {
      return analyses.filter((a) =>
        !q ||
        consultationDisplayTitle(a).toLowerCase().includes(q) ||
        (a.category || '').toLowerCase().includes(q),
      );
    }
    const source = tab === 'transcripts' ? completedWithTranscript : bookings;
    return source.filter((b) =>
      !q ||
      b.lawyer.name.toLowerCase().includes(q) ||
      b.status.toLowerCase().includes(q) ||
      (b.caseDescription || '').toLowerCase().includes(q),
    );
  }, [tab, analyses, bookings, completedWithTranscript, search]);

  const selectedBooking = useMemo(() => {
    if (tab === 'analyses') return null;
    const source = tab === 'transcripts' ? completedWithTranscript : bookings;
    return source.find((b) => b.id === selectedId) || source[0] || null;
  }, [tab, selectedId, bookings, completedWithTranscript]);

  const selectedAnalysis = useMemo(() => {
    if (tab !== 'analyses') return null;
    return analyses.find((a) => a.id === selectedId) || analyses[0] || null;
  }, [tab, selectedId, analyses]);

  useEffect(() => {
    if (tab === 'analyses') {
      if (!selectedId && analyses[0]) setSelectedId(analyses[0].id);
    } else {
      const source = tab === 'transcripts' ? completedWithTranscript : bookings;
      if (!selectedId && source[0]) setSelectedId(source[0].id);
    }
  }, [tab, analyses, bookings, completedWithTranscript, selectedId]);

  return (
    <AppShell
      variant="flow"
      title="History"
      navItems={getCitizenNav(user)}
      stepLabel="Activity"
      backTo={getAppBackFallback(false)}
    >
      <div className="staff-workspace">
        <div className="staff-tabs" role="tablist">
          {([
            { key: 'consultations' as const, label: 'Consultations' },
            { key: 'transcripts' as const, label: 'Transcripts' },
            { key: 'analyses' as const, label: 'Case analysis' },
          ]).map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              className={`staff-tab${tab === t.key ? ' staff-tab--active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <ApiLoadBanner message={error} onRetry={() => void load()} />}

        {loading ? (
          <p className="staff-empty-hint">Loading…</p>
        ) : (
          <div className="staff-history-layout">
            <div className="staff-panel">
              <h3 className="staff-panel__title">Records</h3>
              <input
                className="ox-input staff-search"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {listItems.length === 0 ? (
                <p className="staff-empty-hint">No records found.</p>
              ) : tab === 'analyses' ? (
                (listItems as ConsultationResult[]).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`staff-card-row${selectedAnalysis?.id === a.id ? ' staff-card-row--selected' : ''}`}
                    style={{ width: '100%', textAlign: 'left', marginBottom: 6 }}
                    onClick={() => setSelectedId(a.id)}
                  >
                    <p className="staff-card-row__title">{consultationDisplayTitle(a)}</p>
                    <p className="staff-card-row__meta">
                      {a.category || 'Analysis'} · {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))
              ) : (
                (listItems as Booking[]).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`staff-card-row${selectedBooking?.id === b.id ? ' staff-card-row--selected' : ''}`}
                    style={{ width: '100%', textAlign: 'left', marginBottom: 6 }}
                    onClick={() => setSelectedId(b.id)}
                  >
                    <p className="staff-card-row__title">{b.lawyer.name}</p>
                    <p className="staff-card-row__meta">
                      {fmtSlot(b)} · {statusChipLabel(b.status)}
                    </p>
                  </button>
                ))
              )}
            </div>

            <div className="staff-panel staff-history-detail">
              <h3 className="staff-panel__title">Detailed record</h3>
              {tab === 'analyses' && selectedAnalysis ? (
                <>
                  <p className="staff-card-row__title">{consultationDisplayTitle(selectedAnalysis)}</p>
                  <p className="staff-card-row__meta">
                    {selectedAnalysis.category || 'Analysis'} · {new Date(selectedAnalysis.createdAt).toLocaleString()}
                  </p>
                  <p className="staff-empty-hint" style={{ marginTop: 12 }}>
                    {(selectedAnalysis.description || '').slice(0, 280) || 'No description.'}
                  </p>
                  <div className="staff-actions">
                    <button type="button" className="ox-btn ox-btn-primary ox-btn-sm" onClick={() => navigate(`/analyses/${selectedAnalysis.id}`)}>
                      Open analysis
                    </button>
                  </div>
                </>
              ) : selectedBooking ? (
                <>
                  <p className="staff-card-row__title">{selectedBooking.lawyer.name}</p>
                  <p className="staff-card-row__meta">{fmtSlot(selectedBooking)}</p>
                  <span className="staff-badge staff-badge--waiting" style={{ marginTop: 8 }}>
                    {statusChipLabel(selectedBooking.status)}
                  </span>
                  <BookingStatusStepper status={selectedBooking.status} />
                  {selectedBooking.caseDescription && (
                    <p className="staff-empty-hint" style={{ marginTop: 8 }}>
                      {selectedBooking.caseDescription}
                    </p>
                  )}
                  <div className="staff-actions">
                    <button type="button" className="ox-btn ox-btn-primary ox-btn-sm" onClick={() => navigate(`/booking/${selectedBooking.id}`)}>
                      Open booking
                    </button>
                    {['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'RATED'].includes(selectedBooking.status) && (
                      <button
                        type="button"
                        className="ox-btn ox-btn-ghost ox-btn-sm"
                        onClick={() => navigate(`/consultation/${selectedBooking.id}/preflight`)}
                      >
                        Video / transcript
                      </button>
                    )}
                    <BookingHistoryRowActions
                      booking={selectedBooking}
                      peerName={selectedBooking.lawyer.name}
                      onRemoved={(id) => setBookings((prev) => prev.filter((x) => x.id !== id))}
                    />
                  </div>
                  {selectedBooking.recordingUrl && (
                    <div style={{ marginTop: 12 }}>
                      <a href={selectedBooking.recordingUrl} className="link-inline" download>
                        Download recording
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <p className="staff-empty-hint">Select a record to view details.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default ActivityHistory;
