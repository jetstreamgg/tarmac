import type { BridgeRouteKind } from '../model/types';
import { mockAdapter } from './mockAdapter';
import type { BridgeAdapter } from './types';

// Ethereum to Arbitrum deposits are real: they wait for the ticket reader, as the mock's timed "arrived" would be false.
const nativeAdapter: BridgeAdapter = {
  checkProgress: (bridge, now) =>
    bridge.from === 'ethereum' && bridge.to === 'arbitrum'
      ? Promise.resolve(null)
      : mockAdapter.checkProgress(bridge, now)
};

const ADAPTERS: Record<BridgeRouteKind, BridgeAdapter> = {
  native: nativeAdapter,
  cctp: mockAdapter,
  layerzero: mockAdapter
};

export const getBridgeAdapter = (kind: BridgeRouteKind): BridgeAdapter => ADAPTERS[kind];
