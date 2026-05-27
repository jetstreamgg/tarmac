import { PublicClient } from 'viem';
import { MORPHO_API_URL, MORPHO_VAULT_V1_ADAPTER_ABI, VAULT_V1_BASIC_DATA_QUERY } from './constants';
import type { MorphoVaultV1BasicDataApiResponse } from './morpho';

/**
 * Read the underlying V1 vault address from a MorphoVaultV1Adapter contract.
 */
export async function readV1VaultFromAdapter(
  publicClient: PublicClient,
  adapterAddress: `0x${string}`
): Promise<`0x${string}` | null> {
  try {
    const v1VaultAddress = await publicClient.readContract({
      address: adapterAddress,
      abi: MORPHO_VAULT_V1_ADAPTER_ABI,
      functionName: 'morphoVaultV1'
    });
    return v1VaultAddress as `0x${string}`;
  } catch (error) {
    console.error(`Failed to read V1 vault from adapter ${adapterAddress}:`, error);
    return null;
  }
}

/**
 * Fetch V1 vault basic data (name, symbol, APY).
 */
export async function fetchV1VaultBasicData(
  vaultAddress: string,
  chainId: number
): Promise<MorphoVaultV1BasicDataApiResponse['data']['vaultByAddress']> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: VAULT_V1_BASIC_DATA_QUERY,
      variables: {
        address: vaultAddress.toLowerCase(),
        chainId
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const result: MorphoVaultV1BasicDataApiResponse = await response.json();
  return result.data.vaultByAddress;
}
