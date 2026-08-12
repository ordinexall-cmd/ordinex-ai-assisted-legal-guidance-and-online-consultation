import React, { useEffect, useRef, useState } from 'react';
import { bookingsApi, type BookingChatMessage } from '../../services/api';
import { connectBookingRoom, disconnectBookingRoom } from '../../services/bookingSocket';
import { getErrorMessage } from '../../utils/userFacingError';
import { normalizeTranslateLang } from '../../utils/speechLang';

const TRANSLATE_TARGET_KEY = 'ox-translate-target';

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

export interface BookingChatPanelProps {
  bookingId: string;
  chatIsOpen: boolean;
  viewerId: string;
  viewerRole: 'CITIZEN' | 'LAWYER';
  userLanguage?: string;
  compact?: boolean;
  onChatClosed?: () => void;
}

export const BookingChatPanel: React.FC<BookingChatPanelProps> = ({
  bookingId,
  chatIsOpen: chatIsOpenProp,
  viewerId,
  viewerRole,
  userLanguage = 'en',
  compact = false,
  onChatClosed,
}) => {
  const [msgs, setMsgs] = useState<BookingChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(chatIsOpenProp);
  const [translateAvailable, setTranslateAvailable] = useState(false);
  const [translateLanguages, setTranslateLanguages] = useState<{ code: string; name: string }[]>([]);
  const [translateTarget, setTranslateTarget] = useState(() => {
    const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(TRANSLATE_TARGET_KEY) : null;
    return saved || normalizeTranslateLang(userLanguage);
  });
  const [translatingId, setTranslatingId] = useState<string | null>(null);
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
      const { messages, isOpen, translateAvailable: ta } = await bookingsApi.getChat(bookingId);
      setMsgs(messages);
      setOpen(isOpen);
      setTranslateAvailable(ta);
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
    if (!translateAvailable) {
      setTranslateLanguages([]);
      return;
    }
    bookingsApi.getTranslateLanguages()
      .then(({ languages }) => {
        if (languages.length > 0) {
          setTranslateLanguages(languages);
          setTranslateTarget((prev) => {
            if (languages.some((l) => l.code === prev)) return prev;
            const preferred = normalizeTranslateLang(userLanguage);
            if (languages.some((l) => l.code === preferred)) return preferred;
            return languages[0].code;
          });
        } else {
          setTranslateLanguages([]);
          setTranslateAvailable(false);
        }
      })
      .catch(() => {
        setTranslateLanguages([]);
        setTranslateAvailable(false);
      });
  }, [translateAvailable, userLanguage]);

  const onTranslateTargetChange = (code: string) => {
    setTranslateTarget(code);
    sessionStorage.setItem(TRANSLATE_TARGET_KEY, code);
  };

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
    if (!socket) return undefined;

    const poll = setInterval(() => { void load(); }, 12000);

    return () => {
      clearInterval(poll);
      disconnectBookingRoom(socket, bookingId, handlers);
    };
  }, [bookingId, load, onChatClosed, viewerRole]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs]);

  const send = async () => {
    if (draft.trim().length < 1 || sending || !open) return;
    setSending(true);
    try {
      const { message } = await bookingsApi.sendChat(bookingId, draft.trim());
      mergeMessage(message);
      setDraft('');
    } catch (e: unknown) {
      console.error('chat send failed:', getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const translate = async (messageId: string) => {
    setTranslatingId(messageId);
    try {
      const { message } = await bookingsApi.translateChatMessage(bookingId, messageId, translateTarget);
      mergeMessage(message);
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Translation failed.'));
    } finally {
      setTranslatingId(null);
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

      {translateAvailable && translateLanguages.length > 0 && (
        <label className="chat-translate-lang">
          <span className="chat-translate-lang__label">Translate to</span>
          <select
            className="ox-input chat-translate-lang__select"
            value={translateTarget}
            onChange={(e) => onTranslateTargetChange(e.target.value)}
            aria-label="Translation language"
          >
            {translateLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>
        </label>
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
                  {m.translatedText && (
                    <p className="chat-translation">
                      {m.translatedLang && (
                        <span className="chat-translation__lang">
                          {translateLanguages.find((l) => l.code === m.translatedLang)?.name || m.translatedLang}
                          :{' '}
                        </span>
                      )}
                      {m.translatedText}
                    </p>
                  )}
                  <div className="chat-bubble-footer">
                    <p className="chat-meta">{fmtDateTime(m.sentAt)}</p>
                    {translateAvailable && translateLanguages.length > 0 && (
                      <button
                        type="button"
                        className="link-inline chat-translate-btn"
                        disabled={translatingId === m.id}
                        onClick={() => { void translate(m.id); }}
                      >
                        {translatingId === m.id ? 'Translating…' : m.translatedText ? 'Retranslate' : 'Translate'}
                      </button>
                    )}
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
