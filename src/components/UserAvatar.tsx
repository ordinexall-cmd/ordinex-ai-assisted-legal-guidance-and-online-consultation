import React from 'react';
import { resolveMediaUrl } from '../utils/citizenWorkspace';

interface UserAvatarProps {
  readonly avatarUrl?: string | null;
  readonly name?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}

const sizePx = { sm: 28, md: 36, lg: 56 };

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  name,
  size = 'md',
  className = '',
}) => {
  const px = sizePx[size];
  const src = resolveMediaUrl(avatarUrl);
  const initial = (name || '?').trim().charAt(0).toUpperCase();

  return (
    <div
      className={`avatar ${className}`.trim()}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        overflow: 'hidden',
        background: 'rgba(0, 52, 43, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      aria-hidden={!name}
      title={name}
    >
      {src ? (
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : initial ? (
        <span style={{ fontSize: px * 0.42, fontWeight: 700, color: 'var(--color-ox-emerald-mid)' }}>
          {initial}
        </span>
      ) : (
        <span className="material-symbols-outlined" style={{ fontSize: px * 0.55, color: 'var(--color-ox-text-muted)' }}>
          person
        </span>
      )}
    </div>
  );
};

export default UserAvatar;
