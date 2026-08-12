import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { notificationsApi, type AppNotification } from '../services/api';
import { onNotificationNew } from '../services/appSocket';

function fmtWhen(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

type PanelAnchor = { top: number; right: number };

function measureAnchor(button: HTMLButtonElement): PanelAnchor {
  const rect = button.getBoundingClientRect();
  return {
    top: rect.bottom + 8,
    right: Math.max(8, window.innerWidth - rect.right),
  };
}

export const NotificationBell: React.FC<{ className?: string }> = ({
  className = 'staff-notify__trigger',
}) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [anchor, setAnchor] = useState<PanelAnchor>({ top: 0, right: 16 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationsApi.list({ limit: 30 });
      setItems(res.notifications);
      setUnread(res.unreadCount);
    } catch {
      /* ignore when offline */
    }
  }, []);

  const updateAnchor = useCallback(() => {
    if (buttonRef.current) setAnchor(measureAnchor(buttonRef.current));
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 45_000);
    const unsub = onNotificationNew((n) => {
      setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 30));
      setUnread((c) => c + (n.isRead ? 0 : 1));
    });
    return () => {
      clearInterval(poll);
      unsub();
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    updateAnchor();
    refresh().finally(() => setLoading(false));
  }, [open, refresh, updateAnchor]);

  useEffect(() => {
    if (!open) return;
    updateAnchor();
    const onReposition = () => updateAnchor();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updateAnchor]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const openItem = async (n: AppNotification) => {
    if (!n.isRead) {
      try {
        await notificationsApi.markRead(n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
        setUnread((c) => Math.max(0, c - 1));
      } catch { /* ignore */ }
    }
    setOpen(false);
    if (n.linkTo) navigate(n.linkTo);
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      setUnread(0);
    } catch { /* ignore */ }
  };

  const badgeLabel = unread > 9 ? '9+' : String(unread);

  const panel = open ? (
    <div
      ref={panelRef}
      className="staff-notify__panel notify-panel--portal"
      role="dialog"
      aria-label="Notifications"
      style={{ top: anchor.top, right: anchor.right }}
    >
      <div className="staff-notify__header">
        <strong>Notifications</strong>
        {unread > 0 && (
          <button type="button" className="staff-notify__mark-read" onClick={markAll}>
            Mark all read
          </button>
        )}
      </div>
      <div className="staff-notify__list">
        {loading && items.length === 0 ? (
          <p className="staff-notify__empty">Loading…</p>
        ) : items.length === 0 ? (
          <p className="staff-notify__empty">No notifications yet.</p>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`staff-notify__item${n.isRead ? '' : ' staff-notify__item--unread'}`}
              onClick={() => openItem(n)}
            >
              <span className="staff-notify__item-title">{n.title}</span>
              <span className="staff-notify__item-msg">{n.message}</span>
              <span className="staff-notify__item-time">{fmtWhen(n.createdAt)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={wrapRef} className="staff-notify">
      <button
        ref={buttonRef}
        type="button"
        className={className}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        title="Notifications"
        onClick={() => {
          if (!open && buttonRef.current) {
            setAnchor(measureAnchor(buttonRef.current));
          }
          setOpen((v) => !v);
        }}
      >
        <span className="material-symbols-outlined" aria-hidden>notifications</span>
        {unread > 0 && (
          <span className="staff-notify__badge">{badgeLabel}</span>
        )}
      </button>
      {panel && createPortal(panel, document.body)}
    </div>
  );
};

export default NotificationBell;
