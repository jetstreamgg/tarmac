import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { useCurrentUrnIndex } from '../stake/useCurrentUrnIndex';
import { useUrnAddress } from '../stake/useUrnAddress';
import { useVault } from '../vaults/useVault';
import { useNextMigrationUrnIndex } from './useNextMigrationUrnIndex';
import { ZERO_ADDRESS } from '../constants';
import { SupportedCollateralTypes } from '../vaults/vaults.constants';
import { getIlkName } from '../vaults/helpers';
import { mainnet } from 'viem/chains';

// Mock wagmi hooks
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi');
  return {
    ...actual,
    useAccount: vi.fn(),
    useChainId: vi.fn(),
    useReadContract: vi.fn()
  };
});

// Mock internal hooks
vi.mock('../stake/useCurrentUrnIndex');
vi.mock('../stake/useUrnAddress');
vi.mock('../vaults/useVault');

// Mock constants if needed (e.g., stakeModuleAddress)
vi.mock('../generated', () => ({
  stakeModuleAbi: [], // Mock ABI if needed, otherwise empty array is fine
  stakeModuleAddress: { 1: '0xStakeModuleAddress' }, // Example address for chainId 1
  sealModuleAbi: [], // Mock ABI if needed, otherwise empty array is fine
  sealModuleAddress: { 1: '0xSealModuleAddress' } // Example address for chainId 1
}));

// Define types for easier mocking
type MockUseReadContractConfig = {
  functionName: 'urnOwners' | 'urnAuctions';
  args: readonly [`0x${string}`] | readonly []; // Adjust based on actual usage
  chainId: number;
  address: `0x${string}`;
  query?: { enabled?: boolean };
};

type MockReadContractResult = {
  data: unknown | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: ReturnType<typeof vi.fn>;
};

