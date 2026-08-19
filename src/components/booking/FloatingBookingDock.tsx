import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBookingDock } from '../../context/BookingDockContext';
import { BookingChatPanel } from './BookingChatPanel';
import { dockPeerName, isDockableBooking } from '../../utils/dockableBooking';
import { statusChipLabel } from '../../utils/bookingStatusChip';
import { useBookingSlotWindow } from '../../hooks/useBookingSlotWindow';

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

  const minimized = mode === 'minimized';
  const open = mode === 'open';
  const hidden = mode === 'hidden';

  const peerName = activeBooking
    ? dockPeerName(activeBooking)
    : dockableBookings[0]
      ? dockPeerName(dockableBookings[0])
      : 'Consultation';

  const slotWindow = useBookingSlotWindow(
    activeBooking?.availability,
    activeBooking?.status,
  );

  if (!user || dockableBookings.length === 0) return null;

  const bubbleLabel = user?.role === 'CITIZEN' ? 'Atty.' : peerName.split(' ')[0];

  const handleBubbleClick = () => {
    if (dockableBookings.length > 1) {
      openPicker();
      return;
    }
    const id = activeBookingId ?? dockableBookings[0]?.id;
    if (id) openBooking(id, { expand: true });
  };

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
            <p className="booking-dock__header-name">Conversations</p>
            <button type="button" className="booking-dock__header-btn" onClick={dismiss} aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          </header>
          <ul className="booking-dock__conv-list">
            {dockableBookings.map((b) => {
              const name = dockPeerName(b);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    className="booking-dock__conv-item"
                    onClick={() => openBooking(b.id, { expand: true })}
                  >
                    <span className="booking-dock__header-avatar" aria-hidden>{name.charAt(0).toUpperCase()}</span>
                    <span className="booking-dock__conv-text">
                      <span className="booking-dock__conv-name">{name}</span>
                      <span className="booking-dock__conv-status">{statusChipLabel(b.status)}</span>
                    </span>
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

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
        <div className="booking-dock__window">
          {activeBooking && isDockableBooking(activeBooking) ? (
            <>
              <header className="booking-dock__header">
                <div className="booking-dock__header-main">
                  <span className="booking-dock__header-avatar" aria-hidden>
                    {peerName.charAt(0).toUpperCase()}
                  </span>
                  <div className="booking-dock__header-text">
                    <p className="booking-dock__header-name">{peerName}</p>
                    <p className="booking-dock__header-status">{statusChipLabel(activeBooking.status)}</p>
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

              {dockableBookings.length > 1 && (
                <div className="booking-dock__switch-row">
                  <button
                    type="button"
                    className="booking-dock__switch-btn"
                    onClick={openPicker}
                  >
                    <span className="material-symbols-outlined" aria-hidden>forum</span>
                    Switch conversation
                  </button>
                </div>
              )}

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
                      onChatClosed={() => { void refresh(); }}
                    />
                  )}
              </div>
            </>
          ) : (
            <p className="booking-dock__loading">Loading consultation…</p>
          )}
        </div>
      )}
    </div>
  );
};
