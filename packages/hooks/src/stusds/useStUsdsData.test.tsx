import { describe, expect, it, afterAll } from 'vitest';
import { cleanup, waitFor, renderHook } from '@testing-library/react';
import { WagmiWrapper } from '../../test';
import { useStUsdsData } from './useStUsdsData';
import { useCollateralData } from '../vaults/useCollateralData';
import { getIlkName } from '../vaults/helpers';

describe('useStUsdsData', () => {
  it('Should return a loading state', () => {
    const { result } = renderHook(() => useStUsdsData('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'), {
      wrapper: WagmiWrapper
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('should return stUSDS data with vault metrics', async () => {
    const { result } = renderHook(() => useStUsdsData('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'), {
      wrapper: WagmiWrapper
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 15000 }
    );

    // Verify vault metrics are present
    expect(result.current.data?.totalAssets).toBeGreaterThanOrEqual(0n);
    expect(result.current.data?.totalSupply).toBeGreaterThanOrEqual(0n);
    expect(result.current.data?.assetPerShare).toBeGreaterThanOrEqual(0n);

    // Verify user balances are present
    expect(result.current.data?.userStUsdsBalance).toBeGreaterThanOrEqual(0n);
    expect(result.current.data?.userUsdsBalance).toBeGreaterThanOrEqual(0n);
    expect(result.current.data?.userMaxDeposit).toBeGreaterThanOrEqual(0n);
    expect(result.current.data?.userMaxWithdraw).toBeGreaterThanOrEqual(0n);

    // Verify rate metrics are present
    expect(result.current.data?.moduleRate).toBeGreaterThanOrEqual(0n);
    expect(result.current.data?.chi).toBeGreaterThanOrEqual(0n);

    // Verify capacity limits are present
    expect(result.current.data?.cap).toBeGreaterThanOrEqual(0n);
    expect(result.current.data?.line).toBeGreaterThanOrEqual(0n);

    // Verify data sources are present
    expect(result.current.dataSources.length).toEqual(1);
    expect(result.current.dataSources[0].title).toBe('stUSDS Contract');
    expect(result.current.dataSources[0].onChain).toBe(true);
  });

  it('should calculate withdrawable balance with precision buffer', async () => {
    const { result } = renderHook(() => useStUsdsData('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'), {
      wrapper: WagmiWrapper
    });
    const { result: collateralResult } = renderHook(() => useCollateralData(getIlkName(2)), {
      wrapper: WagmiWrapper
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
        expect(collateralResult.current.isLoading).toBe(false);
      },
      { timeout: 15000 }
    );

    const totalAssets = result.current.data?.totalAssets ?? 0n;
    const totalStakingDebt = collateralResult.current.data?.totalDaiDebt ?? 0n;
    const userSuppliedUsds = result.current.data?.userSuppliedUsds ?? 0n;

    // If user has stUSDS balance, withdrawable should be calculated
    if (result.current.data?.userStUsdsBalance && result.current.data.userStUsdsBalance > 0n) {
      expect(result.current.data.userMaxWithdraw).toBeGreaterThan(0n);

      const availableLiquidity = totalAssets - totalStakingDebt;

      // If user has supplied more than the current available liquidity, the current maxWithrawable amount
      // will be the current available liquidity, even if that's less than what they have supplied
      if (userSuppliedUsds <= availableLiquidity) {
        // Should include precision buffer (1 wei)
        expect(result.current.data.userMaxWithdraw).toBeGreaterThanOrEqual(
          result.current.data.userStUsdsBalance
        );
      } else {
        // Check if the value is within 1 of the expected value
        const difference =
          availableLiquidity > result.current.data.userMaxWithdraw
            ? availableLiquidity - result.current.data.userMaxWithdraw
            : result.current.data.userMaxWithdraw - availableLiquidity;
        expect(difference).toBeLessThanOrEqual(1n);
      }
    }
  });

  it('should handle case when contract calls fail', async () => {
    const { result } = renderHook(() => useStUsdsData('0x0000000000000000000000000000000000000000'), {
      wrapper: WagmiWrapper
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 15000 }
    );

    // Should still return data object with defaults
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.totalAssets).toBeGreaterThan(0n);
    expect(result.current.data?.totalSupply).toBeGreaterThan(0n);
    expect(result.current.data?.userStUsdsBalance).toBe(0n);
    expect(result.current.data?.userMaxWithdraw).toBe(0n);
  });

  afterAll(() => {
    cleanup();
  });
});
