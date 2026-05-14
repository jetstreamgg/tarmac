import { useEffect, useState } from 'react';

/**
 * Hook to detect if the current device supports touch interactions.
 * Returns false initially for SSR compatibility, then updates after mount.
 *
 * @returns {boolean} true if the device supports touch, false otherwise
 */
export function useIsTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  return isTouchDevice;
}
