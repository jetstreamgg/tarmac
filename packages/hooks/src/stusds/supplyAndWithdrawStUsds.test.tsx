import { describe, expect, it, afterAll } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { WagmiWrapper, TEST_WALLET_ADDRESS, GAS } from '../../test';
import { parseEther } from 'viem';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { useStUsdsApprove } from './useStUsdsApprove';
import { stUsdsAddress, usdsAddress } from '../generated';
import { useStUsdsDeposit } from './useStUsdsDeposit';
import { useStUsdsWithdraw } from './useStUsdsWithdraw';
import { TENDERLY_CHAIN_ID } from '../constants';
import { waitForPreparedExecuteAndMine } from '../../test/helpers';
import { useStUsdsData } from './useStUsdsData';

describe('stUSDS - Supply and withdraw', () => {
  it(
    'Should supply and withdraw from stUSDS vault',
    {
      timeout: 90000
    },
    async () => {
      // Get initial USDS balance
      const { result: resultInitialBalance } = renderHook(
        () =>
          useTokenBalance({
            address: TEST_WALLET_ADDRESS,
            token: usdsAddress[TENDERLY_CHAIN_ID],
            chainId: TENDERLY_CHAIN_ID
          }),
        {
          wrapper: WagmiWrapper
        }
      );

      let initialBalance: string = '0';
      await waitFor(
        () => {
          expect(resultInitialBalance.current.data?.formatted).toBeDefined();
          expect(Number(resultInitialBalance.current.data?.formatted)).toBeGreaterThanOrEqual(10);
          initialBalance = resultInitialBalance.current.data?.formatted ?? '0';
        },
        { timeout: 5000 }
      );

      // Approve USDS spending
      const { result: resultApprove } = renderHook(
        () =>
          useStUsdsApprove({
            amount: parseEther('10'),
            gas: GAS
          }),
        {
          wrapper: WagmiWrapper
        }
      );

      await waitForPreparedExecuteAndMine(resultApprove);

      // Supply USDS to stUSDS vault
      const { result: resultDeposit } = renderHook(
        () =>
          useStUsdsDeposit({
            amount: parseEther('10'),
            enabled: true,
            gas: GAS
          }),
        {
          wrapper: WagmiWrapper
        }
      );
      await waitForPreparedExecuteAndMine(resultDeposit);

      // Check USDS balance after supply
      const { result: resultBalanceAfterSupply } = renderHook(
        () =>
          useTokenBalance({
            address: TEST_WALLET_ADDRESS,
            token: usdsAddress[TENDERLY_CHAIN_ID],
            chainId: TENDERLY_CHAIN_ID
          }),
        {
          wrapper: WagmiWrapper
        }
      );

      // User should have 10 USDS less
      const expectedBalanceAfterSupply = (Number(initialBalance) - 10).toString();
      await waitFor(
        () => {
          expect(resultBalanceAfterSupply.current.data?.formatted).toEqual(expectedBalanceAfterSupply);
        },
        { timeout: 5000 }
      );

      // Check stUSDS balance after supply
      const { result: resultStUsdsBalance } = renderHook(
        () =>
          useTokenBalance({
            address: TEST_WALLET_ADDRESS,
            token: stUsdsAddress[TENDERLY_CHAIN_ID],
            chainId: TENDERLY_CHAIN_ID
          }),
        {
          wrapper: WagmiWrapper
        }
      );

      await waitFor(
        () => {
          expect(resultStUsdsBalance.current.data?.value).toBeGreaterThan(0n);
        },
        { timeout: 5000 }
      );

      // Withdraw 5 USDS from stUSDS vault
      const { result: resultWithdraw } = renderHook(
        () =>
          useStUsdsWithdraw({
            amount: parseEther('5'),
            enabled: true,
            gas: GAS
          }),
        {
          wrapper: WagmiWrapper
        }
      );
      await waitForPreparedExecuteAndMine(resultWithdraw);

      // Check USDS balance after withdraw
      const { result: resultBalanceAfterWithdraw } = renderHook(
        () =>
          useTokenBalance({
            address: TEST_WALLET_ADDRESS,
            token: usdsAddress[TENDERLY_CHAIN_ID],
            chainId: TENDERLY_CHAIN_ID
          }),
        {
          wrapper: WagmiWrapper
        }
      );

      // User should have 5 USDS more than after supply
      const expectedBalanceAfterWithdraw = (Number(initialBalance) - 10 + 5).toString();
      await waitFor(
        () => {
          expect(resultBalanceAfterWithdraw.current.data?.formatted).toEqual(expectedBalanceAfterWithdraw);
        },
        { timeout: 5000 }
      );
    }
  );

  it(
    'Should handle referral code in deposit',
    {
      timeout: 90000
    },
    async () => {
      // Approve USDS spending
      const { result: resultApprove } = renderHook(
        () =>
          useStUsdsApprove({
            amount: parseEther('5'),
            gas: GAS
          }),
        {
          wrapper: WagmiWrapper
        }
      );

      await waitForPreparedExecuteAndMine(resultApprove);

      // Supply with referral code
      const { result: resultDepositWithReferral } = renderHook(
        () =>
          useStUsdsDeposit({
            amount: parseEther('5'),
            enabled: true,
            gas: GAS,
            referral: 12345
          }),
        {
          wrapper: WagmiWrapper
        }
      );

      await waitForPreparedExecuteAndMine(resultDepositWithReferral);

      // Should complete successfully (referral code should be handled)
      expect(resultDepositWithReferral.current.error).toBeNull();
    }
  );

  it(
    'Should handle max withdraw correctly',
    {
      timeout: 90000
    },
    async () => {
      // Get stUSDS data to check withdrawable balance
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

      // Withdraw max amount
      const { result: resultMaxWithdraw } = renderHook(
        () =>
          useStUsdsWithdraw({
            amount: resultStUsdsData.current.data?.userMaxWithdraw || 0n,
            enabled: true,
            gas: GAS,
            max: true
          }),
        {
          wrapper: WagmiWrapper
        }
      );

      await waitForPreparedExecuteAndMine(resultMaxWithdraw);

      // Should complete successfully
      expect(resultMaxWithdraw.current.error).toBeNull();
    }
  );

  it('Should validate withdrawal amount against user balance', async () => {
    // Get stUSDS data
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

    // Try to withdraw more than available
    const { result: resultExcessiveWithdraw } = renderHook(
      () =>
        useStUsdsWithdraw({
          amount: userMaxWithdraw + parseEther('1000'),
          enabled: true,
          gas: GAS
        }),
      {
        wrapper: WagmiWrapper
      }
    );

    await waitFor(
      () => {
        // Should not be prepared due to insufficient balance
        expect(resultExcessiveWithdraw.current.prepared).toBe(false);
      },
      { timeout: 5000 }
    );
  });

  it('Should handle precision issues correctly', async () => {
    // Get stUSDS data
    const { result: resultStUsdsData } = renderHook(() => useStUsdsData(TEST_WALLET_ADDRESS), {
      wrapper: WagmiWrapper
    });
    await waitFor(
      () => {
        expect(resultStUsdsData.current.isLoading).toBe(false);
      },
      { timeout: 15000 }
    );
    const userMaxWithdrawBefore = resultStUsdsData.current.data?.userMaxWithdraw;

    resultStUsdsData.current.mutate();

    // Wait for mutation to happen
    await waitFor(
      () => {
        expect(resultStUsdsData.current.data?.userMaxWithdraw).not.toBe(userMaxWithdrawBefore);
      },
      { timeout: 15000 }
    );

    await waitFor(
      () => {
        expect(resultStUsdsData.current.data?.userMaxWithdraw).toBeGreaterThan(0n);
      },
      { timeout: 15000 }
    );

    // The precision buffer should allow withdrawal of exact amounts
    const userMaxWithdraw = resultStUsdsData.current.data?.userMaxWithdraw || 0n;

    // Try to withdraw the exact amount (should work with precision buffer)
    const { result: resultExactWithdraw } = renderHook(
      () =>
        useStUsdsWithdraw({
          amount: userMaxWithdraw - 1n, // Subtract 1 wei to account for buffer
          enabled: true,
          gas: GAS
        }),
      {
        wrapper: WagmiWrapper
      }
    );

    await waitForPreparedExecuteAndMine(resultExactWithdraw);
  });

  afterAll(() => {
    cleanup();
  });
});
