import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { appendConsultationIdToPath } from '../constants/legalCategories';

/** Legacy redirect: /schedule?lawyerId=X → /lawyers/X/book */
export const ScheduleConsultation: React.FC = () => {
  const [params] = useSearchParams();
  const lawyerId = params.get('lawyerId');
  const bookingId = params.get('bookingId');
  const consultationId = params.get('consultationId');

  if (bookingId) {
    return <Navigate to={`/booking/${bookingId}`} replace />;
  }

  if (lawyerId) {
    const target = appendConsultationIdToPath(`/lawyers/${lawyerId}/book`, consultationId);
    return <Navigate to={target} replace />;
  }

  return <Navigate to="/lawyers" replace />;
};

export default ScheduleConsultation;
