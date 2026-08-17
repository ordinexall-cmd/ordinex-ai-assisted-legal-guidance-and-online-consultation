import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  assetUrl,
  bookingsApi,
  type Booking,
  type TranscriptSegment,
} from '../../services/api';
import { connectBookingRoom, disconnectBookingRoom } from '../../services/bookingSocket';
import { useLiveSpeechToText } from '../../hooks/useLiveSpeechToText';
import { getErrorMessage } from '../../utils/userFacingError';

const speakerLabel = (s: string) => (s === 'lawyer' ? 'Lawyer' : 'Citizen');

export interface BookingTranscriptPanelProps {
  bookingId: string;
  status: Booking['status'];
  userLanguage?: string;
  liveEnabled?: boolean;
  recordingUrl?: string | null;
}

export const BookingTranscriptPanel: React.FC<BookingTranscriptPanelProps> = ({
  bookingId,
  status,
  userLanguage = 'en',
  liveEnabled = false,
  recordingUrl,
}) => {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [plainText, setPlainText] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const canLive = status === 'IN_PROGRESS' && liveEnabled;
  const canEdit = ['COMPLETED', 'RATED'].includes(status);

  const speech = useLiveSpeechToText(bookingId, canLive, userLanguage);

  const load = useCallback(async () => {
    try {
      const data = await bookingsApi.getTranscript(bookingId);
      setSegments((data.segments || []) as TranscriptSegment[]);
      setPlainText(data.plainText || '');
      setDraft(data.plainText || '');
      setLoadErr('');
    } catch (e: unknown) {
      setLoadErr(getErrorMessage(e, 'Could not load transcript.'));
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handlers = {
      onTranscript: (seg: TranscriptSegment) => {
        setSegments((prev) => {
          if (prev.some((s) => s.id === seg.id)) return prev;
          return [...prev, seg];
        });
        setPlainText((prev) => {
          const line = `${speakerLabel(seg.speaker)}: ${seg.text}`;
          return prev ? `${prev}\n${line}` : line;
        });
      },
    };
    const socket = connectBookingRoom(bookingId, handlers);
    return () => disconnectBookingRoom(socket, bookingId, handlers);
  }, [bookingId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [segments]);

  const save = async () => {
    setSaving(true);
    try {
      const data = await bookingsApi.patchTranscript(bookingId, draft);
      setPlainText(data.plainText);
      setSegments(data.segments || []);
      setEditMode(false);
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Could not save transcript.'));
    } finally {
      setSaving(false);
    }
  };

  const download = () => {
    const blob = new Blob([plainText || draft || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consultation-transcript-${bookingId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ox-card transcript-card">
      <div className="transcript-card__head">
        <h3 className="transcript-card__title">Transcript</h3>
        {canLive && speech.supported && (
          <button
            type="button"
            className={`ox-btn ox-btn-sm${speech.listening ? ' ox-btn-ghost' : ' ox-btn-primary'}`}
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
          >
            {speech.listening ? 'Stop listening' : 'Start listening'}
          </button>
        )}
      </div>

      {speech.error && <p className="transcript-hint transcript-hint--warn">{speech.error}</p>}
      {canLive && !speech.supported && (
        <p className="transcript-hint">Live speech-to-text works best in Chrome or Edge (no API key).</p>
      )}

      {canLive && speech.supported && !speech.listening && (
        <p className="transcript-hint">
          Start listening for approximate live captions (English, Tagalog, Cebuano). Not a verbatim record.
        </p>
      )}

      {status === 'CONFIRMED' && (
        <p className="transcript-hint">Live transcript starts when the session is in progress.</p>
      )}

      {loadErr && <p className="transcript-hint transcript-hint--warn">{loadErr}</p>}

      {!editMode ? (
        <>
          <div ref={scrollRef} className="transcript-scroll">
            {segments.length === 0 && !plainText ? (
              <p className="muted-center">No transcript yet.</p>
            ) : segments.length > 0 ? (
              segments.map((s) => (
                <div key={s.id} className="transcript-segment">
                  <span className="transcript-segment__who">{speakerLabel(s.speaker)}</span>
                  <span className="transcript-segment__lang">{s.lang}</span>
                  <p>{s.text}</p>
                </div>
              ))
            ) : (
              <pre className="transcript-plain">{plainText}</pre>
            )}
          </div>

          {canEdit && (
            <div className="transcript-actions">
              <button type="button" className="ox-btn ox-btn-ghost ox-btn-sm" onClick={() => { setDraft(plainText); setEditMode(true); }}>
                Edit
              </button>
              <button type="button" className="ox-btn ox-btn-ghost ox-btn-sm" onClick={download} disabled={!plainText}>
                Download .txt
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <textarea
            className="ox-input transcript-editor"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
          />
          <div className="transcript-actions">
            <button type="button" className="ox-btn ox-btn-primary ox-btn-sm" disabled={saving} onClick={() => { void save(); }}>
              Save
            </button>
            <button type="button" className="ox-btn ox-btn-ghost ox-btn-sm" onClick={() => setEditMode(false)}>
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Recording playback */}
      {recordingUrl && (
        <div className="transcript-recording">
          <h4 className="transcript-card__title" style={{ marginTop: 12 }}>Consultation Recording</h4>
          <video
            src={assetUrl(recordingUrl)}
            controls
            className="transcript-recording__player"
            style={{ width: '100%', maxHeight: 240, borderRadius: 8, background: '#1e2220', marginTop: 8 }}
          />
          <div className="transcript-actions" style={{ marginTop: 8 }}>
            <a
              href={assetUrl(recordingUrl)}
              download={`consultation-${bookingId.slice(0, 8)}.webm`}
              className="ox-btn ox-btn-ghost ox-btn-sm"
              style={{ textDecoration: 'none' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 4 }}>download</span>
              Download recording
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
