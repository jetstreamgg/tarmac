import { useEffect, type RefObject } from 'react';

const CHECK_MS = 1000;

const isOnTop = (element: Element) => {
  const { left, right, top, bottom } = element.getBoundingClientRect();
  const x = (Math.max(left, 0) + Math.min(right, window.innerWidth)) / 2;
  const y = (Math.max(top, 0) + Math.min(bottom, window.innerHeight)) / 2;
  return element.contains(document.elementFromPoint(x, y));
};

/** Calls `onSeen` while `enabled` once at least half of `ref` stays on screen for a moment, uncovered, in a visible tab. */
export function useSeenOnScreen(ref: RefObject<Element | null>, enabled: boolean, onSeen: () => void) {
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof IntersectionObserver === 'undefined') return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const observer = new IntersectionObserver(
      entries => {
        clearInterval(timer);
        if (!entries.at(-1)?.isIntersecting) return;
        // An observer can't tell a loader or modal is on top, so this also asks the page.
        timer = setInterval(() => {
          if (document.visibilityState === 'visible' && isOnTop(element)) onSeen();
        }, CHECK_MS);
      },
      { threshold: 0.5 }
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearInterval(timer);
    };
  }, [ref, enabled, onSeen]);
}
