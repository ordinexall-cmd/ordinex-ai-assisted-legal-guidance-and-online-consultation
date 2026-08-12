import type { Booking, BookingStatus } from '../services/api';

const DOCKABLE_STATUSES: BookingStatus[] = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

/** Bookings that can use the global floating chat dock (after payment confirmed). */
export function isDockableBooking(booking: Pick<Booking, 'status' | 'chatIsOpen'>): boolean {
  if (DOCKABLE_STATUSES.includes(booking.status)) {
    if (booking.status === 'COMPLETED') return booking.chatIsOpen;
    return true;
  }
  return false;
}

export function dockPeerName(booking: Booking): string {
  return booking.viewerRole === 'CITIZEN' ? booking.lawyer.name : booking.citizen.name;
}
