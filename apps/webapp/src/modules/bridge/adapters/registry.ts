import type { BridgeRouteKind } from '../model/types';
import { cctpProgress } from './cctp/cctpProgress';
import { isCctpL2Network } from './cctp/contracts';
import { irisAttestationReader } from './cctp/iris';
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
      ? opStackDepositProgress({ ...bridge, to }, context, now)
      : arbitrumDepositProgress(bridge, context, now);
  }
};

const readIrisAttestations = irisAttestationReader();

// CCTP is real from an L2 to Ethereum, its only pair: it waits for Circle's attestation and the chain.
const cctpAdapter: BridgeAdapter = {
  checkProgress: (bridge, now, context) => {
    const { from } = bridge;
    if (bridge.to !== 'ethereum' || !isCctpL2Network(from))
      return mockAdapter.checkProgress(bridge, now, context);
    return cctpProgress(
      { ...bridge, from },
      context,
      now,
      context.readCctpAttestations ?? readIrisAttestations
    );
  }
};

const ADAPTERS: Record<BridgeRouteKind, BridgeAdapter> = {
  native: nativeAdapter,
  cctp: cctpAdapter,
  layerzero: mockAdapter
};

export const getBridgeAdapter = (kind: BridgeRouteKind): BridgeAdapter => ADAPTERS[kind];
