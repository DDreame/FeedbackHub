import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

/** Reactive hook — returns true when viewport <= 768px.
 *  Uses ResizeObserver on document.body for accurate measurement. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const el = document.body;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsMobile(entry.contentRect.width <= MOBILE_BREAKPOINT);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return isMobile;
}