describe('useNextMigrationUrnIndex - Determining the next URN for migration', () => {
  // Default mock implementations
  const mockUseAccount = useAccount as Mock;
  const mockUseChainId = useChainId as Mock;
  const mockUseReadContract = useReadContract as Mock;
  const mockUseCurrentUrnIndex = useCurrentUrnIndex as Mock;
  const mockUseUrnAddress = useUrnAddress as Mock;
  const mockUseVault = useVault as Mock;

  // Mock return values - these will be customized in beforeEach/tests
  let mockUrnOwnersReturn: MockReadContractResult;
  let mockUrnAuctionsReturn: MockReadContractResult;
  let mockCurrentUrnIndexReturn: ReturnType<typeof useCurrentUrnIndex>;
  let mockUrnAddressReturn: ReturnType<typeof useUrnAddress>;
  let mockVaultReturn: ReturnType<typeof useVault>;

  const userAddress = '0xUserAddress';
  const candidateUrnAddr = '0xCandidateUrnAddress';
  const otherUrnAddr = '0xOtherUrnAddress';
  const chainId = 1;
  const ilkName = getIlkName(mainnet.id, 2);

  beforeEach(() => {
    vi.clearAllMocks();

    // --- Default Happy Path Mock Values ---
    mockUseAccount.mockReturnValue({ address: userAddress });
    mockUseChainId.mockReturnValue(chainId);

    // Default: Current index is 2, so candidate is 1
    mockCurrentUrnIndexReturn = {
      data: 2n,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    };
    mockUseCurrentUrnIndex.mockReturnValue(mockCurrentUrnIndexReturn);

    // Default: Candidate URN Index 1 maps to a valid address
    mockUrnAddressReturn = {
      data: candidateUrnAddr, // Valid address for index 1
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    };
    // Default mock for candidateUrnIndex = 1
    mockUseUrnAddress.mockImplementation((index: bigint) => {
      if (index === 1n) {
        return mockUrnAddressReturn;
      }
      // Return undefined for other indices by default
      return { data: undefined, isLoading: false, error: null, mutate: vi.fn(), dataSources: [] };
    });

    // Default: Candidate URN is owned by the user
    mockUrnOwnersReturn = {
      data: userAddress, // Matches mockUseAccount address
      isLoading: false,
      error: null,
      refetch: vi.fn()
    };

    // Default: Candidate URN is not auctioned
    mockUrnAuctionsReturn = {
      data: 0n, // Not auctioned
      isLoading: false,
      error: null,
      refetch: vi.fn()
    };

    // Default: Vault for candidate URN is empty
    mockVaultReturn = {
      data: {
        debtValue: 0n,
        collateralAmount: 0n,
        collateralType: ilkName
        // Add other necessary fields from VaultData if the hook uses them
      },
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    };
    // Default mock for candidateUrnAddr
    mockUseVault.mockImplementation(
      (urnAddress: `0x${string}` | undefined, collateralType: SupportedCollateralTypes) => {
        if (urnAddress === candidateUrnAddr && collateralType === ilkName) {
          return mockVaultReturn;
        }
        // Return default/empty for others
        return { data: undefined, isLoading: false, error: null, mutate: vi.fn(), dataSources: [] };
      }
    );

    // Mock useReadContract logic based on functionName
    mockUseReadContract.mockImplementation((config: MockUseReadContractConfig) => {
      // Disable query if enabled is false or address is missing/zero
      if (
        config.query?.enabled === false ||
        !config.args ||
        !config.args[0] ||
        config.args[0] === ZERO_ADDRESS
      ) {
        return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
      }

      if (config.functionName === 'urnOwners' && config.args[0] === candidateUrnAddr) {
        return mockUrnOwnersReturn;
      }
      if (config.functionName === 'urnAuctions' && config.args[0] === candidateUrnAddr) {
        return mockUrnAuctionsReturn;
      }
      // Fallback for unexpected calls
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
  });

  // --- Test Cases ---

  it('should return candidateUrnIndex when candidate URN is valid for migration (owned, empty, not auctioned)', () => {
    // Arrange (Defaults are already set for this case in beforeEach)
    const { result } = renderHook(() => useNextMigrationUrnIndex());

    // Assert
    expect(result.current.data).toBe(1n); // candidateUrnIndex (2n - 1n)
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should return 0 when currentUrnIndex is 0', () => {
    // Arrange
    mockCurrentUrnIndexReturn.data = 0n;
    mockUseCurrentUrnIndex.mockReturnValue(mockCurrentUrnIndexReturn);
    // UrnAddress for index 0 shouldn't matter but let's mock it
    mockUseUrnAddress.mockImplementation((index: bigint) => {
      if (index === 0n) {
        return { data: ZERO_ADDRESS, isLoading: false, error: null, mutate: vi.fn(), dataSources: [] };
      }
      return { data: undefined, isLoading: false, error: null, mutate: vi.fn(), dataSources: [] };
    });

    const { result } = renderHook(() => useNextMigrationUrnIndex());

    // Assert
    expect(result.current.data).toBe(0n); // currentUrnIndex
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should return currentUrnIndex when candidate URN address resolves to ZERO_ADDRESS', () => {
    // Arrange
    mockUrnAddressReturn.data = ZERO_ADDRESS;
    mockUseUrnAddress.mockImplementation((index: bigint) => {
      if (index === 1n) {
        return mockUrnAddressReturn;
      }
      return { data: undefined, isLoading: false, error: null, mutate: vi.fn(), dataSources: [] };
    });

    const { result } = renderHook(() => useNextMigrationUrnIndex());

    // Assert
    expect(result.current.data).toBe(2n); // currentUrnIndex
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should return currentUrnIndex when candidate URN address resolves to undefined', () => {
    // Arrange
    mockUrnAddressReturn.data = undefined;
    mockUseUrnAddress.mockImplementation((index: bigint) => {
      if (index === 1n) {
        return mockUrnAddressReturn;
      }
      return { data: undefined, isLoading: false, error: null, mutate: vi.fn(), dataSources: [] };
    });

    const { result } = renderHook(() => useNextMigrationUrnIndex());

    // Assert
    expect(result.current.data).toBe(2n); // currentUrnIndex
    expect(result.current.isLoading).toBe(false); // Should be false as useUrnAddress finished loading
    expect(result.current.error).toBe(null);
  });

  it('should return currentUrnIndex when candidate URN is owned by another address', () => {
    // Arrange
    mockUrnOwnersReturn.data = otherUrnAddr; // Different address

    const { result } = renderHook(() => useNextMigrationUrnIndex());

    // Assert
    expect(result.current.data).toBe(2n); // currentUrnIndex
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);

    // Check that read contracts weren't enabled without an address
    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'urnOwners',
        args: [candidateUrnAddr]
      })
    );
  });

  it('should return currentUrnIndex when candidate URN has debt', () => {
    // Arrange
    mockVaultReturn.data = {
      ...mockVaultReturn.data,
      collateralType: ilkName,
      debtValue: 100n
    };

    const { result } = renderHook(() => useNextMigrationUrnIndex());

    // Assert
    expect(result.current.data).toBe(2n); // currentUrnIndex
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should return currentUrnIndex when candidate URN has collateral', () => {
    // Arrange
    mockVaultReturn.data = {
      ...mockVaultReturn.data,
      collateralType: ilkName,
      collateralAmount: 50n
    };

    const { result } = renderHook(() => useNextMigrationUrnIndex());

    // Assert
    expect(result.current.data).toBe(2n); // currentUrnIndex
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should return currentUrnIndex when candidate URN is under auction', () => {
    // Arrange
    mockUrnAuctionsReturn.data = 1n; // Auction exists

    const { result } = renderHook(() => useNextMigrationUrnIndex());

    // Assert
    expect(result.current.data).toBe(2n); // currentUrnIndex
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);

    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'urnAuctions',
        args: [candidateUrnAddr]
      })
    );
  });
});
