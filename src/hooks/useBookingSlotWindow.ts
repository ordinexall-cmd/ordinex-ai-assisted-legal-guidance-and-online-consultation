import { useEffect, useMemo, useState } from 'react';
import {
  bookingSlotJoinHint,
  bookingSlotJoinHintForDemo,
  canJoinBookingVideo,
  getBookingSlotPhase,
  type BookingSlotInfo,
} from '../utils/bookingSlotWindow';

const TICK_MS = 30_000;

export function useBookingSlotWindow(
  slot: BookingSlotInfo | undefined,
  status: string | undefined,
  demoBypass = false,
) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(id);
  }, [slot?.date, slot?.startTime, slot?.endTime]);

  return useMemo(() => {
    if (!slot || !status) {
      return {
        phase: 'before' as const,
        canJoinVideo: false,
        hint: '',
      };
    }
    const phase = getBookingSlotPhase(slot, now);
    const canJoinVideo = canJoinBookingVideo(slot, status, now, demoBypass);
    const hint =
      demoBypass && status === 'CONFIRMED'
        ? bookingSlotJoinHintForDemo()
        : bookingSlotJoinHint(slot, now);
    return { phase, canJoinVideo, hint };
  }, [slot, status, now, demoBypass]);
}
