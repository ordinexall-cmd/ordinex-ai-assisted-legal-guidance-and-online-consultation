import React, { useEffect, useRef, useState } from 'react';

const BENEFITS = [
  {
    n: '01',
    title: 'AI pre-guidance',
    subtitle: 'Understand your situation before you book.',
  },
  {
    n: '02',
    title: 'Pay at booking',
    subtitle: 'No monthly platform fee — pay the lawyer when you book.',
  },
  {
    n: '03',
    title: 'RA 10173',
    subtitle: 'Your privacy is our priority.',
  },
  {
    n: '04',
    title: 'Your pace',
    subtitle: 'Work on your time, in your own words.',
  },
] as const;

export const LandingBenefitChips: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { threshold: 0.12, rootMargin: '0px 0px -5% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`landing-benefits landing-benefits--index${visible ? ' landing-benefits--visible' : ''}`}
      aria-label="What to expect"
    >
      {BENEFITS.map((item) => (
        <div key={item.title} className="landing-benefit-item">
          <span className="landing-benefit-item__n" aria-hidden>{item.n}</span>
          <div className="landing-benefit-item__copy">
            <p className="landing-benefit-item__title">{item.title}</p>
            <p className="landing-benefit-item__subtitle">{item.subtitle}</p>
          </div>
        </div>
      ))}
    </section>
  );
};

export default LandingBenefitChips;
