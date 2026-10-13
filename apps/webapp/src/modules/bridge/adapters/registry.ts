import type { BridgeRouteKind } from '../model/types';
import { isNativeDepositNetwork } from './nativeDeposit/contracts';
import { mockAdapter } from './mockAdapter';
import type { BridgeAdapter } from './types';

// Native deposits from Ethereum are real: they wait for their readers, as the mock's timed "arrived" would be false.
const nativeAdapter: BridgeAdapter = {
  checkProgress: (bridge, now) =>
    bridge.from === 'ethereum' && isNativeDepositNetwork(bridge.to)
      ? Promise.resolve(null)
      : mockAdapter.checkProgress(bridge, now)
};

const ADAPTERS: Record<BridgeRouteKind, BridgeAdapter> = {
  native: nativeAdapter,
  cctp: mockAdapter,
  layerzero: mockAdapter
};

export const getBridgeAdapter = (kind: BridgeRouteKind): BridgeAdapter => ADAPTERS[kind];
