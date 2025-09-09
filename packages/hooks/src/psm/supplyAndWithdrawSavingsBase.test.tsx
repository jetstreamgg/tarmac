import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useApproveToken } from '../tokens/useApproveToken';
import { parseEther } from 'viem';
import { config, GAS, TEST_WALLET_ADDRESS, WagmiWrapper } from '../../test';
import { TOKENS } from '../tokens/tokens.constants';
import { TENDERLY_CHAIN_ID, BASE_CHAIN_ID } from '../constants';
import { psm3L2Address } from '../generated';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { waitForPreparedExecuteAndMine } from '../../test/helpers';
import { usePsmSwapExactIn } from './usePsmSwapExactIn';
import { switchChain } from '@wagmi/core';
import { usePsmSwapExactOut } from './usePsmSwapExactOut';
import { useBatchPsmSwapExactIn } from './useBatchPsmSwapExactIn';
import { useBatchPsmSwapExactOut } from './useBatchPsmSwapExactOut';
import { useTokenAllowance } from '../tokens/useTokenAllowance';

describe('Savings Base - Supply and withdraw', () => {
  beforeAll(async () => {
    await switchChain(config, { chainId: BASE_CHAIN_ID });
  });

  it('Should supply and withdraw', { timeout: 90000 }, async () => {
    // Approve token spending
    const { result: resultApprove } = renderHook(
      () =>
        useApproveToken({
          amount: parseEther('10'),
          contractAddress: TOKENS.usds.address[BASE_CHAIN_ID],
          spender: psm3L2Address[BASE_CHAIN_ID],
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
          token: TOKENS.usds.address[BASE_CHAIN_ID],
          chainId: BASE_CHAIN_ID
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
        usePsmSwapExactIn({
          amountIn: parseEther('10'),
          assetIn: TOKENS.usds.address[BASE_CHAIN_ID],
          assetOut: TOKENS.susds.address[BASE_CHAIN_ID],
          minAmountOut: 0n,
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
          token: TOKENS.usds.address[BASE_CHAIN_ID],
          chainId: BASE_CHAIN_ID
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

    // Approve withdraw token spending
    const { result: resultApproveWithdraw } = renderHook(
      () =>
        useApproveToken({
          // Actual amount of sUSDS will be slightly lower
          amount: parseEther('5'),
          contractAddress: TOKENS.susds.address[BASE_CHAIN_ID],
          spender: psm3L2Address[BASE_CHAIN_ID],
          gas: GAS
        }),
      {
        wrapper: WagmiWrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveWithdraw);

    // Withdraw
    const { result: resultWithdraw } = renderHook(
      () =>
        usePsmSwapExactOut({
          amountOut: parseEther('5'),
          assetOut: TOKENS.usds.address[BASE_CHAIN_ID],
          assetIn: TOKENS.susds.address[BASE_CHAIN_ID],
          maxAmountIn: parseEther('5'),
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
          token: TOKENS.usds.address[BASE_CHAIN_ID],
          chainId: BASE_CHAIN_ID
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
  });

  it('Batch - Should supply and withdraw', { timeout: 90000 }, async () => {
    // Get initial balance
    const { result: resultInitialBalance } = renderHook(
      () =>
        useTokenBalance({
          address: TEST_WALLET_ADDRESS,
          token: TOKENS.usds.address[BASE_CHAIN_ID],
          chainId: BASE_CHAIN_ID
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
          chainId: BASE_CHAIN_ID,
          contractAddress: TOKENS.usds.address[BASE_CHAIN_ID],
          owner: TEST_WALLET_ADDRESS,
          spender: psm3L2Address[BASE_CHAIN_ID]
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
        useBatchPsmSwapExactIn({
          amountIn: parseEther('20'),
          assetIn: TOKENS.usds.address[BASE_CHAIN_ID],
          assetOut: TOKENS.susds.address[BASE_CHAIN_ID],
          minAmountOut: 0n,
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
          token: TOKENS.usds.address[BASE_CHAIN_ID],
          chainId: BASE_CHAIN_ID
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

    // Refetch sUSDS allowance
    const { result: resultAllowanceSusds } = renderHook(
      () =>
        useTokenAllowance({
          chainId: BASE_CHAIN_ID,
          contractAddress: TOKENS.susds.address[BASE_CHAIN_ID],
          owner: TEST_WALLET_ADDRESS,
          spender: psm3L2Address[BASE_CHAIN_ID]
        }),
      {
        wrapper: WagmiWrapper
      }
    );

    resultAllowanceSusds.current.mutate();
    await waitFor(
      () => {
        expect(resultAllowanceSusds.current.data).toBeLessThan(parseEther('5'));
        return;
      },
      { timeout: 15000 }
    );

    // Withdraw
    const { result: resultBatchWithdraw } = renderHook(
      () =>
        useBatchPsmSwapExactOut({
          amountOut: parseEther('10'),
          assetOut: TOKENS.usds.address[BASE_CHAIN_ID],
          assetIn: TOKENS.susds.address[BASE_CHAIN_ID],
          maxAmountIn: parseEther('10'),
          enabled: true,
          gas: GAS
        }),
      {
        wrapper: WagmiWrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultBatchWithdraw);

    // Get the balance of tokens for that user
    const { result: resultBalanceAfterWithdraw } = renderHook(
      () =>
        useTokenBalance({
          address: TEST_WALLET_ADDRESS,
          token: TOKENS.usds.address[BASE_CHAIN_ID],
          chainId: BASE_CHAIN_ID
        }),
      {
        wrapper: WagmiWrapper
      }
    );

    // The user should have more tokens after withdrawing
    await waitFor(
      () => {
        expect(resultBalanceAfterWithdraw.current.data?.formatted).toEqual('185');
        return;
      },
      { timeout: 5000 }
    );
  });

  afterAll(async () => {
    await switchChain(config, { chainId: TENDERLY_CHAIN_ID });
    cleanup();
  });
});
