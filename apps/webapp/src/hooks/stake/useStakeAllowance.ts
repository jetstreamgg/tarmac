import { UseTokenAllowanceResponse } from '../tokens/useTokenAllowance';
import { useSpenderAllowance } from '../shared/useSpenderAllowance';
import { skyAddress, stakeModuleAddress, usdsAddress } from '../generated';

export function useStakeSkyAllowance(address?: `0x${string}` | undefined): UseTokenAllowanceResponse {
  return useSpenderAllowance({ token: skyAddress, spender: stakeModuleAddress, address });
}

export function useStakeUsdsAllowance(address?: `0x${string}` | undefined): UseTokenAllowanceResponse {
  return useSpenderAllowance({ token: usdsAddress, spender: stakeModuleAddress, address });
}
