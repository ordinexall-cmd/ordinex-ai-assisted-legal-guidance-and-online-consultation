import React, { useEffect, useRef, useState } from 'react';
import { bookingsApi, type BookingChatMessage } from '../../services/api';
import { connectBookingRoom, disconnectBookingRoom } from '../../services/bookingSocket';
import { getErrorMessage } from '../../utils/userFacingError';

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

export interface BookingChatPanelProps {
  bookingId: string;
  chatIsOpen: boolean;
  viewerId: string;
  viewerRole: 'CITIZEN' | 'LAWYER';
  compact?: boolean;
  onChatClosed?: () => void;
}

export const BookingChatPanel: React.FC<BookingChatPanelProps> = ({
  bookingId,
  chatIsOpen: chatIsOpenProp,
  viewerId,
  viewerRole,
  compact = false,
  onChatClosed,
}) => {
  const [msgs, setMsgs] = useState<BookingChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(chatIsOpenProp);
  const [closeLoading, setCloseLoading] = useState(false);
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
    const poll = setInterval(() => { void load(); }, 12000);
    return () => {
      clearInterval(poll);
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

  const closeChat = async () => {
    if (!window.confirm('Close chat for this consultation? The client will not be able to send new messages.')) {
      return;
    }
    setCloseLoading(true);
    try {
      await bookingsApi.closeChat(bookingId);
      setOpen(false);
      setBanner('You closed chat for this consultation.');
      onChatClosed?.();
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Could not close chat.'));
    } finally {
      setCloseLoading(false);
    }
  };

  return (
    <div className={`ox-card chat-card${compact ? ' chat-card--compact' : ''}`}>
      <div className="chat-card__head">
        <h3 className="chat-card__title">Chat</h3>
        <div className="chat-card__head-actions">
          <span className={`chat-live${open ? ' chat-live--open' : ' chat-live--closed'}`}>
            <span className="chat-live__dot" aria-hidden />
            {open ? 'Open' : 'Closed'}
          </span>
          {viewerRole === 'LAWYER' && open && (
            <button
              type="button"
              className="ox-btn ox-btn-ghost ox-btn-sm chat-close-btn"
              disabled={closeLoading}
              onClick={() => { void closeChat(); }}
            >
              Close chat
            </button>
          )}
        </div>
      </div>

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
                  <div className="chat-bubble-footer">
                    <p className="chat-meta">{fmtDateTime(m.sentAt)}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {open && (
        <div className="chat-compose">
          <input
            className="ox-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Type a message…"
          />
          <button
            type="button"
            onClick={() => { void send(); }}
            disabled={sending || draft.trim().length < 1}
            className="ox-btn ox-btn-primary chat-compose__send"
            aria-label="Send"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      )}
    </div>
  );
};
