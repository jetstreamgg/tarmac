import { describe, expect, it, afterAll } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { WagmiWrapper, TEST_WALLET_ADDRESS, GAS } from '../../../test/hooks';
import { parseEther } from 'viem';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { useApproveToken } from '../../../test/hooks/useApproveToken';
import { stUsdsAddress, stUsdsImplementationAbi, usdsAddress } from '../generated';
import { useStUsdsWithdraw } from './useStUsdsWithdraw';
import { TENDERLY_CHAIN_ID } from '../constants';
import { waitForPreparedExecuteAndMine } from '../../../test/hooks/helpers';
import { useStUsdsData } from './useStUsdsData';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

// The app deposits through the approve-then-act engine, so there is no standalone
// deposit hook any more. A plain write seeds the position the withdraw cases need.
function useSeedDeposit(amount: bigint) {
  return useWriteContractFlow({
    address: stUsdsAddress[TENDERLY_CHAIN_ID],
    abi: stUsdsImplementationAbi,
    functionName: 'deposit',
    args: [amount, TEST_WALLET_ADDRESS],
    chainId: TENDERLY_CHAIN_ID,
    gas: GAS,
    enabled: true
  });
}

function useUsdsBalance() {
  return useTokenBalance({
    address: TEST_WALLET_ADDRESS,
    token: usdsAddress[TENDERLY_CHAIN_ID],
    chainId: TENDERLY_CHAIN_ID
  });
}

async function approveAndDeposit(amount: bigint) {
  const { result: resultApprove } = renderHook(
    () =>
      useApproveToken({
        amount,
        contractAddress: usdsAddress[TENDERLY_CHAIN_ID],
        spender: stUsdsAddress[TENDERLY_CHAIN_ID],
        gas: GAS
      }),
    { wrapper: WagmiWrapper }
  );
  await waitForPreparedExecuteAndMine(resultApprove);

  const { result: resultDeposit } = renderHook(() => useSeedDeposit(amount), { wrapper: WagmiWrapper });
  await waitForPreparedExecuteAndMine(resultDeposit);
}

describe('stUSDS - Supply and withdraw', () => {
  it('Should withdraw part of a supplied position', { timeout: 90000 }, async () => {
    const { result: resultInitialBalance } = renderHook(() => useUsdsBalance(), { wrapper: WagmiWrapper });

    let initialBalance: string = '0';
    await waitFor(
      () => {
        expect(resultInitialBalance.current.data?.formatted).toBeDefined();
        expect(Number(resultInitialBalance.current.data?.formatted)).toBeGreaterThanOrEqual(10);
        initialBalance = resultInitialBalance.current.data?.formatted ?? '0';
      },
      { timeout: 5000 }
    );

    await approveAndDeposit(parseEther('10'));

    const { result: resultBalanceAfterSupply } = renderHook(() => useUsdsBalance(), {
      wrapper: WagmiWrapper
    });
    const expectedBalanceAfterSupply = (Number(initialBalance) - 10).toString();
    await waitFor(
      () => {
        expect(resultBalanceAfterSupply.current.data?.formatted).toEqual(expectedBalanceAfterSupply);
      },
      { timeout: 5000 }
    );

    const { result: resultStUsdsBalance } = renderHook(
      () =>
        useTokenBalance({
          address: TEST_WALLET_ADDRESS,
          token: stUsdsAddress[TENDERLY_CHAIN_ID],
          chainId: TENDERLY_CHAIN_ID
        }),
      { wrapper: WagmiWrapper }
    );
    await waitFor(
      () => {
        expect(resultStUsdsBalance.current.data?.value).toBeGreaterThan(0n);
      },
      { timeout: 5000 }
    );

    // Withdraw 5 USDS from the stUSDS vault
    const { result: resultWithdraw } = renderHook(
      () => useStUsdsWithdraw({ amount: parseEther('5'), enabled: true, gas: GAS }),
      { wrapper: WagmiWrapper }
    );
    await waitForPreparedExecuteAndMine(resultWithdraw);

    const { result: resultBalanceAfterWithdraw } = renderHook(() => useUsdsBalance(), {
      wrapper: WagmiWrapper
    });
    const expectedBalanceAfterWithdraw = (Number(initialBalance) - 10 + 5).toString();
    await waitFor(
      () => {
        expect(resultBalanceAfterWithdraw.current.data?.formatted).toEqual(expectedBalanceAfterWithdraw);
      },
      { timeout: 5000 }
    );
  });

  it('Should handle max withdraw correctly', { timeout: 90000 }, async () => {
    const { result: resultStUsdsData } = renderHook(() => useStUsdsData(TEST_WALLET_ADDRESS), {
      wrapper: WagmiWrapper
    });
    await waitFor(
      () => {
        expect(resultStUsdsData.current.isLoading).toBe(false);
        expect(resultStUsdsData.current.data?.userMaxWithdraw).toBeGreaterThan(0n);
      },
      { timeout: 15000 }
    );

    // max: true redeems the full share balance rather than withdrawing an asset amount
    const { result: resultMaxWithdraw } = renderHook(
      () =>
        useStUsdsWithdraw({
          amount: resultStUsdsData.current.data?.userMaxWithdraw || 0n,
          enabled: true,
          gas: GAS,
          max: true
        }),
      { wrapper: WagmiWrapper }
    );
    await waitForPreparedExecuteAndMine(resultMaxWithdraw);
    expect(resultMaxWithdraw.current.error).toBeNull();
  });

  it('Should validate withdrawal amount against user balance', async () => {
    const { result: resultStUsdsData } = renderHook(() => useStUsdsData(TEST_WALLET_ADDRESS), {
      wrapper: WagmiWrapper
    });
    await waitFor(
      () => {
        expect(resultStUsdsData.current.isLoading).toBe(false);
      },
      { timeout: 15000 }
    );

    const userMaxWithdraw = resultStUsdsData.current.data?.userMaxWithdraw || 0n;

    const { result: resultExcessiveWithdraw } = renderHook(
      () =>
        useStUsdsWithdraw({
          amount: userMaxWithdraw + parseEther('1000'),
          enabled: true,
          gas: GAS
        }),
      { wrapper: WagmiWrapper }
    );

    await waitFor(
      () => {
        // Never prepared: the amount exceeds the buffered max withdraw
        expect(resultExcessiveWithdraw.current.prepared).toBe(false);
      },
      { timeout: 5000 }
    );
  });

  it('Should handle precision issues correctly', { timeout: 90000 }, async () => {
    await approveAndDeposit(parseEther('10'));

    const { result: resultStUsdsData } = renderHook(() => useStUsdsData(TEST_WALLET_ADDRESS), {
      wrapper: WagmiWrapper
    });
    await waitFor(
      () => {
        expect(resultStUsdsData.current.isLoading).toBe(false);
        expect(resultStUsdsData.current.data?.userMaxWithdraw).toBeGreaterThan(0n);
      },
      { timeout: 15000 }
    );

    const userMaxWithdraw = resultStUsdsData.current.data?.userMaxWithdraw || 0n;

    // One wei under the max stays inside the precision buffer and must go through
    const { result: resultExactWithdraw } = renderHook(
      () => useStUsdsWithdraw({ amount: userMaxWithdraw - 1n, enabled: true, gas: GAS }),
      { wrapper: WagmiWrapper }
    );
    await waitForPreparedExecuteAndMine(resultExactWithdraw);
  });

  afterAll(() => {
    cleanup();
  });
});
