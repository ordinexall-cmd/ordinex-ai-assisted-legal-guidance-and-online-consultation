import React from 'react';
import type { Booking } from '../../services/api';
import { UserAvatar } from '../UserAvatar';

const peso = (n: number | null | undefined) =>
  (n == null ? 'Ask' : n === 0 ? 'Free' : `₱${n.toLocaleString()}`);

interface BookingDetailAsideProps {
  readonly booking: Booking;
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="booking-aside-row">
      <span className="material-symbols-outlined booking-aside-row__icon" aria-hidden>
        {icon}
      </span>
      <div className="booking-aside-row__text">
        <span className="booking-aside-row__label">{label}</span>
        <span className="booking-aside-row__value">{value}</span>
      </div>
    </div>
  );
}

export const BookingDetailAside: React.FC<BookingDetailAsideProps> = ({ booking }) => {
  const isLawyerViewer = booking.viewerRole === 'LAWYER';
  const person = isLawyerViewer ? booking.citizen : booking.lawyer;
  const fee = peso(booking.feeAtBooking);
  const roleLabel = isLawyerViewer ? 'Client' : 'Lawyer';

  return (
    <>
      <div
        className="ox-card booking-aside-card booking-aside-card--mock"
        id={isLawyerViewer ? 'booking-client-aside' : undefined}
      >
        <h3 className="booking-aside-card__title">
          {isLawyerViewer ? 'Client profile' : 'Lawyer profile'}
        </h3>
        <div className="booking-aside-profile">
          <UserAvatar
            avatarUrl={person.avatarUrl}
            name={person.name}
            size="lg"
          />
          <div className="booking-aside-profile__text">
            <p className="booking-aside-profile__name">{person.name}</p>
            <p className="booking-aside-profile__role">{roleLabel}</p>
          </div>
        </div>
        {isLawyerViewer && (
          <>
            <ProfileRow icon="star" label="Rating" value="New client" />
            {booking.citizen.phone ? (
              <ProfileRow icon="call" label="Phone" value={booking.citizen.phone} />
            ) : null}
            {booking.citizen.dob ? (
              <ProfileRow icon="cake" label="Date of birth" value={booking.citizen.dob} />
            ) : null}
            {booking.citizen.gender ? (
              <ProfileRow icon="wc" label="Gender" value={booking.citizen.gender} />
            ) : null}
            {booking.citizen.address ? (
              <ProfileRow icon="location_on" label="Address" value={booking.citizen.address} />
            ) : null}
            {booking.citizen.civilStatus ? (
              <ProfileRow icon="family_restroom" label="Civil status" value={booking.citizen.civilStatus} />
            ) : null}
            {booking.citizen.occupation ? (
              <ProfileRow icon="work" label="Occupation" value={booking.citizen.occupation} />
            ) : null}
          </>
        )}
      </div>

      {booking.feeAtBooking > 0 ? (
        <div className="ox-card booking-aside-card booking-aside-card--mock">
          <h3 className="booking-aside-card__title booking-aside-card__title--caps booking-aside-card__title--with-icon">
            <span className="material-symbols-outlined" aria-hidden>account_balance_wallet</span>
            Payment summary
          </h3>
          <div className="booking-aside-payment-row">
            <span>Consultation fee</span>
            <strong>{fee}</strong>
          </div>
          <div className="booking-aside-payment-row booking-aside-payment-row--total">
            <span>Total</span>
            <strong>{fee}</strong>
          </div>
        </div>
      ) : null}

      <div className="ox-card booking-aside-card booking-aside-card--trust booking-aside-card--mock">
        <span className="material-symbols-outlined booking-aside-trust__icon" aria-hidden>
          verified_user
        </span>
        <div>
          <p className="booking-aside-trust__title">You&apos;re in good hands</p>
          <p className="booking-aside-trust__text">
            {isLawyerViewer
              ? 'All lawyers are identity verified and committed to professional ethics.'
              : 'Lawyers on Ordinex complete identity checks. Your consultation is private to this booking.'}
          </p>
        </div>
      </div>
    </>
  );
};

export default BookingDetailAside;
