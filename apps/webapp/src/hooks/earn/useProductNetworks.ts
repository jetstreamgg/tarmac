import { useMemo } from 'react';
import { useChainId, useChains } from 'wagmi';
import type { Intent } from '@/lib/enums';
import { getSupportedChainIds } from '@/data/wagmi/config/chainFamily';
import { forkL2ChainIds } from '@/data/wagmi/config/forkChains';
import { isForkChainId } from '@/utils/chainId';
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
 * product resolves to `[mainnet]` and its pill goes static there. The one
 * exception is a dev build with the Tenderly fork L2s: on a fork the selector
 * keeps to the fork family, so it never offers a real chain beside its fork,
 * and off it the fork L2s are dropped, so a real L2 never shows twice.
 */
export function useProductNetworks(intent: Intent, addressMap?: Record<number, unknown>): number[] {
  const chains = useChains();
  const connectedChainId = useChainId();
  const onForkFamily = forkL2ChainIds.length > 0 && isForkChainId(connectedChainId);
  return useMemo(() => {
    const ids = chains.map(chain => chain.id);
    const family = onForkFamily ? getSupportedChainIds(connectedChainId) : undefined;
    return productNetworks(
      intent,
      ids.filter(id => (family ? family.includes(id) : !forkL2ChainIds.includes(id))),
      addressMap
    );
  }, [intent, chains, addressMap, onForkFamily, connectedChainId]);
}
