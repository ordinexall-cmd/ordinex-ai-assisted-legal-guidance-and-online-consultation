import React, { useState } from 'react';
import { consultationApi, consultationDisplayTitle, type ConsultationResult } from '../services/api';
import { getErrorMessage } from '../utils/userFacingError';

interface Props {
  readonly item: ConsultationResult;
  readonly onUpdated: () => void;
  readonly onDeleted: (id: string) => void;
  readonly onOpen?: (id: string) => void;
}

export const ConsultationRowActions: React.FC<Props> = ({ item, onUpdated, onDeleted, onOpen }) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(consultationDisplayTitle(item));
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const saveTitle = async () => {
    const next = title.trim();
    if (!next) {
      setEditing(false);
      setTitle(consultationDisplayTitle(item));
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      await consultationApi.rename(item.id, next);
      setEditing(false);
      onUpdated();
    } catch (err) {
      setTitle(consultationDisplayTitle(item));
      setActionError(getErrorMessage(err, 'Could not rename analysis.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Move "${consultationDisplayTitle(item)}" to Recycle Bin? You can restore it within 7 days.`)) return;
    setBusy(true);
    setActionError('');
    try {
      await consultationApi.remove(item.id);
      onDeleted(item.id);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not move analysis to Recycle Bin.'));
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          className="inline-rename-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void saveTitle();
            if (e.key === 'Escape') {
              setEditing(false);
              setTitle(consultationDisplayTitle(item));
            }
          }}
          autoFocus
          disabled={busy}
        />
        <button type="button" className="ox-btn-ghost-icon" title="Save" disabled={busy} onClick={() => void saveTitle()}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {onOpen && (
        <button type="button" className="list-panel__link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => onOpen(item.id)}>
          Details
        </button>
      )}
      <button type="button" className="ox-btn-ghost-icon" title="Rename" disabled={busy} onClick={() => setEditing(true)}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
      </button>
      <button type="button" className="ox-btn-ghost-icon" title="Delete" disabled={busy} onClick={() => void remove()}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--color-ox-error)' }}>delete</span>
      </button>
      {actionError && (
        <span className="list-panel__meta" style={{ color: 'var(--color-ox-error)', flexBasis: '100%' }}>
          {actionError}
        </span>
      )}
    </div>
  );
};

export default ConsultationRowActions;
