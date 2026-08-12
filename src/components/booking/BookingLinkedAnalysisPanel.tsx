import React, { useCallback, useEffect, useState } from 'react';
import {
  bookingsApi,
  type BookingLinkedAnalysis,
  type LegalAnalysisResult,
} from '../../services/api';
import { AnalysisResultsCitizen } from '../analysis/AnalysisResultsCitizen';
import { getErrorMessage } from '../../utils/userFacingError';

interface BookingLinkedAnalysisPanelProps {
  readonly bookingId: string;
  readonly consultationId: string;
  readonly reloadKey?: number;
}

export const BookingLinkedAnalysisPanel: React.FC<BookingLinkedAnalysisPanelProps> = ({
  bookingId,
  consultationId,
  reloadKey = 0,
}) => {
  const [analysis, setAnalysis] = useState<BookingLinkedAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { analysis: data } = await bookingsApi.getLinkedAnalysis(bookingId);
      setAnalysis(data);
    } catch (err) {
      setAnalysis(null);
      setError(getErrorMessage(err, 'Could not load linked AI analysis.'));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const ar: LegalAnalysisResult | null = analysis?.aiResult ?? null;

  return (
    <section
      id="booking-linked-analysis"
      className="ox-card booking-linked-analysis"
      aria-labelledby="booking-linked-analysis-title"
    >
      <header className="booking-linked-analysis__head">
        <span className="material-symbols-outlined" aria-hidden>psychology</span>
        <div>
          <h3 id="booking-linked-analysis-title" className="booking-linked-analysis__title">
            Linked AI case analysis
          </h3>
          <p className="booking-linked-analysis__hint">
            Review this before approving — the citizen attached it as legal context for this request.
          </p>
        </div>
      </header>

      {loading && (
        <p className="workbench-panel-helper">Loading analysis…</p>
      )}

      {error && !loading && (
        <p className="landing-form-error">{error}</p>
      )}

      {!loading && !error && ar && analysis && (
        <>
          {analysis.fileUrl && (
            <p className="booking-linked-analysis__hint" style={{ marginBottom: 12 }}>
              Citizen uploaded document:{' '}
              <a href={analysis.fileUrl} target="_blank" rel="noreferrer">
                Open attached file
              </a>
            </p>
          )}
          <AnalysisResultsCitizen
            ar={ar}
            meta={analysis.analysisMeta}
            category={analysis.category}
            consultationId={consultationId}
            defaultShowDetails
            isLawyerView
          />
        </>
      )}
    </section>
  );
};

export default BookingLinkedAnalysisPanel;
