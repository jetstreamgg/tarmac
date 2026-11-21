import type { BridgeRouteKind } from '../model/types';
import { cctpProgress } from './cctp/cctpProgress';
import { isCctpL2Network } from './cctp/contracts';
import { forkAttestationReader } from './cctp/forkAttestations';
import { forkIrisBaseUrl, irisAttestationReader } from './cctp/iris';
import { arbitrumDepositProgress } from './nativeDeposit/arbitrumProgress';
import { isNativeDepositNetwork, isOpStackNetwork } from './nativeDeposit/contracts';
import { opStackDepositProgress } from './nativeDeposit/opStackProgress';
import { arbitrumWithdrawalProgress } from './nativeWithdrawal/arbitrumProgress';
import { opStackWithdrawalProgress } from './nativeWithdrawal/opStackProgress';
import { mockAdapter } from './mockAdapter';
import type { BridgeAdapter } from './types';

// Native deposits and withdrawals are real: they wait for their readers, as the mock's timed "arrived" would be false.
// An entry stored for any other pair is not a bridge the app sent, so it never moves.
const nativeAdapter: BridgeAdapter = {
  checkProgress: async (bridge, now, context) => {
    const { from, to } = bridge;
    if (from === 'ethereum' && isNativeDepositNetwork(to))
      return isOpStackNetwork(to)
        ? opStackDepositProgress({ ...bridge, to }, context, now)
        : arbitrumDepositProgress(bridge, context, now);
    if (to === 'ethereum' && isNativeDepositNetwork(from))
      return isOpStackNetwork(from)
        ? opStackWithdrawalProgress({ ...bridge, from }, context, now)
        : arbitrumWithdrawalProgress({ ...bridge, from }, context, now);
    return null;
  }
};

const readIrisAttestations = irisAttestationReader();
const forkIrisUrl = forkIrisBaseUrl(import.meta.env);
const readForkIrisAttestations = forkIrisUrl ? irisAttestationReader(forkIrisUrl) : undefined;

// CCTP is real from an L2 to Ethereum, its only pair: it waits for Circle's attestation and the chain.
// An entry stored for any other pair is not a bridge the app sent, so it never moves.
const cctpAdapter: BridgeAdapter = {
  checkProgress: async (bridge, now, context) => {
    const { from } = bridge;
    if (bridge.to !== 'ethereum' || !isCctpL2Network(from)) return null;
    const readAttestations = context.onTenderlyFork
      ? forkAttestationReader(context, readForkIrisAttestations)
      : readIrisAttestations;
    return cctpProgress({ ...bridge, from }, context, now, readAttestations);
  }
};

const ADAPTERS: Record<BridgeRouteKind, BridgeAdapter> = {
  native: nativeAdapter,
  cctp: cctpAdapter,
  layerzero: mockAdapter
};

export const getBridgeAdapter = (kind: BridgeRouteKind): BridgeAdapter => ADAPTERS[kind];
