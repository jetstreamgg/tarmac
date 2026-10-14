import type { BridgeRouteKind } from '../model/types';
import { arbitrumDepositProgress } from './nativeDeposit/arbitrumProgress';
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
    return isOpStackNetwork(to)
      ? opStackDepositProgress({ ...bridge, to }, context)
      : arbitrumDepositProgress(bridge, context);
  }
};

const ADAPTERS: Record<BridgeRouteKind, BridgeAdapter> = {
  native: nativeAdapter,
  cctp: mockAdapter,
  layerzero: mockAdapter
};

export const getBridgeAdapter = (kind: BridgeRouteKind): BridgeAdapter => ADAPTERS[kind];
