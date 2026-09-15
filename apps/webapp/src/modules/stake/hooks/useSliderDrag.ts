import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Whether a pointer is currently dragging a slider — so the figures that
 * follow it (`RollingValue instant`) swap under the thumb instead of starting a
 * roll on every tick, and roll once on release. Spread `dragProps` onto the
 * element wrapping the slider; the release listener lives on the window,
 * since the pointer rarely lets go over the track it grabbed.
 */
export function useSliderDrag(): { dragging: boolean; dragProps: { onPointerDown: () => void } } {
  const [dragging, setDragging] = useState(false);
  const release = useRef<(() => void) | null>(null);

  const onPointerDown = useCallback(() => {
    setDragging(true);
    if (release.current) return;
    const stop = () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      release.current = null;
      setDragging(false);
    };
    release.current = stop;
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }, []);

  useEffect(() => () => release.current?.(), []);

  return { dragging, dragProps: { onPointerDown } };
}
