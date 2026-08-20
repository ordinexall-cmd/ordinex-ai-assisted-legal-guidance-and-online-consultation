import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBookingDock } from '../../context/BookingDockContext';
import { BookingChatPanel } from './BookingChatPanel';
import { dockPeerName, isDockableBooking } from '../../utils/dockableBooking';
import { statusChipLabel } from '../../utils/bookingStatusChip';
import { useBookingSlotWindow } from '../../hooks/useBookingSlotWindow';
import type { DockBookingSummary } from '../../services/api';

const fmtPreviewTime = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function ConversationRow({
  booking,
  active,
  onSelect,
}: {
  booking: DockBookingSummary;
  active: boolean;
  onSelect: () => void;
}) {
  const name = booking.peerName;
  const preview = booking.lastChatPreview?.content || statusChipLabel(booking.status);
  const time = booking.lastChatPreview?.sentAt
    ? fmtPreviewTime(booking.lastChatPreview.sentAt)
    : '';

  return (
    <li>
      <button
        type="button"
        className={`booking-dock__conv-item${active ? ' booking-dock__conv-item--active' : ''}`}
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
      >
        <span className="booking-dock__header-avatar" aria-hidden>{name.charAt(0).toUpperCase()}</span>
        <span className="booking-dock__conv-text">
          <span className="booking-dock__conv-name">{name}</span>
          <span className="booking-dock__conv-preview">{preview}</span>
        </span>
        {time && <span className="booking-dock__conv-time">{time}</span>}
      </button>
    </li>
  );
}

