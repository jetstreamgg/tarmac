import { describe, expect, it, afterAll } from 'vitest';
import { cleanup, waitFor, renderHook } from '@testing-library/react';
import { WagmiWrapper, TEST_WALLET_ADDRESS, GAS } from '../../test';
import { parseEther } from 'viem';
import { useStUsdsAllowance } from './useStUsdsAllowance';
import { useStUsdsApprove } from './useStUsdsApprove';
import { waitForPreparedExecuteAndMine } from '../../test/helpers';

describe('useStUsdsAllowance', () => {
  it('Should return allowance data', async () => {
    const { result } = renderHook(() => useStUsdsAllowance(TEST_WALLET_ADDRESS), {
      wrapper: WagmiWrapper
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeDefined();
        expect(typeof result.current.data).toBe('bigint');
      },
      { timeout: 15000 }
    );
  });

  it('Should handle approval flow correctly', async () => {
    // Get initial allowance
    const { result: resultInitialAllowance } = renderHook(() => useStUsdsAllowance(TEST_WALLET_ADDRESS), {
      wrapper: WagmiWrapper
    });

    await waitFor(
      () => {
        expect(resultInitialAllowance.current.isLoading).toBe(false);
      },
      { timeout: 15000 }
    );

    const initialAllowance = resultInitialAllowance.current.data || 0n;

    // Approve additional amount
    const approvalAmount = parseEther('100');
    const { result: resultApprove } = renderHook(
      () =>
        useStUsdsApprove({
          amount: approvalAmount,
          gas: GAS
        }),
      {
        wrapper: WagmiWrapper
      }
    );

    await waitForPreparedExecuteAndMine(resultApprove);

    // Check allowance after approval
    const { result: resultUpdatedAllowance } = renderHook(() => useStUsdsAllowance(TEST_WALLET_ADDRESS), {
      wrapper: WagmiWrapper
    });

    resultUpdatedAllowance.current.mutate();

    await waitFor(
      () => {
        expect(resultUpdatedAllowance.current.data).toBeGreaterThan(initialAllowance);
        expect(resultUpdatedAllowance.current.data).toBeGreaterThanOrEqual(approvalAmount);
      },
      { timeout: 15000 }
    );
  });

  it('Should provide data sources', async () => {
    const { result } = renderHook(() => useStUsdsAllowance(TEST_WALLET_ADDRESS), {
      wrapper: WagmiWrapper
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 15000 }
    );

    expect(result.current.dataSources).toBeDefined();
    expect(result.current.dataSources.length).toBeGreaterThan(0);
    expect(result.current.dataSources[0].onChain).toBe(true);
  });

  it('Should handle zero allowance', async () => {
    const { result } = renderHook(() => useStUsdsAllowance('0x0000000000000000000000000000000000000000'), {
      wrapper: WagmiWrapper
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 15000 }
    );

    expect(result.current.data).toBe(0n);
  });

  afterAll(() => {
    cleanup();
  });
});
