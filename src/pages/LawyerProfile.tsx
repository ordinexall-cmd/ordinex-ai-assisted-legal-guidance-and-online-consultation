import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { lawyersApi, type LawyerProfile as LawyerProfileT, type LawyerReview } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { getErrorMessage } from '../utils/userFacingError';
import { LawyerProfileSkeleton } from '../components/dashboard/LawyerProfileSkeleton';
import { buildLawyerBookPath } from '../constants/legalCategories';
import { BookingFlowStepper } from '../components/booking/BookingFlowStepper';

import { LinkedInProfileHeader } from '../components/profile/LinkedInProfileHeader';

const peso = (n: number | null) => (n == null ? 'Ask' : n === 0 ? 'Free' : `₱${n.toLocaleString()}`);
const feeRangeStr = (l: LawyerProfileT) => {
  const min = l.consultationFeeMin ?? l.consultationFee ?? 0;
  const max = l.consultationFeeMax ?? min;
  if (min <= 0 && max <= 0) return 'Free';
  if (min === max) return peso(min);
  return `${peso(min)} – ${peso(max)}`;
};

export const LawyerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedConsultationId = searchParams.get('consultationId')?.trim() || '';
  const { user } = useAuth();
  const navItems = getCitizenNav(user);
  const [data, setData] = useState<{ lawyer: LawyerProfileT; reviews: LawyerReview[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    lawyersApi.getById(id)
      .then(setData)
      .catch((e) => setError(getErrorMessage(e, 'Lawyer not found.')))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) return <Navigate to="/directory" replace />;

  const bookPath = buildLawyerBookPath(id, linkedConsultationId || undefined);

  return (
    <AppShell
      variant="flow"
      title="Lawyer profile"
      navItems={navItems}
      stepLabel="Lawyer"
      backTo="/directory"
    >
      <div className="staff-workspace marketplace">
        <div className="marketplace-profile-stepper">
          <BookingFlowStepper current="lawyer" />
        </div>

        {loading && <LawyerProfileSkeleton />}

        {error && !loading && (
          <div className="staff-panel">
            <p className="staff-alert staff-alert--error">{error}</p>
            <button type="button" className="ox-btn ox-btn-ghost" onClick={() => navigate('/directory')}>
              Back to directory
            </button>
          </div>
        )}

        {data && !loading && (() => {
          const { lawyer, reviews } = data;
          const trustScore = lawyer.isVerified ? 100 : (lawyer.ratingCount > 0 ? 80 : 60);

          return (
            <div>
              <LinkedInProfileHeader
                name={lawyer.name}
                role="LAWYER"
                avatarUrl={lawyer.avatarUrl}
                isVerified={lawyer.isVerified}
                trustScore={trustScore}
                headline={lawyer.specializations.join(' · ') || 'General practice attorney'}
                practiceType={lawyer.practiceType}
                barNumber={lawyer.barNumber}
                isOwnProfile={false}
              />

              <div className="staff-page-grid staff-page-grid--2">
                <div>
                  <div className="staff-panel">
                    <div className="marketplace-profile-stats" style={{ marginBottom: '1rem' }}>
                      <span>Fee: <strong>{feeRangeStr(lawyer)}</strong></span>
                      <span>
                        Rating: <strong>{lawyer.rating > 0 ? lawyer.rating.toFixed(1) : 'New'}</strong>
                        {lawyer.ratingCount > 0 ? ` (${lawyer.ratingCount})` : ''}
                      </span>
                      {lawyer.yearsOfExperience != null && (
                        <span>Experience: <strong>{lawyer.yearsOfExperience} yr</strong></span>
                      )}
                      {lawyer.barNumber && (
                        <span>Roll / IBP: <strong>{lawyer.barNumber}</strong></span>
                      )}
                    </div>

                    {lawyer.bio && <p className="marketplace-profile-bio">{lawyer.bio}</p>}

                    <h3 className="staff-panel__title" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                      Verified Credentials
                    </h3>
                  {lawyer.credentials.length === 0 ? (
                    <p className="staff-empty-hint">No credential documents uploaded yet.</p>
                  ) : (
                    <ul className="marketplace-credentials__list">
                      {lawyer.credentials.map((c) => (
                        <li key={c.id} className="marketplace-credentials__item">
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-ox-text-muted)' }} aria-hidden>
                            description
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong>{c.title}</strong>
                            {c.description && (
                              <p className="staff-empty-hint" style={{ margin: '0.15rem 0 0' }}>{c.description}</p>
                            )}
                          </div>
                          {c.fileUrl && (
                            <a href={c.fileUrl} target="_blank" rel="noopener noreferrer" className="list-panel__link">
                              View
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <div className="staff-panel marketplace-profile-cta" style={{ marginBottom: '0.75rem' }}>
                  <h3 className="staff-panel__title">Book consultation</h3>
                  <p>
                    Choose an open time slot and share your case context. The lawyer will review your request.
                  </p>
                  <button
                    type="button"
                    className="ox-btn ox-btn-primary"
                    onClick={() => navigate(bookPath)}
                  >
                    Continue to schedule
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden>arrow_forward</span>
                  </button>
                </div>

                <div className="staff-panel">
                  <h3 className="staff-panel__title">Client reviews</h3>
                  {reviews.length === 0 ? (
                    <p className="staff-empty-hint">No reviews yet.</p>
                  ) : (
                    reviews.map((r) => (
                      <article key={r.id} className="marketplace-review">
                        <div className="marketplace-review__stars">
                          {Array.from({ length: 5 }, (_, i) => (
                            <span
                              key={i}
                              className="material-symbols-outlined"
                              style={{ fontVariationSettings: i < r.rating ? "'FILL' 1" : "'FILL' 0" }}
                            >
                              star
                            </span>
                          ))}
                        </div>
                        <p className="marketplace-review__comment">{r.comment || 'No comment.'}</p>
                        <p className="marketplace-review__author">
                          {r.citizen.name} · {new Date(r.createdAt).toLocaleDateString()}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      </div>
    </AppShell>
  );
};

export default LawyerProfile;
