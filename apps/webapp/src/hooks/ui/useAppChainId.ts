import { useChainId, useConnection, useChains } from 'wagmi';

/**
 * The chain the app is pointed at.
 *
 * This used to be spelled `?network=` in the URL, which made it ambient: any
 * hook could read the app's chain by reading the location. Two did. With the
 * param gone the derivation lives here instead, so the route guard and the
 * reward-route resolver can't drift apart in what they think the current chain
 * is.
 *
 * It is NOT simply `useChainId()`. `@wagmi/core`'s `createConfig` refuses to
 * move `config.state.chainId` onto a chain the app doesn't configure, so a
 * wallet parked on (say) Polygon leaves `useChainId()` naming the last
 * configured chain — correct for reads, which is why the app renders fine, but
 * wrong for "which chain is the user on". `useConnection().chainId` is the only
 * place that truth surfaces.
 */
export function useAppChainId(): number {
  const chainId = useChainId();
  const chains = useChains();
  const { chainId: walletChainId } = useConnection();

  const offConfig = walletChainId !== undefined && !chains.some(chain => chain.id === walletChainId);
  return offConfig ? (walletChainId as number) : chainId;
}
