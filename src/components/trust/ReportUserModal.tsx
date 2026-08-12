import React, { useState } from 'react';
import { reportsApi } from '../../services/api';
import { getErrorMessage } from '../../utils/userFacingError';

const REASONS = [
  { value: 'HARASSMENT', label: 'Harassment or abuse' },
  { value: 'NO_SHOW', label: 'No-show' },
  { value: 'SCAM', label: 'Scam or fraud' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate conduct' },
  { value: 'OTHER', label: 'Other' },
] as const;

export interface ReportUserModalProps {
  readonly reportedUserId: string;
  readonly reportedUserName: string;
  readonly bookingId: string;
  readonly onClose: () => void;
  readonly onSubmitted?: () => void;
}

export const ReportUserModal: React.FC<ReportUserModalProps> = ({
  reportedUserId,
  reportedUserName,
  bookingId,
  onClose,
  onSubmitted,
}) => {
  const [reason, setReason] = useState<string>(REASONS[0].value);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('reportedUserId', reportedUserId);
        fd.append('bookingId', bookingId);
        fd.append('reason', reason);
        fd.append('description', description.trim());
        fd.append('screenshot', file);
        await reportsApi.submitForm(fd);
      } else {
        await reportsApi.submitJson({
          reportedUserId,
          bookingId,
          reason,
          description: description.trim(),
        });
      }
      setSuccess('Report submitted. Our team will review it.');
      onSubmitted?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not submit report. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="report-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="report-modal ox-card"
        role="dialog"
        aria-labelledby="report-modal-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="report-modal-title" className="report-modal__title">
          Report {reportedUserName}
        </h2>
        <p className="report-modal__hint">
          Reports are tied to this booking. Provide enough detail for review (at least 10 characters).
        </p>
        {success ? (
          <p className="report-modal__success">{success}</p>
        ) : (
          <form onSubmit={handleSubmit} className="report-modal__form">
            <label className="report-modal__label">
              Reason
              <select
                className="ox-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading}
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="report-modal__label">
              Description
              <textarea
                className="ox-input"
                rows={4}
                required
                minLength={10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                placeholder="What happened?"
              />
            </label>
            <label className="report-modal__label">
              Screenshot (optional)
              <input
                type="file"
                accept="image/*"
                disabled={loading}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {error && <p className="report-modal__error">{error}</p>}
            <div className="report-modal__actions">
              <button type="button" className="ox-btn ox-btn-secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="ox-btn ox-btn-primary" disabled={loading}>
                {loading ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
        {success && (
          <button type="button" className="ox-btn ox-btn-primary report-modal__done" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </div>
  );
};

export default ReportUserModal;
