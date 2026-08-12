import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ConsultationPreflight,
  setConsultationConsent,
} from '../components/consultation/ConsultationPreflight';
import { useAuth } from '../context/AuthContext';
import type { Booking } from '../services/api';

export const ConsultationPreflightPage: React.FC = () => {
  const { id: bookingId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) return <Navigate to="/" replace />;
  if (!bookingId) return <Navigate to="/consultation/video" replace />;

  const isLawyer = user.role === 'LAWYER';
  const backTo = isLawyer ? '/lawyer/dashboard' : '/dashboard';

  const onProceed = (booking: Booking) => {
    setConsultationConsent(bookingId);
    navigate(`/consultation/${bookingId}`, { state: { booking } });
  };

  return (
    <ConsultationPreflight
      bookingId={bookingId}
      backTo={backTo}
      userEmail={user.email}
      onProceed={onProceed}
    />
  );
};

export default ConsultationPreflightPage;
