import { WriteHook, WriteHookParams } from '../hooks';
import { stakeModuleAddress, skyAddress, usdsAddress } from '../generated';
import { useSpenderApprove } from '../shared/useSpenderApprove';
import { math } from '@/utils';

export function useStakeSkyApprove(params: WriteHookParams & { amount: bigint }): WriteHook {
  return useSpenderApprove({ ...params, token: skyAddress, spender: stakeModuleAddress });
}

export function useStakeUsdsApprove({
  amount,
  roundUp = false,
  ...params
}: WriteHookParams & {
  amount: bigint;
  roundUp?: boolean;
}): WriteHook {
  return useSpenderApprove({
    ...params,
    token: usdsAddress,
    spender: stakeModuleAddress,
    amount: roundUp && amount > 0n ? math.removeDecimalPartOfWad(amount) + 1000000000000000000n : amount // round up 1 usds
  });
}
