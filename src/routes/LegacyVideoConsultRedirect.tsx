import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

/** Legacy redirect: /consultation/video?bookingId=X → /consultation/X/preflight */
export const LegacyVideoConsultRedirect: React.FC = () => {
  const [params] = useSearchParams();
  const bookingId = params.get('bookingId');
  if (bookingId) {
    return <Navigate to={`/consultation/${bookingId}/preflight`} replace />;
  }
  return null;
};

export default LegacyVideoConsultRedirect;
