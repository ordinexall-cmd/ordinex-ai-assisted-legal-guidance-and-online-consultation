import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MarketingNav } from '../components/shell/MarketingNav';
import { useAuth } from '../context/AuthContext';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const homeTo = user
    ? user.role === 'LAWYER'
      ? '/lawyer/dashboard'
      : '/dashboard'
    : '/';

  return (
    <div className="landing-page">
      <MarketingNav />
      <main className="marketing-canvas not-found-page">
        <section className="not-found-page__card ox-card" aria-labelledby="not-found-title">
          <p className="not-found-page__code" aria-hidden>
            404
          </p>
          <h1 id="not-found-title" className="not-found-page__title">
            Page not found
          </h1>
          <p className="not-found-page__body">
            That link does not match any screen in Ordinex. Check the URL or head back to a known page.
          </p>
          <div className="not-found-page__actions">
            <Link to={homeTo} className="ox-btn ox-btn-primary">
              {user ? 'Go to dashboard' : 'Back to home'}
            </Link>
            <button type="button" className="ox-btn ox-btn-secondary" onClick={() => navigate(-1)}>
              Go back
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default NotFoundPage;
