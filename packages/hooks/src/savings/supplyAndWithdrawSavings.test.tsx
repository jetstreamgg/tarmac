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
      await waitFor(
        () => {
          expect(resultBalance.current.data?.formatted).toEqual('100');
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
      await waitFor(
        () => {
          expect(resultBalanceAfterSupply.current.data?.formatted).toEqual('90');
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
      await waitFor(
        () => {
          expect(resultBalanceAfterWithdraw.current.data?.formatted).toEqual('95');
          return;
        },
        { timeout: 5000 }
      );
    }
  );

  it('Batch - Should supply', { timeout: 90000 }, async () => {
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
          amount: parseEther('10'),
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
    await waitFor(
      () => {
        expect(resultBalanceAfterSupply.current.data?.formatted).toEqual('85');
        return;
      },
      { timeout: 5000 }
    );
  });

  afterAll(() => {
    cleanup();
  });
});
