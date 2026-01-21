import { describe, expect, it, afterAll } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { WagmiWrapper, TEST_WALLET_ADDRESS, GAS } from '../../test';

import { formatEther, parseEther } from 'viem';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { mkrAddress, skyAddress } from '../generated';
import { useMkrSkyApprove } from './useMkrSkyApprove';
import { useMkrToSky } from './useMkrToSky';
import { TENDERLY_CHAIN_ID } from '../constants';
import { waitForPreparedExecuteAndMine } from '../../test/helpers';
import { useMkrSkyFee } from './useMkrSkyFee';
import { math } from '@jetstreamgg/sky-utils';

describe('Upgrade MKR SKY', async () => {
  it(
    'Should upgrade MKR to SKY',
    {
      timeout: 90000
    },
    async () => {
      const wrapper = WagmiWrapper;

      // Approve token to upgrade
      const { result: resultApproveMkr } = renderHook(
        () =>
          useMkrSkyApprove({
            amount: parseEther('10'),
            tokenAddress: mkrAddress[TENDERLY_CHAIN_ID],
            gas: GAS
          }),

        {
          wrapper
        }
      );

      // Get the balance of mkr for that user
      const { result: resultBalanceMkr } = renderHook(
        () =>
          useTokenBalance({
            address: TEST_WALLET_ADDRESS,
            token: mkrAddress[TENDERLY_CHAIN_ID],
            chainId: TENDERLY_CHAIN_ID
          }),
        {
          wrapper
        }
      );

      // The user should have some MKR
      await waitFor(
        () => {
          expect(resultBalanceMkr.current.data?.formatted).toEqual('100');
          return;
        },
        { timeout: 5000 }
      );

      await waitForPreparedExecuteAndMine(resultApproveMkr);

      // Upgrade MKR to SKY
      const { result: resultUpgrade } = renderHook(
        () =>
          useMkrToSky({
            amount: parseEther('10'),
            enabled: true,
            gas: GAS
          }),
        {
          wrapper
        }
      );

      await waitForPreparedExecuteAndMine(resultUpgrade);

      // Get the balance of MKR for that user
      const { result: resultBalanceMkrAfterUpgrade } = renderHook(
        () =>
          useTokenBalance({
            address: TEST_WALLET_ADDRESS,
            token: mkrAddress[TENDERLY_CHAIN_ID],
            chainId: TENDERLY_CHAIN_ID
          }),
        {
          wrapper
        }
      );

      // The user should have less MKR after upgrade
      await waitFor(
        () => {
          expect(resultBalanceMkrAfterUpgrade.current.data?.formatted).toEqual('90');
          return;
        },
        { timeout: 5000 }
      );

      // Get the balance of SKY for that user
      const { result: resultBalanceNgtAfterUpgrade } = renderHook(
        () =>
          useTokenBalance({
            address: TEST_WALLET_ADDRESS,
            token: skyAddress[TENDERLY_CHAIN_ID],
            chainId: TENDERLY_CHAIN_ID
          }),
        {
          wrapper
        }
      );
      // Get the delayed upgrade penalty
      const { result: resultMkrSkyFee } = renderHook(() => useMkrSkyFee(), { wrapper });

      await waitFor(() => expect(resultMkrSkyFee.current.data).toBeDefined(), { timeout: 5000 });

      const expectedSkyBalance = math.calculateConversion(
        { symbol: 'MKR' },
        parseEther('10'),
        resultMkrSkyFee.current.data || 0n
      );

      // The user should have more SKY after upgrade
      await waitFor(
        () => {
          expect(resultBalanceNgtAfterUpgrade.current.data?.formatted).toEqual(
            formatEther(expectedSkyBalance)
          );
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
