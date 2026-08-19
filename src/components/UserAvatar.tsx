import React, { useEffect, useState } from 'react';
import { resolveMediaUrl } from '../utils/citizenWorkspace';

interface UserAvatarProps {
  readonly avatarUrl?: string | null;
  readonly name?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}

const sizePx = { sm: 28, md: 36, lg: 56 };

function EmptyMark() {
  return (
    <span className="avatar-empty" aria-hidden>
      <span className="avatar-empty__ring" />
      <span className="material-symbols-outlined avatar-empty__cam">photo_camera</span>
    </span>
  );
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  name,
  size = 'md',
  className = '',
}) => {
  const px = sizePx[size];
  const src = resolveMediaUrl(avatarUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showPhoto = Boolean(src) && !failed;

  return (
    <div
      className={`avatar avatar--empty-ok ${className}`.trim()}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        overflow: 'hidden',
        background: showPhoto ? 'rgba(0, 52, 43, 0.08)' : 'var(--color-ox-brand, #0D3B2E)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
      }}
      aria-hidden={!name}
      title={name || 'No profile photo'}
    >
      {showPhoto ? (
        <img
          src={src!}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <EmptyMark />
      )}
    </div>
  );
};

export default UserAvatar;
