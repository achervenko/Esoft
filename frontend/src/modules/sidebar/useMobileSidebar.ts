import { useEffect, useState } from 'react';

const MOBILE_SIDEBAR_QUERY = '(max-width: 760px)';

export function useMobileSidebar() {
  const [isMobileSidebar, setIsMobileSidebar] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia(MOBILE_SIDEBAR_QUERY).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_SIDEBAR_QUERY);
    const handleChange = () => setIsMobileSidebar(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMobileSidebar;
}
