import { describe, expect, it, afterAll } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

import { parseEther } from 'viem';
import { mcdDaiAddress } from '../generated';
import { useApproveToken } from './useApproveToken';
import { useTokenAllowance } from './useTokenAllowance';
import { WagmiWrapper, TEST_WALLET_ADDRESS, GAS } from '../../../test/hooks';
import { TENDERLY_CHAIN_ID } from '../constants';
import { sUsdsAddress } from '../savings/useReadSavingsUsds';
import { waitForPreparedExecuteAndMine } from '../../../test/hooks/helpers';

describe('Approve and read allowance for token', async () => {
  it(
    'Should approve token and read allowance',
    {
      timeout: 90000
    },
    async () => {
      // Approve token
      const { result: resultApproveDai } = renderHook(
        () =>
          useApproveToken({
            amount: parseEther('7'),
            contractAddress: mcdDaiAddress[TENDERLY_CHAIN_ID],
            spender: sUsdsAddress[TENDERLY_CHAIN_ID],
            gas: GAS
          }),
        { wrapper: WagmiWrapper }
      );
      await waitForPreparedExecuteAndMine(resultApproveDai);

      // Get the alowance of DAI for that user
      const { result: resultAlowance } = renderHook(
        () =>
          useTokenAllowance({
            chainId: TENDERLY_CHAIN_ID,
            contractAddress: mcdDaiAddress[TENDERLY_CHAIN_ID],
            owner: TEST_WALLET_ADDRESS,
            spender: sUsdsAddress[TENDERLY_CHAIN_ID]
          }),
        {
          wrapper: WagmiWrapper
        }
      );

      // Allowance should be the same as the approved amount
      await waitFor(
        () => {
          expect(resultAlowance.current.data).toEqual(7000000000000000000n);
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
