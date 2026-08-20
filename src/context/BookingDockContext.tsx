import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { bookingsApi, type Booking, type DockBookingSummary } from '../services/api';
import { onBookingUpdated } from '../services/appSocket';

export type BookingDockMode = 'hidden' | 'picker' | 'minimized' | 'open';

interface BookingDockContextValue {
  dockableBookings: DockBookingSummary[];
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

const DOCKABLE_STATUSES = new Set(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED']);

export function BookingDockProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [dockableBookings, setDockableBookings] = useState<DockBookingSummary[]>([]);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [mode, setMode] = useState<BookingDockMode>('hidden');
  const [loading, setLoading] = useState(false);
  const activeBookingIdRef = useRef<string | null>(null);
  const socketDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeBookingIdRef.current = activeBookingId;
  }, [activeBookingId]);

  const refreshList = useCallback(async () => {
    if (!user) {
      setDockableBookings([]);
      return;
    }
    try {
      const { bookings } = await bookingsApi.getDockSummary();
      const dockable = bookings.filter((b) => DOCKABLE_STATUSES.has(b.status));
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
      if (DOCKABLE_STATUSES.has(booking.status)) {
        setActiveBooking(booking);
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
    if (activeBookingIdRef.current) await loadActive(activeBookingIdRef.current);
  }, [refreshList, loadActive]);

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
      if (socketDebounceRef.current) clearTimeout(socketDebounceRef.current);
      socketDebounceRef.current = setTimeout(() => {
        void (async () => {
          if (payload.bookingId === activeBookingIdRef.current) {
            await loadActive(payload.bookingId);
          }
          await refreshList();
        })();
      }, 2000);
    });
  }, [user, loadActive, refreshList]);

  useEffect(() => () => {
    if (socketDebounceRef.current) clearTimeout(socketDebounceRef.current);
  }, []);

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
