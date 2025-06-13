/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WagmiWrapper } from '../../../../test/WagmiWrapper';
import { RewardsWidget } from '..';
import { TOKENS } from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@widgets/shared/constants';

const renderWithWagmiWrapper = (ui: any, options?: any) => render(ui, { wrapper: WagmiWrapper, ...options });

vi.mock('@jetstreamgg/sky-hooks', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useAvailableTokenRewards: vi.fn(() => {
      return [
        {
          contractAddress: '0x123',
          name: 'Sky Token Rewards',
          supplyToken: TOKENS.usds,
          rewardToken: TOKENS.sky,
          chainId: TENDERLY_CHAIN_ID,
          description: 'Sky Token Rewards',
          externalLink: 'https://subdao.network',
          logo: 'https://via.placeholder.com/400x400/04d19a/ffffff?text=Subdao'
        }
      ];
    }),
    useChainId: vi.fn(() => {
      return 1337;
    }),
    useRewardContractInfo: vi.fn(() => {
      return {
        data: {
          totalSupplied: 1000000n,
          totalRewardsClaimed: 500000n,
          supplyInstances: [
            { id: '1', blockTimestamp: 1622548800, transactionHash: '0xabc', amount: 100000n },
            { id: '2', blockTimestamp: 1625130800, transactionHash: '0xdef', amount: 200000n }
          ],
          withdrawals: [{ id: '3', blockTimestamp: 1627819200, transactionHash: '0xghi', amount: 50000n }],
          rewardClaims: [{ id: '4', blockTimestamp: 1630507600, transactionHash: '0xjkl', amount: 150000n }],
          tvl: [{ id: '5', blockTimestamp: 1633196000, transactionHash: '0xmnop', amount: 750000n }],
          suppliers: [{ user: '0x123' }, { user: '0x456' }]
        },
        isLoading: false,
        error: null
      };
    }),
    useRewardsRate: vi.fn(() => {
      return { data: { formatted: '100%' }, isLoading: false, error: null };
    }),
    useRewardsSuppliedBalance: vi.fn(() => {
      return { data: 10n, mutate: vi.fn() };
    }),
    useRewardsRewardsBalance: vi.fn(() => {
      return { mutate: vi.fn() };
    }),
    useTokenAllowance: vi.fn(() => {
      return { data: 10n, mutate: vi.fn(), isLoading: false };
    }),
    useRewardsSupply: vi.fn(() => {
      return { retryPrepare: vi.fn(), execute: vi.fn() };
    }),
    useApproveToken: vi.fn(() => {
      return { execute: vi.fn() };
    }),
    useRewardsWithdraw: vi.fn(() => {
      return { execute: vi.fn() };
    }),
    useRewardsClaim: vi.fn(() => {
      return { execute: vi.fn() };
    }),
    useTokenBalance: vi.fn(() => {
      return { data: { value: 10n }, refetch: vi.fn() };
    }),
    wethAddress: vi.fn(() => {
      return {
        1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        1337: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'
      };
    }),
    usdcAddress: vi.fn(() => {
      return {
        1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        1337: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'
      };
    }),
    usdtAddress: vi.fn(() => {
      return {
        1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        1337: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'
      };
    }),
    mcdDaiAddress: vi.fn(() => {
      return {
        1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        1337: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'
      };
    }),
    usdsAddress: vi.fn(() => {
      return {
        1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        1337: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'
      };
    }),
    wethSepoliaAddress: vi.fn(() => {
      return {
        11155111: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
      };
    }),
    usdcSepoliaAddress: vi.fn(() => {
      return {
        11155111: '0xbe72E441BF55620febc26715db68d3494213D8Cb'
      };
    }),
    usdtSepoliaAddress: vi.fn(() => {
      return {
        11155111: '0x58Eb19eF91e8A6327FEd391b51aE1887b833cc91'
      };
    }),
    mcdDaiSepoliaAddress: vi.fn(() => {
      return {
        11155111: '0xB4F1737Af37711e9A5890D9510c9bB60e170CB0D'
      };
    })
  };
});

describe('Rewards widget tests', () => {
  // We need to mock ResizeObserver as it's being used by the chakra slider
  // https://github.com/maslianok/react-resize-detector#testing-with-enzyme-and-jest
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
  it('loads data when wrapped in wagmi config', async () => {
    renderWithWagmiWrapper(<RewardsWidget onConnect={() => true} />);

    const item = await screen.findByText('Sky Token Rewards');

    expect(item).toBeTruthy();
  });
});
