import { BRIDGE_NETWORKS, type BridgeNetworkId } from './networks';

export type BridgePair = { from: BridgeNetworkId; to: BridgeNetworkId };

/**
 * APP-610 scope: Ethereum bridges to every other network, and every other
 * network bridges back to Ethereum only. No L2 to L2.
 */
export const allowedDestinations = (from: BridgeNetworkId): BridgeNetworkId[] =>
  from === 'ethereum'
    ? BRIDGE_NETWORKS.filter(network => network.id !== 'ethereum').map(network => network.id)
    : ['ethereum'];

export const isAllowedPair = ({ from, to }: BridgePair): boolean => allowedDestinations(from).includes(to);

// Pairs whose route sends real calls; the rest stay off until their route tickets land (APP-614 to APP-618).
const LIVE_DESTINATIONS: Partial<Record<BridgeNetworkId, BridgeNetworkId[]>> = {
  ethereum: ['base', 'arbitrum', 'optimism', 'unichain']
};

export const isLivePair = ({ from, to }: BridgePair): boolean =>
  isAllowedPair({ from, to }) && !!LIVE_DESTINATIONS[from]?.includes(to);

export const liveDestinations = (from: BridgeNetworkId): BridgeNetworkId[] =>
  allowedDestinations(from).filter(to => isLivePair({ from, to }));

export const liveSources = (): BridgeNetworkId[] =>
  BRIDGE_NETWORKS.map(network => network.id).filter(id => liveDestinations(id).length > 0);

/**
 * The pair after picking `from`. Picking the current destination swaps the
 * two sides; otherwise the destination is kept when still allowed, else it
 * falls back to the first allowed one.
 */
export const pickFrom = (current: BridgePair, from: BridgeNetworkId): BridgePair => {
  if (from === current.to) return { from, to: current.from };
  const to = isAllowedPair({ from, to: current.to }) ? current.to : allowedDestinations(from)[0];
  return { from, to };
};

/** The pair after picking `to`, swapping when it is the current source. */
export const pickTo = (current: BridgePair, to: BridgeNetworkId): BridgePair => {
  if (to === current.from) return { from: current.to, to };
  return isAllowedPair({ from: current.from, to }) ? { from: current.from, to } : { from: 'ethereum', to };
};
