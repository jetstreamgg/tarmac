import { usdsAddress } from '../generated';
import { WriteHook, WriteHookParams } from '../hooks';
import { useSpenderApprove } from '../shared/useSpenderApprove';
import { sUsdsAddress } from './useReadSavingsUsds';

export function useSavingsApprove(params: WriteHookParams & { amount: bigint }): WriteHook {
  return useSpenderApprove({ ...params, token: usdsAddress, spender: sUsdsAddress });
}
