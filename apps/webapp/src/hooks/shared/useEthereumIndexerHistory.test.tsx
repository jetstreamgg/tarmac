/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { HISTORY_QUERY_LIMIT, ModuleEnum, TransactionTypeEnum } from '../constants';

// Reconstruct the interpolated query string so assertions can inspect it.
vi.mock('graphql-request', () => ({
  request: vi.fn(),
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, str, i) => acc + str + (i < values.length ? String(values[i]) : ''), '')
}));

vi.mock('wagmi', () => ({
  useConnection: vi.fn(),
  useChainId: vi.fn()
}));

vi.mock('../rewards/useAvailableTokenRewardContracts', () => ({
  useAvailableTokenRewardContracts: vi.fn()
}));

import { request } from 'graphql-request';
import { useConnection, useChainId } from 'wagmi';
import { useAvailableTokenRewardContracts } from '../rewards/useAvailableTokenRewardContracts';
import { useEthereumIndexerHistory } from './useEthereumIndexerHistory';

const USER = '0x1111111111111111111111111111111111111111';
const REWARD_CONTRACT = '0x2222222222222222222222222222222222222222';

const EMPTY_RESPONSE = {
  savingsSupplies: [],
  savingsWithdraws: [],
  daiToUsdsUpgrades: [],
  usdsToDaiReverts: [],
  mkrToSkyUpgrades: [],
  mkrToSkyUpgradeV2S: [],
  skyToMkrReverts: [],
  stakingOpens: [],
  stakingSelectVoteDelegates: [],
  stakingSelectRewards: [],
  stakingLocks: [],
  stakingFrees: [],
  stakingDraws: [],
  stakingWipes: [],
  stakingGetRewards: [],
  stakingOnKicks: [],
  rewards: [],
  stusdsDeposits: [],
  stusdsWithdraws: [],
  curveTokenExchanges: [],
  susdtDeposits: [],
  susdtWithdraws: []
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useEthereumIndexerHistory — merged mainnet indexer document', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConnection).mockReturnValue({ address: USER } as unknown as ReturnType<
      typeof useConnection
    >);
    // Mainnet, non-testnet → chainId filter resolves to 1.
    vi.mocked(useChainId).mockReturnValue(1);
    vi.mocked(useAvailableTokenRewardContracts).mockReturnValue([
      { contractAddress: REWARD_CONTRACT }
    ] as unknown as ReturnType<typeof useAvailableTokenRewardContracts>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('queries every mainnet history family in one bounded document', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      ...EMPTY_RESPONSE,
      savingsSupplies: [{ assets: '100', blockTimestamp: '1700000300', transactionHash: '0xsupply' }],
      stakingLocks: [{ index: '0', wad: '50', blockTimestamp: '1700000200', transactionHash: '0xlock' }],
      rewards: [
        {
          address: REWARD_CONTRACT,
          supplyInstances: [{ blockTimestamp: '1700000100', transactionHash: '0xreward', amount: '10' }],
          withdrawals: [],
          rewardClaims: []
        }
      ]
    });

    const { result } = renderHook(() => useEthereumIndexerHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(request).toHaveBeenCalledTimes(1);

    const query = vi.mocked(request).mock.calls[0][1] as string;
    // One alias per family spot-checked; the address filter is _eq on lowercase.
    for (const alias of [
      'savingsSupplies: SavingsSupply',
      'daiToUsdsUpgrades: DaiToUsdsUpgrade',
      'stakingOpens: StakingOpen',
      'rewards: Reward',
      'stusdsDeposits: StusdsDeposit',
      'curveTokenExchanges: CurveTokenExchange',
      'susdtDeposits: SusdtDeposit'
    ]) {
      expect(query).toContain(alias);
    }
    expect(query).toContain(`owner: { _eq: "${USER}" }`);
    expect(query).toContain(`user: { _eq: "${USER}" }`);
    expect(query).not.toContain('_ilike');

    // Families merge into one list sorted desc.
    expect(result.current.data!.map(item => item.module)).toEqual([
      ModuleEnum.SAVINGS,
      ModuleEnum.STAKE,
      ModuleEnum.REWARDS
    ]);
    expect(result.current.data![0].type).toBe(TransactionTypeEnum.SUPPLY);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.nextCursor).toBeUndefined();
  });

  it('clamps at the densest family and pages older items in with _lt', async () => {
    const newest = 1700000000;
    const frontier = newest - HISTORY_QUERY_LIMIT + 1;
    vi.mocked(request).mockResolvedValueOnce({
      ...EMPTY_RESPONSE,
      // Savings hits the limit → its oldest row is the page boundary.
      savingsSupplies: Array.from({ length: HISTORY_QUERY_LIMIT }, (_, i) => ({
        assets: '100',
        blockTimestamp: String(newest - i),
        transactionHash: `0xsupply${i}`
      })),
      // A stake event older than the boundary is withheld from page 1.
      stakingLocks: [
        { index: '0', wad: '50', blockTimestamp: String(frontier - 10), transactionHash: '0xoldlock' }
      ]
    });
    vi.mocked(request).mockResolvedValueOnce({
      ...EMPTY_RESPONSE,
      stakingLocks: [
        { index: '0', wad: '50', blockTimestamp: String(frontier - 10), transactionHash: '0xoldlock' }
      ]
    });

    const { result } = renderHook(() => useEthereumIndexerHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(HISTORY_QUERY_LIMIT);
    expect(result.current.data!.some(item => item.transactionHash === '0xoldlock')).toBe(false);
    expect(result.current.nextCursor).toBe(frontier);
    expect(result.current.hasNextPage).toBe(true);

    result.current.fetchNextPage();
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));

    const secondQuery = vi.mocked(request).mock.calls[1][1] as string;
    expect(secondQuery).toContain(`blockTimestamp: { _lt: "${frontier}" }`);
    // The withheld stake event lands appended after the page-1 items.
    expect(result.current.data).toHaveLength(HISTORY_QUERY_LIMIT + 1);
    expect(result.current.data![HISTORY_QUERY_LIMIT].transactionHash).toBe('0xoldlock');
    expect(result.current.nextCursor).toBeUndefined();
  });
});
