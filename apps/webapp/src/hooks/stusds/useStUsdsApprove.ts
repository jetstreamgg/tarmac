import { usdsAddress, stUsdsAddress } from '../generated';
import { WriteHook, WriteHookParams } from '../hooks';
import { useSpenderApprove } from '../shared/useSpenderApprove';

export function useStUsdsApprove(params: WriteHookParams & { amount: bigint }): WriteHook {
  return useSpenderApprove({ ...params, token: usdsAddress, spender: stUsdsAddress });
}
