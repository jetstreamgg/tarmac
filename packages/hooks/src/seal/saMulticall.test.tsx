import { describe, expect, it } from 'vitest';
import { GAS, TEST_WALLET_ADDRESS, WagmiWrapper } from '../../test';
import { renderHook, waitFor } from '@testing-library/react';
import { useSaMkrApprove } from './useSaApprove';
import { parseEther } from 'viem';
import { useCurrentUrnIndex } from './useCurrentUrnIndex';
import { useVault } from '../vaults/useVault';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { TENDERLY_CHAIN_ID } from '../constants';
import { getUrnAddress, waitForPreparedExecuteAndMine } from '../../test/helpers';
import { useSaMulticall } from './useSaMulticall';
import { TOKENS } from '../tokens/tokens.constants';
import {
  getSaFreeMkrCalldata,
  getSaLockMkrCalldata,
  getSaOpenCalldata,
  getSaSelectDelegateCalldata,
  getSaSelectRewardContractCalldata
} from './calldata';
import { lsMkrUsdsRewardAddress } from '../generated';
import { useUrnSelectedRewardContract } from './useUrnSelectedRewardContract';
import { useUrnSelectedVoteDelegate } from './useUrnSelectedVoteDelegate';
import { MAX_UINT_256 } from '../../test/constants';
import { useRewardsSuppliedBalance } from '../rewards/useRewardsBalance';
import { useUrnAddress } from './useUrnAddress';

