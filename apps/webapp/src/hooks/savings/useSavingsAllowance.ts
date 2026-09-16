import { usdsAddress } from '../generated';
import { UseTokenAllowanceResponse } from '../tokens/useTokenAllowance';
import { useSpenderAllowance } from '../shared/useSpenderAllowance';
import { sUsdsAddress } from './useReadSavingsUsds';

export function useSavingsAllowance(address?: `0x${string}`): UseTokenAllowanceResponse {
  return useSpenderAllowance({ token: usdsAddress, spender: sUsdsAddress, address });
}
