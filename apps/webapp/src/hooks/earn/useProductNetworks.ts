import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import type { Intent } from '@/lib/enums';
import { getSupportedChainIds } from '@/data/wagmi/config/chainFamily';
import { productNetworks } from './earnProducts';

/**
 * The chains a product's network selector offers: `productNetworks` over the
 * connected chain FAMILY, memoized once here instead of per detail page.
 *
 * The family, not the whole wagmi config. The dev config carries both real
 * mainnet and the Tenderly fork, so reading `useChains()` made every
 * mainnet-only module look two-chain there — and a mainnet-only module is
 * exactly the case the single-chain rule in `NetworkSelect` exists for.
 * `getSupportedChainIds` is what the rest of the app already means by "the
 * chains in play": the fork alone on a fork session, the five production
 * chains otherwise.
 */
export function useProductNetworks(intent: Intent, addressMap?: Record<number, unknown>): number[] {
  const chainId = useChainId();
  return useMemo(
    () => productNetworks(intent, getSupportedChainIds(chainId), addressMap),
    [intent, chainId, addressMap]
  );
}
