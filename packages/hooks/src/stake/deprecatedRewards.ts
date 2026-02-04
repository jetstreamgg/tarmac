import { lsSkyUsdsRewardAddress, lsSkySpkRewardAddress } from '../generated';

type ChainAddresses = { [chainId: number]: `0x${string}` };

/**
 * List of deprecated stake reward contract addresses.
 * These rewards should not be offered to new positions, but existing
 * positions with these rewards can still claim and change rewards.
 */
export const DEPRECATED_STAKE_REWARDS: ChainAddresses[] = [lsSkyUsdsRewardAddress, lsSkySpkRewardAddress];

/**
 * Checks if a given reward contract address is deprecated.
 *
 * @param address - The reward contract address to check
 * @param chainId - The chain ID to check against
 * @returns true if the address is a deprecated reward contract
 */
export function isDeprecatedStakeReward(address: `0x${string}`, chainId: number): boolean {
  return DEPRECATED_STAKE_REWARDS.some(addrMap => addrMap[chainId]?.toLowerCase() === address.toLowerCase());
}

/**
 * Filters out deprecated reward contracts from a list.
 * Optionally keeps a specific address visible (for existing positions).
 *
 * @param contracts - Array of contracts with contractAddress property
 * @param chainId - The chain ID to filter for
 * @param keepAddress - Optional address to always keep in the list (e.g., user's current selection)
 * @returns Filtered array without deprecated rewards (unless keepAddress matches)
 */
export function filterDeprecatedRewards<T extends { contractAddress: `0x${string}` }>(
  contracts: T[],
  chainId: number,
  keepAddress?: `0x${string}`
): T[] {
  return contracts.filter(({ contractAddress }) => {
    // Always keep the user's current selection visible
    if (keepAddress?.toLowerCase() === contractAddress.toLowerCase()) {
      return true;
    }
    return !isDeprecatedStakeReward(contractAddress, chainId);
  });
}
