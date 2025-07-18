import { describe, expect, it, afterAll } from 'vitest';
import { cleanup, waitFor, renderHook } from '@testing-library/react';
import { WagmiWrapper } from '../../test';
import { useStUsdsData } from './useStUsdsData';

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
    expect(result.current.data?.savingsRate).toBeGreaterThanOrEqual(0n);
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

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 15000 }
    );

    // If user has stUSDS balance, withdrawable should be calculated
    if (result.current.data?.userStUsdsBalance && result.current.data.userStUsdsBalance > 0n) {
      expect(result.current.data.userMaxWithdraw).toBeGreaterThan(0n);
      // Should include precision buffer (1 wei)
      expect(result.current.data.userMaxWithdraw).toBeGreaterThanOrEqual(
        result.current.data.userStUsdsBalance
      );
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
    expect(result.current.data?.totalAssets).toBe(0n);
    expect(result.current.data?.totalSupply).toBe(0n);
    expect(result.current.data?.userStUsdsBalance).toBe(0n);
    expect(result.current.data?.userMaxWithdraw).toBe(0n);
  });

  afterAll(() => {
    cleanup();
  });
});
