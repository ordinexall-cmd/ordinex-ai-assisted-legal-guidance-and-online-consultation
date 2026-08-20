import type { Booking, BookingStatus } from '../services/api';

const DOCKABLE_STATUSES: BookingStatus[] = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

/** Bookings that can use the global floating chat dock (after payment confirmed). */
export function isDockableBooking(booking: Pick<Booking, 'status' | 'chatIsOpen'>): boolean {
  return DOCKABLE_STATUSES.includes(booking.status);
}

export function dockPeerName(booking: Booking): string {
  return booking.viewerRole === 'CITIZEN' ? booking.lawyer.name : booking.citizen.name;
}

export function sortDockableBookings(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => {
    const openA = a.chatIsOpen ? 1 : 0;
    const openB = b.chatIsOpen ? 1 : 0;
    if (openA !== openB) return openB - openA;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
