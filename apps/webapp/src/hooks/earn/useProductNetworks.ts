import { useMemo } from 'react';
import { useChains } from 'wagmi';
import type { Intent } from '@/lib/enums';
import { productNetworks } from './earnProducts';

/**
 * The chains a product's detail-page network selector offers —
 * `productNetworks` over the wagmi config's chain set, memoized once here
 * instead of per detail page.
 */
export function useProductNetworks(intent: Intent, addressMap?: Record<number, unknown>): number[] {
  const chains = useChains();
  return useMemo(
    () =>
      productNetworks(
        intent,
        chains.map(chain => chain.id),
        addressMap
      ),
    [intent, chains, addressMap]
  );
}
