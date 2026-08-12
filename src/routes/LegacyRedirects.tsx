import { Navigate, useSearchParams } from 'react-router-dom';

/** Legacy `/payment` — honor-system checkout lives on booking detail. */
export function LegacyPaymentRedirect() {
  const [params] = useSearchParams();
  const bookingId = params.get('bookingId');
  if (bookingId) {
    return <Navigate to={`/booking/${bookingId}`} replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

/** Legacy `/booking-confirmation` — manage flow is on `/booking/:id`. */
export function LegacyBookingConfirmationRedirect() {
  const [params] = useSearchParams();
  const bookingId = params.get('bookingId');
  if (!bookingId) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to={`/booking/${encodeURIComponent(bookingId)}`} replace />;
}
