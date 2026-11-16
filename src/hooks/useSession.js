import { useEffect, useState } from 'react';
import { api } from '../api';

export function useSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/me')
      .then((result) => setUser(result.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { user, setUser, loading };
}
