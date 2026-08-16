import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import { bookingsApi, type Booking } from '../services/api';
import { getLawyerNav } from '../utils/lawyerWorkspace';
import { getAppBackFallback } from '../utils/navigation';
import { ApiLoadBanner } from '../components/ui/ApiLoadBanner';
import { loadErrorMessage } from '../utils/loadErrorMessage';
import { BookingStatusStepper } from '../components/booking/BookingStatusStepper';
import { statusChipLabel } from '../utils/bookingStatusChip';
import { BookingHistoryRowActions } from '../components/booking/BookingHistoryRowActions';

type Tab = 'consultations' | 'transcripts';

function fmtSlot(b: Booking) {
  return `${new Date(b.availability.date).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
  })} · ${b.availability.startTime}–${b.availability.endTime}`;
}

export const LawyerActivityHistory: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: Tab = requestedTab === 'transcripts' ? 'transcripts' : 'consultations';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
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
    const source = tab === 'transcripts' ? completedWithTranscript : bookings;
    return source.filter((b) =>
      !q ||
      b.citizen.name.toLowerCase().includes(q) ||
      b.status.toLowerCase().includes(q) ||
      (b.caseDescription || '').toLowerCase().includes(q),
    );
  }, [tab, bookings, completedWithTranscript, search]);

  const selected = useMemo(() => {
    const source = tab === 'transcripts' ? completedWithTranscript : bookings;
    return source.find((b) => b.id === selectedId) || listItems[0] || null;
  }, [tab, selectedId, bookings, completedWithTranscript, listItems]);

  useEffect(() => {
    if (!selectedId && listItems[0]) setSelectedId(listItems[0].id);
  }, [listItems, selectedId]);

  return (
    <AppShell
      variant="flow"
      title="History"
      navItems={getLawyerNav(user)}
      stepLabel="Activity"
      backTo={getAppBackFallback(true)}
    >
      <div className="staff-workspace">
        <div className="staff-tabs" role="tablist">
          {(['consultations', 'transcripts'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              className={`staff-tab${tab === t ? ' staff-tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'consultations' ? 'Consultations' : 'Transcripts'}
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
                placeholder="Search client or status…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {listItems.length === 0 ? (
                <p className="staff-empty-hint">No records found.</p>
              ) : (
                listItems.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`staff-card-row${selected?.id === b.id ? ' staff-card-row--selected' : ''}`}
                    style={{ width: '100%', textAlign: 'left', marginBottom: 6 }}
                    onClick={() => setSelectedId(b.id)}
                  >
                    <p className="staff-card-row__title">{b.citizen.name}</p>
                    <p className="staff-card-row__meta">
                      {fmtSlot(b)} · {statusChipLabel(b.status, 'LAWYER')}
                    </p>
                  </button>
                ))
              )}
            </div>

            <div className="staff-panel staff-history-detail">
              <h3 className="staff-panel__title">Detailed record</h3>
              {selected ? (
                <>
                  <p className="staff-card-row__title">{selected.citizen.name}</p>
                  <p className="staff-card-row__meta">{fmtSlot(selected)}</p>
                  <span className="staff-badge staff-badge--waiting" style={{ marginTop: 8 }}>
                    {statusChipLabel(selected.status, 'LAWYER')}
                  </span>
                  <BookingStatusStepper status={selected.status} />
                  {selected.caseDescription && (
                    <p className="staff-empty-hint" style={{ marginTop: 8 }}>
                      {selected.caseDescription}
                    </p>
                  )}
                  <div className="staff-actions">
                    <button type="button" className="ox-btn ox-btn-primary ox-btn-sm" onClick={() => navigate(`/booking/${selected.id}`)}>
                      Open booking
                    </button>
                    {['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'RATED'].includes(selected.status) && (
                      <button
                        type="button"
                        className="ox-btn ox-btn-ghost ox-btn-sm"
                        onClick={() => navigate(`/consultation/${selected.id}/preflight`)}
                      >
                        Video / transcript
                      </button>
                    )}
                    <BookingHistoryRowActions
                      booking={selected}
                      peerName={selected.citizen.name}
                      onRemoved={(id) => setBookings((prev) => prev.filter((x) => x.id !== id))}
                    />
                  </div>
                  {selected.recordingUrl && (
                    <div style={{ marginTop: 12 }}>
                      <a href={selected.recordingUrl} className="link-inline" download>
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

export default LawyerActivityHistory;
