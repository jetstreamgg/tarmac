import { destinationActions } from './resolveRoute';
import type { BridgeRoute, PendingBridgeStepAction } from './types';

// Upper estimates of each Ethereum step's gas, for the route picker's fee; to be measured on forks.
const CCTP_CLAIM_GAS = 180_000n;
const OP_STACK_PROVE_GAS = 450_000n;
const OP_STACK_FINALIZE_GAS = 350_000n;
const ARBITRUM_EXECUTE_GAS = 250_000n;

const stepGas = (action: PendingBridgeStepAction, route: BridgeRoute): bigint => {
  if (action === 'claim') return CCTP_CLAIM_GAS;
  if (action === 'prove') return OP_STACK_PROVE_GAS;
  if (action === 'finalize')
    return route.steps[0].network === 'arbitrum' ? ARBITRUM_EXECUTE_GAS : OP_STACK_FINALIZE_GAS;
  return 0n;
};

/** Gas the user spends on the destination after the source send: CCTP's claim, a withdrawal's prove and finalize. */
export const destinationGas = (route: BridgeRoute): bigint =>
  destinationActions(route.kind, route.steps[0].network).reduce(
    (total, action) => total + stepGas(action, route),
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
