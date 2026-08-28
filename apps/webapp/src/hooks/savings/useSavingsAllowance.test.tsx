import { describe, expect, it, afterAll } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import { GAS, WagmiWrapper } from '../../../test/hooks';
import { useSavingsAllowance } from './useSavingsAllowance';
import { useConnection } from 'wagmi';
import { useApproveToken } from '../tokens/useApproveToken';
import { usdsAddress } from '../generated';
import { parseEther } from 'viem';
import { TENDERLY_CHAIN_ID } from '../constants';
import { sUsdsAddress } from './useReadSavingsUsds';
import { waitForPreparedExecuteAndMine } from '../../../test/hooks/helpers';

describe('useSavingsAllowance', () => {
  it('Should return a loading state', () => {
    const { result, unmount } = renderHook(() => useSavingsAllowance(), {
      wrapper: WagmiWrapper
    });
    expect(result.current.isLoading).toBe(true);
    unmount();
  });

  it('should return a bigint', async () => {
    const { result: resultApproveNst, unmount: unmountApprove } = renderHook(
      () =>
        useApproveToken({
          amount: parseEther('10'),
          contractAddress: usdsAddress[TENDERLY_CHAIN_ID],
          spender: sUsdsAddress[TENDERLY_CHAIN_ID],
          gas: GAS
        }),
      { wrapper: WagmiWrapper }
    );
    await waitForPreparedExecuteAndMine(resultApproveNst);
    unmountApprove();

    const { result, unmount } = renderHook(
      () => ({
        account: useConnection(),
        savings: useSavingsAllowance()
      }),
      {
        wrapper: WagmiWrapper
      }
    );

    await waitFor(() => expect(result.current.account.isConnected).toBeTruthy());

    await waitFor(
      () => {
        expect(result.current.savings.isLoading).toBe(false);
      },
      { timeout: 10000 }
    );

    expect(result.current.savings.data).toBe(10000000000000000000n);
    expect(result.current.savings.dataSources.length).toEqual(1);
    unmount();
  });

  afterAll(() => {
    cleanup();
  });
});
