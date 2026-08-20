import { useCallback, useReducer } from 'react';
import { hasLocalTermsAcceptance, recordLocalTermsAcceptance } from '@/modules/ui/lib/termsAcceptanceStorage';

interface UseTermsAcceptanceParams {
  address?: string;
  /** The current terms version from `/check`; undefined until that resolves. */
  version?: string;
}

/**
 * Reads and writes the `(address, version)`-keyed localStorage flag that forms
 * the browser half of the terms gate (APP-499).
 *
 * Both an address switch and a version bump invalidate the flag, because both
 * change the key — there is no explicit invalidation step.
 */
export function useTermsAcceptance({ address, version }: UseTermsAcceptanceParams) {
  const [, rereadFlag] = useReducer((n: number) => n + 1, 0);

  // Read straight through rather than mirroring into state: the key changes
  // with the address and the version, so a cached copy would only be another
  // thing that can go stale. Nothing outside this hook writes the key.
  const hasLocalAcceptance = !!address && !!version && hasLocalTermsAcceptance(address, version);

  /**
   * Call only after the DB write has succeeded. Returns false when there is
   * nothing to key the flag by, in which case the gate stays closed.
   */
  const recordLocalAcceptance = useCallback(() => {
    if (!address || !version) return false;
    recordLocalTermsAcceptance(address, version);
    rereadFlag();
    return true;
  }, [address, version]);

  return { hasLocalAcceptance, recordLocalAcceptance };
}
