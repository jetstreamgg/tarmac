import { usdsAddress, stUsdsAddress } from '../generated';
import { UseTokenAllowanceResponse } from '../tokens/useTokenAllowance';
import { useSpenderAllowance } from '../shared/useSpenderAllowance';

export function useStUsdsAllowance(address?: `0x${string}`): UseTokenAllowanceResponse {
  return useSpenderAllowance({ token: usdsAddress, spender: stUsdsAddress, address });
}
