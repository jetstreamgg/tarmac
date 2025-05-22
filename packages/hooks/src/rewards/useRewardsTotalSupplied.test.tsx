import { describe, expect, it, afterAll } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { GAS, WagmiWrapper } from '../../test';
import { useRewardsTotalSupplied } from './useRewardsTotalSupplied';
import { usdsAddress, usdsSkyRewardAddress } from '../generated';
import { TENDERLY_CHAIN_ID } from '../constants';
import { useApproveToken } from '../tokens/useApproveToken';
import { parseEther } from 'viem';
import { useRewardsSupply } from './useRewardsSupply';
import { waitForPreparedExecuteAndMine } from '../../test/helpers';

describe('useRewardsTotalSupplied hook', async () => {
  it('Should return data about the total supplied', async () => {
    const { result: resultTotalSupplied } = renderHook(
      () =>
        useRewardsTotalSupplied({
          chainId: TENDERLY_CHAIN_ID,
          contractAddress: usdsSkyRewardAddress[TENDERLY_CHAIN_ID]
        }),
      {
        wrapper: WagmiWrapper
      }
    );
    await waitFor(
      () => {
        expect(resultTotalSupplied.current.data).toBeDefined();
        return;
      },
      { timeout: 5000 }
    );
    const totalSuppliedBefore = resultTotalSupplied.current.data;

    // Approve token spending in the reward contract
    const { result: resultApprove } = renderHook(
      () =>
        useApproveToken({
          contractAddress: usdsAddress[TENDERLY_CHAIN_ID],
          spender: usdsSkyRewardAddress[TENDERLY_CHAIN_ID],
          amount: parseEther('100'),
          gas: GAS
        }),

      {
        wrapper: WagmiWrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApprove);

    const { result: resultSupply } = renderHook(
      () =>
        useRewardsSupply({
          contractAddress: usdsSkyRewardAddress[TENDERLY_CHAIN_ID],
          supplyTokenAddress: usdsAddress[TENDERLY_CHAIN_ID],
          amount: parseEther('100'),
          enabled: true,
          gas: GAS
        }),
      {
        wrapper: WagmiWrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultSupply);

    resultTotalSupplied.current.mutate();
    await waitFor(
      () => {
        expect(resultTotalSupplied.current.data).not.equal(totalSuppliedBefore);
        return;
      },
      { timeout: 5000 }
    );
    const totalSuppliedAfter = resultTotalSupplied.current.data;

    await waitFor(
      () => {
        expect(totalSuppliedAfter).toBe((totalSuppliedBefore || 0n) + parseEther('100'));
        return;
      },
      { timeout: 5000 }
    );
  });

  afterAll(() => {
    cleanup();
  });
});
