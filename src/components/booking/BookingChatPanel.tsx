import React, { useEffect, useRef, useState } from 'react';
import { bookingsApi, type BookingChatMessage } from '../../services/api';
import { connectBookingRoom, disconnectBookingRoom } from '../../services/bookingSocket';
import { isAppSocketConnected } from '../../services/appSocket';
import { getErrorMessage } from '../../utils/userFacingError';

const FALLBACK_POLL_MS = 60_000;

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

export interface BookingChatPanelProps {
  bookingId: string;
  chatIsOpen: boolean;
  viewerId: string;
  viewerRole: 'CITIZEN' | 'LAWYER';
  compact?: boolean;
  hideHeader?: boolean;
  onChatClosed?: () => void;
}

export const BookingChatPanel: React.FC<BookingChatPanelProps> = ({
  bookingId,
  chatIsOpen: chatIsOpenProp,
  viewerId,
  viewerRole,
  compact = false,
  hideHeader = false,
  onChatClosed,
}) => {
  const [msgs, setMsgs] = useState<BookingChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(chatIsOpenProp);
  const [banner, setBanner] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mergeMessage = (msg: BookingChatMessage) => {
    setMsgs((prev) => {
      const i = prev.findIndex((m) => m.id === msg.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], ...msg };
        return next;
      }
      return [...prev, msg];
    });
  };

  const load = React.useCallback(async () => {
    try {
      const { messages, isOpen } = await bookingsApi.getChat(bookingId);
      setMsgs(messages);
      setOpen(isOpen);
      if (!isOpen && viewerRole === 'CITIZEN') {
        setBanner('Chat was closed by your lawyer.');
      }
    } catch { /* best-effort */ }
  }, [bookingId, viewerRole]);

  useEffect(() => {
    setOpen(chatIsOpenProp);
  }, [chatIsOpenProp]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handlers = {
      onChat: (msg: BookingChatMessage) => mergeMessage(msg),
      onChatClosed: () => {
        setOpen(false);
        setBanner(
          viewerRole === 'CITIZEN'
            ? 'Chat was closed by your lawyer.'
            : 'You closed chat for this consultation.',
        );
        onChatClosed?.();
        void load();
      },
    };
    const socket = connectBookingRoom(bookingId, handlers);

    const maybePoll = () => {
      if (document.hidden) return;
      if (socket?.connected || isAppSocketConnected()) return;
      void load();
    };

    const poll = setInterval(maybePoll, FALLBACK_POLL_MS);
    const onVisible = () => { maybePoll(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      disconnectBookingRoom(socket, bookingId, handlers);
    };
  }, [bookingId, load, onChatClosed, viewerRole]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const { message } = await bookingsApi.sendChat(bookingId, content);
      mergeMessage(message);
      setDraft('');
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Could not send message.'));
    } finally {
      setSending(false);
    }
  };

  const showHeader = !hideHeader && !compact;

  return (
    <div className={`ox-card chat-card${compact ? ' chat-card--compact' : ''}`}>
      {showHeader && (
        <div className="chat-card__head">
          <h3 className="chat-card__title">Chat</h3>
          <div className="chat-card__head-actions">
            <span className={`chat-live${open ? ' chat-live--open' : ' chat-live--closed'}`}>
              <span className="chat-live__dot" aria-hidden />
              {open ? 'Open' : 'Closed'}
            </span>
          </div>
        </div>
      )}

      {banner && !open && (
        <p className="chat-closed-banner" role="status">{banner}</p>
      )}

      <div ref={scrollRef} className="chat-thread">
        {msgs.length === 0 ? (
          <div className="muted-center chat-thread__empty">
            {open ? 'No messages yet. Say hello.' : 'Chat is closed.'}
          </div>
        ) : (
          msgs.map((m) => {
            const mine = m.fromUserId === viewerId;
            return (
              <div key={m.id} className={`chat-row${mine ? ' chat-row--mine' : ''}`}>
                <div className={mine ? 'chat-bubble-msg chat-bubble-msg--mine' : 'chat-bubble-msg chat-bubble-msg--them'}>
                  <p>{m.content}</p>
                  <p className="chat-meta">{fmtDateTime(m.sentAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {open && (
        <div className="chat-compose">
          <input
            className="ox-input chat-compose__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Type a message…"
            aria-label="Message"
          />
          <button
            type="button"
            onClick={() => { void send(); }}
            disabled={sending || draft.trim().length < 1}
            className="ox-btn ox-btn-primary chat-compose__send"
            aria-label="Send message"
          >
            <span className="material-symbols-outlined" aria-hidden>send</span>
          </button>
        </div>
      )}
    </div>
  );
};
