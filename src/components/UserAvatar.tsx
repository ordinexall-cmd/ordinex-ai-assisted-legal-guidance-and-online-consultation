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

  return (
    <div
      className={`avatar avatar--empty-ok ${className}`.trim()}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        overflow: 'hidden',
        background: src ? 'rgba(0, 52, 43, 0.08)' : 'var(--color-ox-brand, #0D3B2E)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
      }}
      aria-hidden={!name}
      title={name || 'No profile photo'}
    >
      {src ? (
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span className="avatar-empty" aria-hidden>
          <span className="avatar-empty__ring" />
          <span className="material-symbols-outlined avatar-empty__cam">photo_camera</span>
        </span>
      )}
    </div>
  );
};

export default UserAvatar;