export const FloatingBookingDock: React.FC = () => {
  const { user } = useAuth();
  const {
    dockableBookings,
    activeBooking,
    activeBookingId,
    mode,
    loading,
    openBooking,
    openPicker,
    setMode,
    refresh,
    dismiss,
  } = useBookingDock();

  const [mobileShowList, setMobileShowList] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const onChange = () => setIsNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const minimized = mode === 'minimized';
  const open = mode === 'open';
  const hidden = mode === 'hidden';

  useEffect(() => {
    if (open && isNarrow && dockableBookings.length > 1) {
      setMobileShowList(true);
    }
  }, [open, isNarrow, dockableBookings.length]);

  const peerName = activeBooking
    ? dockPeerName(activeBooking)
    : dockableBookings[0]?.peerName ?? 'Consultation';

  const slotWindow = useBookingSlotWindow(
    activeBooking?.availability,
    activeBooking?.status,
    false,
    activeBooking?.joinExtendedUntil,
  );

  if (!user || dockableBookings.length === 0) return null;

  const bubbleLabel = user?.role === 'CITIZEN' ? 'Atty.' : peerName.split(' ')[0];
  const chatOpen = activeBooking?.chatIsOpen ?? false;

  const handleBubbleClick = () => {
    if (dockableBookings.length > 1) {
      setMobileShowList(true);
      openPicker();
      return;
    }
    const id = activeBookingId ?? dockableBookings[0]?.id;
    if (id) {
      setMobileShowList(false);
      openBooking(id, { expand: true });
    }
  };

  const selectConversation = (id: string) => {
    setMobileShowList(false);
    openBooking(id, { expand: true });
  };

  const conversationList = (
    <ul className="booking-dock__conv-list">
      {dockableBookings.map((b) => (
        <ConversationRow
          key={b.id}
          booking={b}
          active={b.id === activeBookingId}
          onSelect={() => selectConversation(b.id)}
        />
      ))}
    </ul>
  );

  if (hidden) {
    return (
      <div className="booking-dock booking-dock--bubble">
        <button
          type="button"
          className="booking-dock__bubble-btn"
          onClick={handleBubbleClick}
          aria-label={dockableBookings.length > 1 ? 'Open conversations' : `Open chat with ${peerName}`}
        >
          <span className="material-symbols-outlined booking-dock__bubble-icon">chat</span>
          <span className="booking-dock__bubble-label">{bubbleLabel}</span>
        </button>
      </div>
    );
  }

  if (mode === 'picker') {
    return (
      <div className="booking-dock booking-dock--picker">
        <div className="booking-dock__picker-window">
          <header className="booking-dock__header">
            <p className="booking-dock__header-name">Messages</p>
            <button type="button" className="booking-dock__header-btn" onClick={dismiss} aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          </header>
          {conversationList}
        </div>
      </div>
    );
  }

  const showMobileList = isNarrow && mobileShowList;

  return (
    <div
      className={`booking-dock${minimized ? ' booking-dock--minimized' : ''}${open ? ' booking-dock--open' : ''}`}
      role="region"
      aria-label="Consultation chat"
    >
      {minimized && (
        <button
          type="button"
          className="booking-dock__bar"
          onClick={() => {
            if (dockableBookings.length > 1) {
              setMobileShowList(true);
              openPicker();
              return;
            }
            const id = activeBookingId ?? dockableBookings[0]?.id;
            if (id) openBooking(id, { expand: true });
          }}
          aria-expanded={false}
        >
          <span className="booking-dock__bar-avatar" aria-hidden>
            {peerName.charAt(0).toUpperCase()}
          </span>
          <span className="booking-dock__bar-name">{peerName}</span>
          <span className="material-symbols-outlined booking-dock__bar-chevron">expand_less</span>
        </button>
      )}

      {open && (
        <div className="booking-dock__window booking-dock__window--inbox">
          {activeBooking && isDockableBooking(activeBooking) ? (
            <div className={`booking-dock__inbox${showMobileList ? ' booking-dock__inbox--list' : ''}`}>
              <aside
                className={`booking-dock__sidebar${showMobileList ? '' : ' booking-dock__sidebar--hidden-mobile'}`}
                aria-label="Conversations"
              >
                <p className="booking-dock__sidebar-title">Messages</p>
                {conversationList}
              </aside>

              <div className={`booking-dock__thread${showMobileList ? ' booking-dock__thread--hidden-mobile' : ''}`}>
                <header className="booking-dock__header">
                  <div className="booking-dock__header-main">
                    {isNarrow && dockableBookings.length > 1 && (
                      <button
                        type="button"
                        className="booking-dock__header-btn booking-dock__back-btn"
                        onClick={() => setMobileShowList(true)}
                        aria-label="Back to conversations"
                      >
                        <span className="material-symbols-outlined">arrow_back</span>
                      </button>
                    )}
                    <span className="booking-dock__header-avatar" aria-hidden>
                      {peerName.charAt(0).toUpperCase()}
                    </span>
                    <div className="booking-dock__header-text">
                      <p className="booking-dock__header-name">{peerName}</p>
                      <p className="booking-dock__header-status">
                        {statusChipLabel(activeBooking.status)}
                        {' · '}
                        <span className={`chat-live${chatOpen ? ' chat-live--open' : ' chat-live--closed'}`}>
                          <span className="chat-live__dot" aria-hidden />
                          {chatOpen ? 'Chat open' : 'Chat closed'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="booking-dock__header-actions">
                    {slotWindow.canJoinVideo ? (
                      <Link
                        to={`/consultation/${activeBooking.id}/preflight`}
                        className="booking-dock__header-btn"
                        title="Join video"
                        aria-label="Join video call"
                      >
                        <span className="material-symbols-outlined">videocam</span>
                      </Link>
                    ) : (
                      <span
                        className="booking-dock__header-btn booking-dock__header-btn--disabled"
                        title={slotWindow.hint}
                        aria-label={slotWindow.hint}
                      >
                        <span className="material-symbols-outlined">videocam_off</span>
                      </span>
                    )}
                    <Link
                      to={`/booking/${activeBooking.id}`}
                      className="booking-dock__header-btn"
                      title="Open booking"
                      aria-label="Open booking details"
                    >
                      <span className="material-symbols-outlined">open_in_new</span>
                    </Link>
                    <button
                      type="button"
                      className="booking-dock__header-btn"
                      onClick={() => setMode('minimized')}
                      aria-label="Minimize"
                    >
                      <span className="material-symbols-outlined">remove</span>
                    </button>
                    <button
                      type="button"
                      className="booking-dock__header-btn"
                      onClick={dismiss}
                      aria-label="Close"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                </header>

                <div className="booking-dock__body">
                  {loading ? (
                    <p className="booking-dock__loading">Loading chat…</p>
                  ) : (
                    <BookingChatPanel
                      bookingId={activeBooking.id}
                      chatIsOpen={activeBooking.chatIsOpen}
                      viewerId={user.id}
                      viewerRole={activeBooking.viewerRole}
                      compact
                      hideHeader
                      onChatClosed={() => { void refresh(); }}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="booking-dock__loading">Loading consultation…</p>
          )}
        </div>
      )}
    </div>
  );
};
