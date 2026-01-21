import { describe, expect, it, afterAll } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import { GAS, WagmiWrapper } from '../../test';
import { useSavingsAllowance } from './useSavingsAllowance';

// import { vi } from 'vitest';
import { useConnection } from 'wagmi';
import { useApproveToken } from '../tokens/useApproveToken';
import { usdsAddress } from '../generated';
import { parseEther } from 'viem';
import { TENDERLY_CHAIN_ID } from '../constants';
import { sUsdsAddress } from './useReadSavingsUsds';
import { waitForPreparedExecuteAndMine } from '../../test/helpers';

// TODO: We can mock networks
// vi.mock('../network/useChainId', () => ({
//   useChainId: vi.fn(() => ({
//     chainId: 314310 // Tenderly
//   }))
// }));

describe('useSavingsAllowance', async () => {
  it('Should return a loading state', async () => {
    // Approve Savings
    const { result: resultApproveNst } = renderHook(
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

    const { result } = renderHook(() => useSavingsAllowance(), {
      wrapper: WagmiWrapper
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('should return a bigint', async () => {
    const { result } = renderHook(
      () => {
        return {
          account: useConnection(),
          //connect: useConnect({ connector : connector as any }),
          savings: useSavingsAllowance()
        };
      },
      {
        wrapper: WagmiWrapper
      }
    );

    // Connect wallet
    //  await act(async () => result.current.connect.connect())
    // See more https://github.com/wagmi-dev/wagmi/blob/cabba6a6fd68a25bdfcaf47a19b4b34ffb4d83bb/packages/react/src/hooks/accounts/useConnect.test.ts
    await waitFor(() => expect(result.current.account.isConnected).toBeTruthy());
    // TODO: the address returned by useConnection and useConnect combo does not correspond with the one on useSavingsAllowance
    // I think the connection logic should be on top

    await waitFor(
      () => {
        expect(result.current.savings.isLoading).toBe(false);
      },
      { timeout: 10000 }
    );

    // Data is undefined if the address does not have a dsproxy. We should check if the address has a dsproxy
    expect(result.current.savings.data).toBe(10000000000000000000n);
    expect(result.current.savings.dataSources.length).toEqual(1);
  });

  // TODO: Add a tests that checks that the addrress has a dsproxy and returns a bigint

  afterAll(() => {
    cleanup();
  });
});
