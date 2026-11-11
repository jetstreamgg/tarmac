import { useFeePerGas, useTokenBalance } from '@/hooks';
import { ethereumStepGas, ethShortfall } from '../model/routeCosts';
import type { PendingBridge } from '../model/types';

/**
 * The ETH a withdrawal's ready prove or finalize costs on Ethereum when the
 * wallet's balance can't pay it; undefined otherwise and while either is read.
 */
export function useWithdrawalEthShortfall(
  bridge: PendingBridge,
  account: string | undefined,
  ethereumChainId: number
): bigint | undefined {
  const step =
    bridge.routeKind === 'native' &&
    bridge.to === 'ethereum' &&
    bridge.status === 'ready' &&
    (bridge.nextAction === 'prove' || bridge.nextAction === 'finalize')
      ? bridge.nextAction
      : undefined;
  const enabled = step !== undefined && account !== undefined;
  const { data: balance } = useTokenBalance({
    address: account as `0x${string}` | undefined,
    chainId: ethereumChainId,
    isNative: true,
    enabled
  });
  const { data: feePerGas } = useFeePerGas(ethereumChainId, enabled);
  return enabled && step
    ? ethShortfall({ balance: balance?.value, gas: ethereumStepGas(step, bridge.from), feePerGas })
    : undefined;
}
