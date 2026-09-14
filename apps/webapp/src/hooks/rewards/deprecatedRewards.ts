import { usdsSkyRewardAddress } from '../generated';

type ChainAddresses = { [chainId: number]: `0x${string}` };

/**
 * List of deprecated reward contract addresses.
 * These rewards should not be offered to new users, but existing
 * positions with these rewards can still claim and withdraw.
 */
export const DEPRECATED_REWARD_CONTRACTS: ChainAddresses[] = [usdsSkyRewardAddress];

/**
 * Checks if a given reward contract address is deprecated.
 *
 * @param address - The reward contract address to check
 * @param chainId - The chain ID to check against
 * @returns true if the address is a deprecated reward contract
 */
export function isDeprecatedRewardContract(address: string, chainId: number): boolean {
  return DEPRECATED_REWARD_CONTRACTS.some(
    contractAddresses =>
      contractAddresses[chainId as keyof typeof contractAddresses]?.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Filters out deprecated reward contracts from a list.
 * Optionally keeps specific addresses visible (for existing positions).
 *
 * @param contracts - Array of contracts with contractAddress property
 * @param chainId - The chain ID to filter for
 * @param keepAddresses - Optional addresses to always keep in the list (e.g., user's current positions)
 * @returns Filtered array without deprecated rewards (unless keepAddresses matches)
 */
export function filterDeprecatedRewardContracts<T extends { contractAddress: string }>(
  contracts: T[],
  chainId: number,
  keepAddresses?: string[]
): T[] {
  return contracts.filter(contract => {
    // Always keep the user's existing positions visible
    if (keepAddresses?.some(addr => addr.toLowerCase() === contract.contractAddress.toLowerCase())) {
      return true;
    }
    return !isDeprecatedRewardContract(contract.contractAddress, chainId);
  });
}
