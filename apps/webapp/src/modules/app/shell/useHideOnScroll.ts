import { useEffect, useRef, useState } from 'react';

// Keep the bar out until the finger clearly reverses: small up-ticks happen on
// every touch scroll (rubber-banding, momentum wobble) and would flicker it.
const DIRECTION_THRESHOLD_PX = 4;
// Near the top the bar is always shown — hiding it there reads as a glitch,
// and the page can't scroll far enough to need the room.
const TOP_ZONE_PX = 80;

/**
 * Hide-on-scroll for the mobile bottom Navbar (M2.1, APP-379): hidden while
 * scrolling down, shown again on scroll up or near the top of the page.
 *
 * Tracks document scroll only. Legacy boxed routes scroll inside the shell
 * surface instead, so they keep a static bar — they're pre-redesign surfaces
 * and the interaction spec only covers the destination pages.
 */
export function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      if (Math.abs(delta) < DIRECTION_THRESHOLD_PX) return;
      lastScrollY.current = y;
      setHidden(y > TOP_ZONE_PX && delta > 0);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return hidden;
}
