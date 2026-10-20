import { useEffect } from 'react';

export function useRootBackLock() {
  useEffect(() => {
    const keepDashboardAtRoot = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', keepDashboardAtRoot);
    return () => window.removeEventListener('popstate', keepDashboardAtRoot);
  }, []);
}
