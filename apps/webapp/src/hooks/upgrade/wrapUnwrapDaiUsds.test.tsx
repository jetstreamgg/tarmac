import { describe, expect, it, afterAll } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { WagmiWrapper, TEST_WALLET_ADDRESS, GAS } from '../../../test/hooks';

import { parseEther } from 'viem';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { mcdDaiAddress, usdsAddress } from '../generated';
import { useDaiUsdsApprove } from './useDaiUsdsApprove';
import { useDaiToUsds } from './useDaiToUsds';
import { useUsdsToDai } from './useUsdsToDai';
import { TENDERLY_CHAIN_ID } from '../constants';
import { waitForPreparedExecuteAndMine } from '../../../test/hooks/helpers';

describe('Upgrade and revert DAI USDS', async () => {
  it(
    'Should upgrade and revert',
    {
      timeout: 90000
    },
    async () => {
      const wrapper = WagmiWrapper;

      // Approve token to upgrade
      const { result: resultApproveDai } = renderHook(
        () =>
          useDaiUsdsApprove({
            amount: parseEther('1000'),
            tokenAddress: mcdDaiAddress[TENDERLY_CHAIN_ID],
            gas: GAS
          }),

        {
          wrapper
        }
      );

      // Get the balance of dai for that user
      const { result: resultBalanceDai } = renderHook(
        () =>
          useTokenBalance({
            address: TEST_WALLET_ADDRESS,
            token: mcdDaiAddress[TENDERLY_CHAIN_ID],
            chainId: TENDERLY_CHAIN_ID
          }),
        {
          wrapper
        }
      );

      // The user was sent 10000 DAI during testnet setup
      await waitFor(
        () => {
          expect(resultBalanceDai.current.data?.formatted).toEqual('10000');
          return;
        },
        { timeout: 5000 }
      );

      await waitForPreparedExecuteAndMine(resultApproveDai);

      // Upgrade DAI to USDS
      const { result: resultUpgrade } = renderHook(
        () =>
          useDaiToUsds({
            amount: parseEther('1000'),
            enabled: true,
            gas: GAS
          }),
        {
          wrapper
        }
      );

      await waitForPreparedExecuteAndMine(resultUpgrade);

      // Get the balance of DAI for that user
      const { result: resultBalanceDaiAfterUpgrade } = renderHook(
        () =>
          useTokenBalance({
            address: TEST_WALLET_ADDRESS,
            token: mcdDaiAddress[TENDERLY_CHAIN_ID],
            chainId: TENDERLY_CHAIN_ID
          }),
        {
          wrapper
        }
      );

      // The user should have less DAI after upgrade
      await waitFor(
        () => {
          expect(resultBalanceDaiAfterUpgrade.current.data?.formatted).toEqual('9000');
          return;
        },
        { timeout: 5000 }
      );

      // Get the balance of USDS for that user
      const { result: resultBalanceNstAfterUpgrade } = renderHook(
        () =>
          useTokenBalance({
            address: TEST_WALLET_ADDRESS,
            token: usdsAddress[TENDERLY_CHAIN_ID],
            chainId: TENDERLY_CHAIN_ID
          }),
        {
          wrapper
        }
      );

      // The user should have more USDS after upgrade
      await waitFor(
        () => {
          //1100 is expected because the account is already pre-funded with 100 USDS
          expect(resultBalanceNstAfterUpgrade.current.data?.formatted).toEqual('1100');
          return;
        },
        { timeout: 5000 }
      );

      // Revert USDS to DAI
      // Approve token to revert
      const { result: resultApproveNst } = renderHook(
        () =>
          useDaiUsdsApprove({
            amount: parseEther('1000'),
            tokenAddress: usdsAddress[TENDERLY_CHAIN_ID],
            gas: GAS
          }),

        {
          wrapper
        }
      );

      await waitForPreparedExecuteAndMine(resultApproveNst);

      // Revert USDS to DAI
      const { result: resultRevert } = renderHook(
        () =>
          useUsdsToDai({
            amount: parseEther('1000'),
            enabled: true,
            gas: GAS
          }),
        {
          wrapper
        }
      );

      await waitForPreparedExecuteAndMine(resultRevert);

      // Get the balance of DAI for that user
      const { result: resultBalanceDaiAfterRevert } = renderHook(
        () =>
          useTokenBalance({
            address: TEST_WALLET_ADDRESS,
            token: mcdDaiAddress[TENDERLY_CHAIN_ID],
            chainId: TENDERLY_CHAIN_ID
          }),
        {
          wrapper
        }
      );

      // The user should have more DAI after revert
      await waitFor(
        () => {
          expect(resultBalanceDaiAfterRevert.current.data?.formatted).toEqual('10000');
          return;
        },
        { timeout: 5000 }
      );

      // Get the balance of USDS for that user
      const { result: resultBalanceNstAfterRevert } = renderHook(
        () =>
          useTokenBalance({
            address: TEST_WALLET_ADDRESS,
            token: usdsAddress[TENDERLY_CHAIN_ID],
            chainId: TENDERLY_CHAIN_ID
          }),
        {
          wrapper
        }
      );

      // The user should have 100 USDS, what they started with
      await waitFor(
        () => {
          expect(resultBalanceNstAfterRevert.current.data?.formatted).toEqual('100');
          return;
        },
        { timeout: 5000 }
      );
    }
  );

  afterAll(() => {
    cleanup();
  });
});
