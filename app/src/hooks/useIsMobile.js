import { useEffect, useState } from 'react';

/**
 * Single source of truth for the mobile breakpoint. Anything below this
 * gets the touch-first layout (no fixed sidebars, bottom drawers, etc.);
 * desktop tree is untouched.
 */
export const MOBILE_MAX_WIDTH = 768;

export default function useIsMobile(maxWidth = MOBILE_MAX_WIDTH) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < maxWidth : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setIsMobile(window.innerWidth < maxWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [maxWidth]);

  return isMobile;
}
