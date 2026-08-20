import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { bookingsApi, type Booking } from '../services/api';
import { onBookingUpdated } from '../services/appSocket';
import { isDockableBooking, sortDockableBookings } from '../utils/dockableBooking';

export type BookingDockMode = 'hidden' | 'picker' | 'minimized' | 'open';

interface BookingDockContextValue {
  dockableBookings: Booking[];
  activeBooking: Booking | null;
  activeBookingId: string | null;
  mode: BookingDockMode;
  loading: boolean;
  openBooking: (bookingId: string, opts?: { expand?: boolean }) => void;
  openPicker: () => void;
  setActiveBookingId: (id: string | null) => void;
  setMode: (mode: BookingDockMode) => void;
  refresh: () => Promise<void>;
  dismiss: () => void;
}

const BookingDockContext = createContext<BookingDockContextValue | null>(null);

export function BookingDockProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [dockableBookings, setDockableBookings] = useState<Booking[]>([]);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [mode, setMode] = useState<BookingDockMode>('hidden');
  const [loading, setLoading] = useState(false);

  const refreshList = useCallback(async () => {
    if (!user) {
      setDockableBookings([]);
      return;
    }
    try {
      const { bookings } = await bookingsApi.getMy({ limit: 50 });
      const dockable = sortDockableBookings(bookings.filter(isDockableBooking));
      setDockableBookings(dockable);
      setActiveBookingId((prev) => {
        if (prev && dockable.some((b) => b.id === prev)) return prev;
        return dockable[0]?.id ?? null;
      });
    } catch {
      setDockableBookings([]);
    }
  }, [user]);

  const loadActive = useCallback(async (id: string | null) => {
    if (!id) {
      setActiveBooking(null);
      return;
    }
    setLoading(true);
    try {
      const { booking } = await bookingsApi.getById(id);
      if (isDockableBooking(booking)) {
        setActiveBooking(booking);
        setDockableBookings((prev) => {
          const i = prev.findIndex((b) => b.id === booking.id);
          if (i >= 0) {
            const next = [...prev];
            next[i] = booking;
            return next;
          }
          return [booking, ...prev];
        });
      } else {
        setActiveBooking(null);
        setActiveBookingId(null);
        setMode('hidden');
      }
    } catch {
      setActiveBooking(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await refreshList();
    if (activeBookingId) await loadActive(activeBookingId);
  }, [refreshList, loadActive, activeBookingId]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setDockableBookings([]);
      setActiveBooking(null);
      setActiveBookingId(null);
      setMode('hidden');
      return;
    }
    void refreshList();
  }, [isAuthenticated, user, refreshList]);

  const dockInitialized = React.useRef(false);
  useEffect(() => {
    if (dockableBookings.length > 0 && !dockInitialized.current) {
      dockInitialized.current = true;
      setMode('minimized');
    }
    if (dockableBookings.length === 0) dockInitialized.current = false;
  }, [dockableBookings.length]);

  useEffect(() => {
    void loadActive(activeBookingId);
  }, [activeBookingId, loadActive]);

  useEffect(() => {
    if (!user) return;
    return onBookingUpdated((payload) => {
      void (async () => {
        await refreshList();
        if (payload.bookingId === activeBookingId) {
          await loadActive(payload.bookingId);
        } else {
          try {
            const { booking } = await bookingsApi.getById(payload.bookingId);
            if (isDockableBooking(booking)) {
              setActiveBookingId(payload.bookingId);
              setMode((m) => (m === 'hidden' ? 'minimized' : m));
            }
          } catch { /* ignore */ }
        }
      })();
    });
  }, [user, activeBookingId, refreshList, loadActive]);

  const openBooking = useCallback(
    (bookingId: string, opts?: { expand?: boolean; fromPicker?: boolean }) => {
      setActiveBookingId(bookingId);
      if (opts?.expand === false) setMode('minimized');
      else setMode('open');
    },
    [],
  );

  const openPicker = useCallback(() => {
    setMode('picker');
  }, []);

  const dismiss = useCallback(() => {
    setMode('hidden');
  }, []);

  const value = useMemo(
    () => ({
      dockableBookings,
      activeBooking,
      activeBookingId,
      mode,
      loading,
      openBooking,
      openPicker,
      setActiveBookingId,
      setMode,
      refresh,
      dismiss,
    }),
    [
      dockableBookings,
      activeBooking,
      activeBookingId,
      mode,
      loading,
      openBooking,
      openPicker,
      refresh,
      dismiss,
    ],
  );

  return (
    <BookingDockContext.Provider value={value}>
      {children}
    </BookingDockContext.Provider>
  );
}

export function useBookingDock(): BookingDockContextValue {
  const ctx = useContext(BookingDockContext);
  if (!ctx) throw new Error('useBookingDock must be used within BookingDockProvider');
  return ctx;
}

/** Safe hook for pages that may render outside the provider (should not happen). */