describe('Seal Module Multicall tests', async () => {
  const wrapper = WagmiWrapper;
  const URN_INDEX = 0n;
  const MKR_TO_LOCK = parseEther('20');
  // Manually created delegate in the parent forked vnet
  const SELECTED_DELEGATE = '0x4E4393f93ac7ba34648A82eA2248D9bDBb1Ff7e5';
  const LOADING_TIMEOUT = 15000;

  it('Should open, lock MKR, select a reward contract and a delegate in a single multicall transaction', async () => {
    // Make sure URN_INDEX is correct
    const { result: resultUrnIndex } = renderHook(() => useCurrentUrnIndex(), { wrapper });

    await waitFor(
      () => {
        expect(resultUrnIndex.current.data).toEqual(URN_INDEX);
        return;
      },
      { timeout: 5000 }
    );

    // Unlimited approvals for convenience
    const { result: resultApproveMkr } = renderHook(
      () =>
        useSaMkrApprove({
          amount: MAX_UINT_256,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveMkr, LOADING_TIMEOUT);

    // Generate calldata for each operation
    const calldataOpen = getSaOpenCalldata({ urnIndex: URN_INDEX });

    const calldataLockMkr = getSaLockMkrCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      amount: MKR_TO_LOCK
    });

    const calldataSelectRewardContract = getSaSelectRewardContractCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      rewardContractAddress: lsMkrUsdsRewardAddress[TENDERLY_CHAIN_ID]
    });

    const calldataSelectDelegate = getSaSelectDelegateCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      delegateAddress: SELECTED_DELEGATE
    });

    // Call multicall with all the calldata
    const { result: resultMulticall } = renderHook(
      () =>
        useSaMulticall({
          calldata: [calldataOpen, calldataLockMkr, calldataSelectRewardContract, calldataSelectDelegate],
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall, LOADING_TIMEOUT);

    // If urn was opened correctly, the new urn index should be incremented by 1
    const { result: resultNewUrnIndex } = renderHook(() => useCurrentUrnIndex(), { wrapper });

    await waitFor(
      () => {
        expect(resultNewUrnIndex.current.data).toEqual(URN_INDEX + 1n);
        return;
      },
      { timeout: 5000 }
    );

    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);

    // Check Urn locked MKR
    const { result: resultMkrLocked } = renderHook(() => useVault(urnAddress), {
      wrapper
    });

    await waitFor(
      () => {
        expect(resultMkrLocked.current.data?.collateralAmount).toBe(MKR_TO_LOCK);
        return;
      },
      { timeout: 5000 }
    );

    // Check selected reward contract
    const { result: resultUrnSelectedRewardContract } = renderHook(
      () => useUrnSelectedRewardContract({ urn: urnAddress }),
      {
        wrapper
      }
    );

    await waitFor(
      () => {
        expect(resultUrnSelectedRewardContract.current.data).toBe(lsMkrUsdsRewardAddress[TENDERLY_CHAIN_ID]);
        return;
      },
      { timeout: 5000 }
    );

    // Check selected delegate
    const { result: resultUrnSelectedDelegate } = renderHook(
      () => useUrnSelectedVoteDelegate({ urn: urnAddress }),
      {
        wrapper
      }
    );

    await waitFor(
      () => {
        expect(resultUrnSelectedDelegate.current.data).toBe(SELECTED_DELEGATE);
        return;
      },
      { timeout: 5000 }
    );

    // Check balance of reward contract
    const { result: resultRewardContractBalance } = renderHook(
      () =>
        useRewardsSuppliedBalance({
          address: urnAddress,
          contractAddress: lsMkrUsdsRewardAddress[TENDERLY_CHAIN_ID],
          chainId: TENDERLY_CHAIN_ID
        }),
      {
        wrapper
      }
    );

    await waitFor(
      () => {
        expect(resultRewardContractBalance.current.data).toBe(MKR_TO_LOCK);
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Can lock additional MKR in position', async () => {
    // First check the current collateral amount before adding more MKR
    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);
    const { result: resultInitialLocked } = renderHook(() => useVault(urnAddress), {
      wrapper
    });

    let initialCollateralAmount: bigint | undefined;
    await waitFor(
      () => {
        initialCollateralAmount = resultInitialLocked.current.data?.collateralAmount;
        expect(initialCollateralAmount).toBeDefined();
        return;
      },
      { timeout: 5000 }
    );

    // Generate calldata for locking MKR
    const calldataLockMkr = getSaLockMkrCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      amount: MKR_TO_LOCK
    });

    // Call multicall with the lock MKR calldata
    const { result: resultMulticall } = renderHook(
      () =>
        useSaMulticall({
          calldata: [calldataLockMkr],
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall, LOADING_TIMEOUT);

    // Check Urn locked MKR equivalent amount
    const { result: resultMkrLocked } = renderHook(() => useVault(urnAddress), {
      wrapper
    });

    await waitFor(
      () => {
        expect(resultMkrLocked.current.data?.collateralAmount).toBe(
          (initialCollateralAmount || 0n) + MKR_TO_LOCK
        );
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Can unseal MKR that was previously locked', async () => {
    const { result: resultApproveMkr } = renderHook(
      () =>
        useSaMkrApprove({
          amount: MAX_UINT_256,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveMkr, LOADING_TIMEOUT);

    const calldataFreeMkr = getSaFreeMkrCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      toAddress: TEST_WALLET_ADDRESS,
      amount: MKR_TO_LOCK
    });

    // Call multicall with the free MKR calldata
    const { result: resultMulticall } = renderHook(
      () =>
        useSaMulticall({
          calldata: [calldataFreeMkr],
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall, LOADING_TIMEOUT);

    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);

    // Check Urn locked MKR equivalent amount
    const { result: resultMkrLocked } = renderHook(() => useVault(urnAddress), {
      wrapper
    });

    await waitFor(
      () => {
        // After freeing SKY, only the original MKR amount should remain
        expect(resultMkrLocked.current.data?.collateralAmount).toBe(MKR_TO_LOCK);
        return;
      },
      { timeout: 5000 }
    );

    // Check MKR balance was returned
    const { result: resultMkrBalance } = renderHook(
      () =>
        useTokenBalance({
          address: TEST_WALLET_ADDRESS,
          token: TOKENS.mkr.address[TENDERLY_CHAIN_ID],
          chainId: TENDERLY_CHAIN_ID
        }),
      {
        wrapper
      }
    );

    await waitFor(
      () => {
        // MKR balance has a 0% exit fee
        expect(resultMkrBalance.current.data?.value).toBe(parseEther('80'));
        return;
      },
      { timeout: 5000 }
    );
  });
});
