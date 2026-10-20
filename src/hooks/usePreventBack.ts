import { useEffect } from 'react';

export function usePreventBack(isActiveRide: boolean) {
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isActiveRide) {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
      }
    };

    if (isActiveRide) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isActiveRide]);
}