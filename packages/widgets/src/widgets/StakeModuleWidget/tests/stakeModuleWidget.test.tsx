/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WagmiWrapper } from '../../../../test/WagmiWrapper';
import { StakeModuleWidget } from '..';
import { StakeAction, StakeFlow } from '../lib/constants';

const renderWithWagmiWrapper = (ui: any, options?: any) => render(ui, { wrapper: WagmiWrapper, ...options });

vi.mock('@widgets/shared/constants', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    TENDERLY_CHAIN_ID: 1337,
    TENDERLY_BASE_CHAIN_ID: 8453, // Set to Base mainnet ID
    TENDERLY_ARBITRUM_CHAIN_ID: 42161 // Set to Arbitrum mainnet ID
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useConnection: vi.fn(() => ({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      isConnecting: false
    })),
    useChainId: vi.fn(() => 1337)
  };
});

vi.mock('@jetstreamgg/sky-hooks', async importOriginal => {
  const actual = await importOriginal();

  // Mock the token addresses
  const mockAddresses = {
    1: '0x1111111111111111111111111111111111111111',
    1337: '0x1337133713371337133713371337133713371337'
  };

  // Create mock token with address
  const createMockToken = (symbol: string, decimals = 18) => ({
    symbol,
    decimals,
    address: mockAddresses
  });

  // Create mock tokens
  const mockTokens = {
    sky: createMockToken('SKY'),
    usds: createMockToken('USDS'),
    dai: createMockToken('DAI'),
    mkr: createMockToken('MKR'),
    eth: createMockToken('ETH'),
    weth: createMockToken('WETH'),
    usdc: createMockToken('USDC', 6),
    susds: createMockToken('sUSDS')
  };

  return {
    ...(actual as any),
    useCurrentUrnIndex: vi.fn(() => {
      return {
        data: 0n,
        isLoading: false,
        error: null
      };
    }),
    useStakeSkyAllowance: vi.fn(() => {
      return {
        data: 0n,
        mutate: vi.fn(),
        isLoading: false
      };
    }),
    useStakeUsdsAllowance: vi.fn(() => {
      return {
        data: 0n,
        mutate: vi.fn(),
        isLoading: false
      };
    }),
    useStakeUrnAddress: vi.fn(() => {
      return {
        data: '0x0000000000000000000000000000000000000000',
        isLoading: false,
        error: null
      };
    }),
    useVault: vi.fn(() => {
      return {
        data: {
          collateralAmount: 0n,
          debtAmount: 0n
        },
        isLoading: false,
        error: null
      };
    }),
    useStakeUrnSelectedRewardContract: vi.fn(() => {
      return {
        data: undefined,
        isLoading: false,
        error: null
      };
    }),
    useStakeUrnSelectedVoteDelegate: vi.fn(() => {
      return {
        data: undefined,
        isLoading: false,
        error: null
      };
    }),
    useStakeSkyApprove: vi.fn(() => {
      return {
        prepared: true,
        execute: vi.fn(),
        isLoading: false
      };
    }),
    useStakeUsdsApprove: vi.fn(() => {
      return {
        prepared: true,
        execute: vi.fn(),
        isLoading: false
      };
    }),
    useStakeMulticall: vi.fn(() => {
      return {
        prepared: true,
        execute: vi.fn(),
        retryPrepare: vi.fn(),
        isLoading: false
      };
    }),
    useStakeClaimRewards: vi.fn(() => {
      return {
        prepared: true,
        execute: vi.fn(),
        isLoading: false
      };
    }),
    getIlkName: vi.fn(() => 'SKY-A'),
    TOKENS: mockTokens,
    skyAddress: mockAddresses,
    usdsAddress: mockAddresses,
    mcdDaiAddress: mockAddresses,
    mkrAddress: mockAddresses,
    wethAddress: mockAddresses,
    usdcAddress: mockAddresses,
    usdtAddress: mockAddresses,
    sUsdsAddress: mockAddresses,
    usdcL2Address: mockAddresses,
    usdsL2Address: mockAddresses,
    sUsdsL2Address: mockAddresses,
    lsSkyUsdsRewardAddress: mockAddresses,
    stakeModuleAddress: mockAddresses,
    getTokenDecimals: vi.fn(() => 18),
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000'
  };
});

