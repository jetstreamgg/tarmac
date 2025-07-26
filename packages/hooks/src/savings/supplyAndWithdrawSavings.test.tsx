import { describe, expect, it, afterAll } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { WagmiWrapper, TEST_WALLET_ADDRESS, GAS } from '../../test';
import { parseEther } from 'viem';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { useSavingsApprove } from './useSavingsApprove';
import { sUsdsAddress, usdsAddress } from '../generated';
import { useSavingsSupply } from './useSavingsSupply';
import { useSavingsWithdraw } from './useSavingsWithdraw';
import { TENDERLY_CHAIN_ID } from '../constants';
import { waitForPreparedExecuteAndMine } from '../../test/helpers';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { TOKENS } from '../tokens/tokens.constants';
import { useBatchSavingsSupply } from './useBatchSavingsSupply';

describe('Savings - Supply and withdraw', async () => {
  it(
    'Should supply and withdraw',
    {
      timeout: 90000
    },
    async () => {
      // Approve token spending
      const { result: resultApprove } = renderHook(
        () =>
          useSavingsApprove({
            amount: parseEther('10'),
            gas: GAS
          }),

        {
          wrapper: WagmiWrapper
        }
      );

      // Get the balance of tokens for that user
      const { result: resultBalance } = renderHook(
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

      // The user should have some tokens
      let initialBalance: string = '0';
      await waitFor(
        () => {
          expect(resultBalance.current.data?.formatted).toBeDefined();
          expect(Number(resultBalance.current.data?.formatted)).toBeGreaterThanOrEqual(10);
          initialBalance = resultBalance.current.data?.formatted ?? '0';
          return;
        },
        { timeout: 5000 }
      );

      await waitForPreparedExecuteAndMine(resultApprove);

      // Supply
      const { result: resultSupply } = renderHook(
        () =>
          useSavingsSupply({
            amount: parseEther('10'),
            enabled: true,
            gas: GAS
          }),
        {
          wrapper: WagmiWrapper
        }
      );
      await waitForPreparedExecuteAndMine(resultSupply);

      // Get the balance of tokens for that user
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

      // The user should have less tokens after supply
      const expectedBalanceAfterSupply = (Number(initialBalance) - 10).toString();
      await waitFor(
        () => {
          expect(resultBalanceAfterSupply.current.data?.formatted).toEqual(expectedBalanceAfterSupply);
          return;
        },
        { timeout: 5000 }
      );

      // Withdraw
      const { result: resultWithdraw } = renderHook(
        () =>
          useSavingsWithdraw({
            amount: parseEther('5'),
            enabled: true,
            gas: GAS
          }),
        {
          wrapper: WagmiWrapper
        }
      );
      await waitForPreparedExecuteAndMine(resultWithdraw);

      // Get the balance of tokens for that user
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

      // The user should have more tokens after withdrawing
      const expectedBalanceAfterWithdraw = (Number(initialBalance) - 10 + 5).toString();
      await waitFor(
        () => {
          expect(resultBalanceAfterWithdraw.current.data?.formatted).toEqual(expectedBalanceAfterWithdraw);
          return;
        },
        { timeout: 5000 }
      );
    }
  );

  it('Batch - Should supply', { timeout: 90000 }, async () => {
    // Get initial balance
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
        expect(Number(resultInitialBalance.current.data?.formatted)).toBeGreaterThanOrEqual(20);
        initialBalance = resultInitialBalance.current.data?.formatted ?? '0';
        return;
      },
      { timeout: 5000 }
    );

    // Refetch USDS allowance
    const { result: resultAllowanceUsds } = renderHook(
      () =>
        useTokenAllowance({
          chainId: TENDERLY_CHAIN_ID,
          contractAddress: TOKENS.usds.address[TENDERLY_CHAIN_ID],
          owner: TEST_WALLET_ADDRESS,
          spender: sUsdsAddress[TENDERLY_CHAIN_ID]
        }),
      {
        wrapper: WagmiWrapper
      }
    );

    resultAllowanceUsds.current.mutate();
    await waitFor(
      () => {
        expect(resultAllowanceUsds.current.data).toEqual(0n);
        return;
      },
      { timeout: 15000 }
    );

    // Supply
    const { result: resultBatchSupply } = renderHook(
      () =>
        useBatchSavingsSupply({
          amount: parseEther('20'),
          enabled: true,
          gas: GAS
        }),
      {
        wrapper: WagmiWrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultBatchSupply);

    // Get the balance of tokens for that user
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

    // The user should have less tokens after supply
    const expectedBalanceAfterSupply = (Number(initialBalance) - 20).toString();
    await waitFor(
      () => {
        expect(resultBalanceAfterSupply.current.data?.formatted).toEqual(expectedBalanceAfterSupply);
        return;
      },
      { timeout: 5000 }
    );
  });

  afterAll(() => {
    cleanup();
  });
});
