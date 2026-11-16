import React from 'react';

function UserAvatar({ name = '', preferences, className = '', title }) {
  const avatar = preferences?.avatar;
  const initial = name.trim().charAt(0).toLocaleUpperCase() || '?';
  return (
    <span
      className={`user-avatar ${className}`.trim()}
      style={{ '--avatar-color': preferences?.avatarColor || '#d8eee1' }}
      title={title}
      aria-hidden='true'
    >
      {avatar ? <img src={avatar} alt='' /> : initial}
    </span>
  );
}

export { UserAvatar };
