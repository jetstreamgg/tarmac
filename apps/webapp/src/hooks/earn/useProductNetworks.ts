import { useMemo } from 'react';
import { useChains } from 'wagmi';
import type { Intent } from '@/lib/enums';
import { productNetworks } from './earnProducts';

/**
 * The chains a product's network selector offers — `productNetworks` over the
 * wagmi config's chain set, memoized once here instead of per detail page.
 *
 * The CONFIG's chains, deliberately, not `getSupportedChainIds`' family. The
 * family collapses to the Tenderly fork alone on a fork session, which is right
 * for a data filter (you can only read the fork) but wrong for a switcher: it
 * would leave the dev and mock builds — where the fork sits alongside
 * fork-flavoured L2s — with a single-chain static pill on every product, and no
 * way to reach an L2 at all. Whether a product is genuinely single-chain then
 * falls out of the config: production carries no fork, so a mainnet-only
 * product resolves to `[mainnet]` and its pill goes static there.
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
