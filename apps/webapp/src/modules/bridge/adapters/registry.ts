import type { BridgeRouteKind } from '../model/types';
import { isNativeDepositNetwork, isOpStackNetwork } from './nativeDeposit/contracts';
import { opStackDepositProgress } from './nativeDeposit/opStackProgress';
import { mockAdapter } from './mockAdapter';
import type { BridgeAdapter } from './types';

// Native deposits from Ethereum are real: they wait for their readers, as the mock's timed "arrived" would be false.
const nativeAdapter: BridgeAdapter = {
  checkProgress: (bridge, now, context) => {
    const { to } = bridge;
    if (bridge.from !== 'ethereum' || !isNativeDepositNetwork(to))
      return mockAdapter.checkProgress(bridge, now, context);
    // Arbitrum deposits wait for their ticket reader.
    return isOpStackNetwork(to) ? opStackDepositProgress({ ...bridge, to }, context) : Promise.resolve(null);
  }
};

const ADAPTERS: Record<BridgeRouteKind, BridgeAdapter> = {
  native: nativeAdapter,
  cctp: mockAdapter,
  layerzero: mockAdapter
};

export const getBridgeAdapter = (kind: BridgeRouteKind): BridgeAdapter => ADAPTERS[kind];
