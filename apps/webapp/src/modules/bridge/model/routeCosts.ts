import { destinationActions } from './resolveRoute';
import type { BridgeNetworkId } from './networks';
import type { BridgeRoute, PendingBridgeStepAction } from './types';

// Upper estimates of each Ethereum step's gas: about 10% over the mainnet maximum seen in October 2026.
const CCTP_CLAIM_GAS = 210_000n;
const OP_STACK_PROVE_GAS = 500_000n;
const OP_STACK_FINALIZE_GAS = 350_000n;
const ARBITRUM_EXECUTE_GAS = 200_000n;

/** Upper estimate of the gas a step after the source send costs on Ethereum, for a bridge from `from`. */
export const ethereumStepGas = (action: PendingBridgeStepAction, from: BridgeNetworkId): bigint => {
  if (action === 'claim') return CCTP_CLAIM_GAS;
  if (action === 'prove') return OP_STACK_PROVE_GAS;
  return from === 'arbitrum' ? ARBITRUM_EXECUTE_GAS : OP_STACK_FINALIZE_GAS;
};

/** Gas the user spends on the destination after the source send: CCTP's claim, a withdrawal's prove and finalize. */
export const destinationGas = (route: BridgeRoute): bigint =>
  destinationActions(route.kind, route.steps[0].network).reduce(
    (total, action) => total + ethereumStepGas(action, route.steps[0].network),
    0n
  );

/** Transactions the user signs on both networks; undefined until the source calls are built. */
export const routeApprovals = (
  route: BridgeRoute,
  source: { calls: number; isBatch: boolean }
): number | undefined =>
  source.calls === 0
    ? undefined
    : (source.isBatch ? 1 : source.calls) + destinationActions(route.kind, route.steps[0].network).length;

/** The ETH a step costs when the wallet's balance doesn't cover it; nothing while either read is missing. */
export const ethShortfall = ({
  balance,
  gas,
  feePerGas
}: {
  balance: bigint | undefined;
  gas: bigint;
  feePerGas: bigint | undefined;
}): bigint | undefined => {
  if (balance === undefined || feePerGas === undefined) return undefined;
  const cost = gas * feePerGas;
  return balance < cost ? cost : undefined;
};
