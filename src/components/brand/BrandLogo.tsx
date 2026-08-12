import React, { useState } from 'react';
import { OxLogo } from '../icons/OxLogo';

export type BrandLogoVariant = 'onLight' | 'onDark';
export type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  readonly size?: BrandLogoSize;
  readonly variant?: BrandLogoVariant;
  readonly showWordmark?: boolean;
  readonly className?: string;
}

const heights: Record<BrandLogoSize, number> = { sm: 32, md: 40, lg: 52 };

const LOGO_SRC = '/brand/logo-mark-nav.png';
const LOGO_SRC_SET = '/brand/logo-mark@2x.png 2x';

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  variant = 'onLight',
  showWordmark = true,
  className = '',
}) => {
  const [failed, setFailed] = useState(false);
  const h = heights[size];

  if (failed) {
    return (
      <span className={`brand-logo brand-logo--${variant} brand-logo--${size} ${className}`.trim()}>
        <OxLogo size={h * 0.85} className="brand-logo__fallback" />
        {showWordmark && <span className="brand-wordmark">ORDINEX</span>}
      </span>
    );
  }

  return (
    <span className={`brand-logo brand-logo--${variant} brand-logo--${size} ${className}`.trim()}>
      <img
        src={LOGO_SRC}
        srcSet={LOGO_SRC_SET}
        alt=""
        className="brand-logo__mark"
        style={{ height: h }}
        onError={() => setFailed(true)}
      />
      {showWordmark && <span className="brand-wordmark">ORDINEX</span>}
    </span>
  );
};

export default BrandLogo;
