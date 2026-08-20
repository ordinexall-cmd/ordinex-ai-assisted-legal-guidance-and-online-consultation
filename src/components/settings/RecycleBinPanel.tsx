import React, { useCallback, useEffect, useState } from 'react';
import {
  bookingsApi,
  consultationApi,
  type Booking,
} from '../../services/api';
import { getErrorMessage } from '../../utils/userFacingError';
import { bookingStatusLabel } from '../../utils/lawyerFormat';

type Tab = 'analyses' | 'consultations' | 'transcripts';

interface Props {
  readonly isLawyer: boolean;
  readonly onBack: () => void;
}

export const RecycleBinPanel: React.FC<Props> = ({ isLawyer, onBack }) => {
  const [tab, setTab] = useState<Tab>(isLawyer ? 'consultations' : 'analyses');
  const [analyses, setAnalyses] = useState<
    Array<{ id: string; title: string | null; category: string; daysRemaining: number }>
  >([]);
  const [bookings, setBookings] = useState<
    Array<{ booking: Booking; daysRemaining: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!isLawyer) {
        const { items } = await consultationApi.getTrash();
        setAnalyses(items.map((i) => ({
          id: i.id,
          title: i.title,
          category: i.category,
          daysRemaining: i.daysRemaining,
        })));
      } else {
        setAnalyses([]);
      }
      const { items: bookItems } = await bookingsApi.getTrash();
      setBookings(bookItems.map((i) => ({
        booking: i.booking,
        daysRemaining: i.daysRemaining,
      })));
    } catch (e) {
      setError(getErrorMessage(e, 'Could not load Recycle Bin.'));
    } finally {
      setLoading(false);
    }
  }, [isLawyer]);

  useEffect(() => { void load(); }, [load]);

  const tabs: Tab[] = isLawyer
    ? ['consultations', 'transcripts']
    : ['analyses', 'consultations', 'transcripts'];

  const consultationTrash = bookings.filter((b) => b.booking.status !== 'COMPLETED');
  const transcriptTrash = bookings.filter((b) => b.booking.status === 'COMPLETED');

  const restoreAnalysis = async (id: string) => {
    setBusyId(id);
    try {
      await consultationApi.restore(id);
      await load();
    } catch (e) {
      setError(getErrorMessage(e, 'Restore failed.'));
    } finally {
      setBusyId(null);
    }
  };

  const permanentAnalysis = async (id: string) => {
    if (!window.confirm('Permanently delete this case identification? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await consultationApi.permanentDelete(id);
      await load();
    } catch (e) {
      setError(getErrorMessage(e, 'Delete failed.'));
    } finally {
      setBusyId(null);
    }
  };

  const restoreBooking = async (id: string) => {
    setBusyId(id);
    try {
      await bookingsApi.restoreFromHistory(id);
      await load();
    } catch (e) {
      setError(getErrorMessage(e, 'Restore failed.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="settings-editor panel-rich">
      <button type="button" className="settings-section-back" onClick={onBack}>
        <span className="material-symbols-outlined" aria-hidden>arrow_back</span>
        Recycle Bin
      </button>
      <p className="profile-email settings-section-copy">
        Deleted items stay here for 7 days, then are removed permanently.
      </p>

      {error && (
        <div className="callout-error" role="alert">
          <p className="callout-error__text">{error}</p>
        </div>
      )}

      <div className="history-tabs" role="tablist" style={{ marginTop: 12 }}>
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`history-tabs__btn${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'analyses' ? 'Case identification' : t === 'consultations' ? 'Consultations' : 'Transcripts'}
          </button>
        ))}
      </div>

      <div className="ox-card list-panel" style={{ marginTop: 12 }}>
        <div className="list-panel__body">
          {loading ? (
            <p className="profile-email">Loading…</p>
          ) : tab === 'analyses' ? (
            analyses.length === 0 ? (
              <p className="workbench-history-empty">No deleted case identifications.</p>
            ) : (
              analyses.map((a) => (
                <div key={a.id} className="list-panel__row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <h4 className="list-panel__title">{a.title || a.category}</h4>
                    <span className="list-panel__meta">{a.daysRemaining} day{a.daysRemaining === 1 ? '' : 's'} left</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="ox-btn ox-btn-secondary ox-btn-sm"
                      disabled={busyId === a.id}
                      onClick={() => void restoreAnalysis(a.id)}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="ox-btn ox-btn-ghost ox-btn-sm"
                      disabled={busyId === a.id}
                      onClick={() => void permanentAnalysis(a.id)}
                    >
                      Delete forever
                    </button>
                  </div>
                </div>
              ))
            )
          ) : tab === 'consultations' ? (
            consultationTrash.length === 0 ? (
              <p className="workbench-history-empty">No deleted consultations.</p>
            ) : (
              consultationTrash.map(({ booking: b, daysRemaining }) => {
                const name = isLawyer ? b.citizen.name : b.lawyer.name;
                return (
                  <div key={b.id} className="list-panel__row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <h4 className="list-panel__title">{name}</h4>
                      <span className="list-panel__meta">
                        {bookingStatusLabel(b.status)} · {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left
                      </span>
                    </div>
                    <button
                      type="button"
                      className="ox-btn ox-btn-secondary ox-btn-sm"
                      disabled={busyId === b.id}
                      onClick={() => void restoreBooking(b.id)}
                    >
                      Restore
                    </button>
                  </div>
                );
              })
            )
          ) : transcriptTrash.length === 0 ? (
            <p className="workbench-history-empty">No deleted transcripts.</p>
          ) : (
            transcriptTrash.map(({ booking: b, daysRemaining }) => {
              const name = isLawyer ? b.citizen.name : b.lawyer.name;
              return (
                <div key={b.id} className="list-panel__row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <h4 className="list-panel__title">{name}</h4>
                    <span className="list-panel__meta">{daysRemaining} day{daysRemaining === 1 ? '' : 's'} left</span>
                  </div>
                  <button
                    type="button"
                    className="ox-btn ox-btn-secondary ox-btn-sm"
                    disabled={busyId === b.id}
                    onClick={() => void restoreBooking(b.id)}
                  >
                    Restore
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default RecycleBinPanel;