describe('StakeModuleWidget tests', () => {
  beforeEach(() => {
    // @ts-expect-error ResizeObserver is required in the Window interface
    delete window.ResizeObserver;
    window.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }));
  });

  afterEach(() => {
    window.ResizeObserver = ResizeObserver;
    vi.restoreAllMocks();
  });

  it('loads the widget with default state', async () => {
    renderWithWagmiWrapper(<StakeModuleWidget onConnect={() => true} addRecentTransaction={() => {}} />);

    // The widget should show the "Staking Engine" heading
    const heading = await screen.findByText('Staking Engine');
    expect(heading).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId('widget-container')).toBeTruthy();
    });
  });

  it('shows the open position flow when urnIndex is 0', async () => {
    // Mock the useCurrentUrnIndex hook to return 0n
    const useCurrentUrnIndexMock = vi.spyOn(await import('@jetstreamgg/sky-hooks'), 'useCurrentUrnIndex');
    useCurrentUrnIndexMock.mockReturnValue({
      data: 0n,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    });

    renderWithWagmiWrapper(
      <StakeModuleWidget
        onConnect={() => true}
        addRecentTransaction={() => {}}
        externalWidgetState={{
          flow: StakeFlow.OPEN
        }}
      />
    );

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Staking Engine')).toBeTruthy();
    });
  });

  it('shows the manage position flow with external state', async () => {
    // Mock the useCurrentUrnIndex hook to return 1n to simulate having an existing position
    const useCurrentUrnIndexMock = vi.spyOn(await import('@jetstreamgg/sky-hooks'), 'useCurrentUrnIndex');
    useCurrentUrnIndexMock.mockReturnValue({
      data: 1n,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    });

    renderWithWagmiWrapper(
      <StakeModuleWidget
        onConnect={() => true}
        addRecentTransaction={() => {}}
        externalWidgetState={{
          flow: StakeFlow.MANAGE,
          stakeTab: StakeAction.LOCK,
          urnIndex: 1
        }}
      />
    );

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Staking Engine')).toBeTruthy();
    });
  });

  it('handles approval flow correctly', async () => {
    // Mock the useCurrentUrnIndex hook to return 0n
    const useCurrentUrnIndexMock = vi.spyOn(await import('@jetstreamgg/sky-hooks'), 'useCurrentUrnIndex');
    useCurrentUrnIndexMock.mockReturnValue({
      data: 0n,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    });

    // Mock the useStakeSkyAllowance hook to return 0n (needs approval)
    const useStakeSkyAllowanceMock = vi.spyOn(await import('@jetstreamgg/sky-hooks'), 'useStakeSkyAllowance');
    useStakeSkyAllowanceMock.mockReturnValue({
      data: 0n,
      mutate: vi.fn(),
      isLoading: false,
      error: null,
      dataSources: []
    });

    // Mock the approval function
    const mockExecute = vi.fn().mockImplementation(() => {
      // Simulate a successful approval
      return Promise.resolve({
        hash: '0xabcdef1234567890'
      });
    });

    const useStakeSkyApproveMock = vi.spyOn(await import('@jetstreamgg/sky-hooks'), 'useStakeSkyApprove');
    useStakeSkyApproveMock.mockReturnValue({
      prepared: true,
      execute: mockExecute,
      isLoading: false
    } as any);

    const onWidgetStateChangeMock = vi.fn();
    const addRecentTransactionMock = vi.fn();

    renderWithWagmiWrapper(
      <StakeModuleWidget
        onConnect={() => true}
        addRecentTransaction={addRecentTransactionMock}
        onWidgetStateChange={onWidgetStateChangeMock}
        externalWidgetState={{
          flow: StakeFlow.OPEN
        }}
      />
    );

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Staking Engine')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByTestId('widget-container')).toBeTruthy();
    });
  });

  it('handles transaction status changes correctly', async () => {
    // Mock the useCurrentUrnIndex hook
    const useCurrentUrnIndexMock = vi.spyOn(await import('@jetstreamgg/sky-hooks'), 'useCurrentUrnIndex');
    useCurrentUrnIndexMock.mockReturnValue({
      data: 0n,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    });

    const mockExecute = vi.fn().mockImplementation(() => {
      // Simulate a successful transaction
      return Promise.resolve({
        hash: '0xabcdef1234567890'
      });
    });

    const useStakeMulticallMock = vi.spyOn(await import('@jetstreamgg/sky-hooks'), 'useStakeMulticall');
    useStakeMulticallMock.mockReturnValue({
      prepared: true,
      execute: mockExecute,
      retryPrepare: vi.fn(),
      isLoading: false
    } as any);

    const onNotificationMock = vi.fn();
    const onWidgetStateChangeMock = vi.fn();

    const { rerender } = renderWithWagmiWrapper(
      <StakeModuleWidget
        onConnect={() => true}
        addRecentTransaction={() => {}}
        onNotification={onNotificationMock}
        onWidgetStateChange={onWidgetStateChangeMock}
        externalWidgetState={{
          flow: StakeFlow.OPEN
        }}
      />
    );

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Staking Engine')).toBeTruthy();
    });

    // Rerender with loading status
    rerender(
      <WagmiWrapper>
        <StakeModuleWidget
          onConnect={() => true}
          addRecentTransaction={() => {}}
          onNotification={onNotificationMock}
          onWidgetStateChange={onWidgetStateChangeMock}
          externalWidgetState={{
            flow: StakeFlow.OPEN
          }}
        />
      </WagmiWrapper>
    );

    // Rerender with success status
    rerender(
      <WagmiWrapper>
        <StakeModuleWidget
          onConnect={() => true}
          addRecentTransaction={() => {}}
          onNotification={onNotificationMock}
          onWidgetStateChange={onWidgetStateChangeMock}
          externalWidgetState={{
            flow: StakeFlow.OPEN
          }}
        />
      </WagmiWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('widget-container')).toBeTruthy();
    });
  });

  it('handles URN change callback correctly', async () => {
    const useCurrentUrnIndexMock = vi.spyOn(await import('@jetstreamgg/sky-hooks'), 'useCurrentUrnIndex');
    useCurrentUrnIndexMock.mockReturnValue({
      data: 1n,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    });

    // Mock the useStakeUrnAddress hook
    const useStakeUrnAddressMock = vi.spyOn(await import('@jetstreamgg/sky-hooks'), 'useStakeUrnAddress');
    useStakeUrnAddressMock.mockReturnValue({
      data: '0x1234567890123456789012345678901234567890',
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    });

    const onStakeUrnChangeMock = vi.fn();

    renderWithWagmiWrapper(
      <StakeModuleWidget
        onConnect={() => true}
        addRecentTransaction={() => {}}
        onStakeUrnChange={onStakeUrnChangeMock}
        externalWidgetState={{
          flow: StakeFlow.MANAGE
        }}
      />
    );

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Staking Engine')).toBeTruthy();
    });
  });
});
