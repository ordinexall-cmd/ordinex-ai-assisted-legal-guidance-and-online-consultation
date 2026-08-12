import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Booking } from '../../services/api';
import { BookingFlowLayout } from './BookingFlowLayout';
import { BookingDetailHero } from './BookingDetailHero';
import { BookingDetailAside } from './BookingDetailAside';
import { BookingActionPanel } from './BookingActionPanel';
import { BookingDetailFooter } from './BookingDetailFooter';
import { ReportUserModal } from '../trust/ReportUserModal';
import { BookingLinkedAnalysisPanel } from './BookingLinkedAnalysisPanel';
import { BookingStatusStepper } from './BookingStatusStepper';

export interface BookingManageViewProps {
  readonly booking: Booking;
  readonly actionLoading: boolean;
  readonly onAction: (fn: () => Promise<{ booking: Booking }>) => void;
  /** Bump when booking reloads so linked analysis refetches. */
  readonly analysisReloadKey?: number;
}

const scrollToClientAside = () => {
  document.getElementById('booking-client-aside')?.scrollIntoView({ behavior: 'smooth' });
};

const scrollToLinkedAnalysis = () => {
  document.getElementById('booking-linked-analysis')?.scrollIntoView({ behavior: 'smooth' });
};

export const BookingManageView: React.FC<BookingManageViewProps> = ({
  booking,
  actionLoading,
  onAction,
  analysisReloadKey = 0,
}) => {
  const navigate = useNavigate();
  const [showReport, setShowReport] = useState(false);
  const isLawyer = booking.viewerRole === 'LAWYER';
  const counterparty = isLawyer ? booking.citizen : booking.lawyer;
  const counterpartyName = counterparty.name;

  return (
    <>
    <BookingFlowLayout
      step="manage"
      variant="manage"
      aside={<BookingDetailAside booking={booking} />}
      footer={<BookingDetailFooter onReportUser={() => setShowReport(true)} />}
      main={(
        <div className="booking-flow-main-stack booking-flow-main-stack--manage">
          <BookingDetailHero
            booking={booking}
            counterpartyName={counterpartyName}
            isLawyerViewer={isLawyer}
            onToggleClientProfile={isLawyer ? scrollToClientAside : undefined}
            onOpenAnalysis={
              !isLawyer && booking.consultationId
                ? () => navigate(`/ai-analysis?id=${booking.consultationId}`)
                : isLawyer && booking.consultationId
                  ? scrollToLinkedAnalysis
                  : undefined
            }
          />
          <BookingStatusStepper status={booking.status} />
          {isLawyer && booking.consultationId && (
            <BookingLinkedAnalysisPanel
              bookingId={booking.id}
              consultationId={booking.consultationId}
              reloadKey={analysisReloadKey}
            />
          )}
          <BookingActionPanel
            booking={booking}
            loading={actionLoading}
            onAction={onAction}
            onViewClientProfile={isLawyer ? scrollToClientAside : undefined}
          />
        </div>
      )}
    />
    {showReport && (
      <ReportUserModal
        reportedUserId={counterparty.id}
        reportedUserName={counterpartyName}
        bookingId={booking.id}
        onClose={() => setShowReport(false)}
      />
    )}
    </>
  );
};

export default BookingManageView;
