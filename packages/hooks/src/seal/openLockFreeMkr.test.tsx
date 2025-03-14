import { describe, expect, it } from 'vitest';
import { GAS, TEST_WALLET_ADDRESS, WagmiWrapper } from '../../test';
import { renderHook, waitFor } from '@testing-library/react';
import { useSaMkrApprove } from './useSaApprove';
import { parseEther } from 'viem';
import { useCurrentUrnIndex } from './useCurrentUrnIndex';
import { useOpenUrn } from './useOpenUrn';
import { useUrnAddress } from './useUrnAddress';
import { useLockMkr } from './useLockMkr';
import { useVault } from '../vaults/useVault';
import { useSelectVoteDelegate } from './useSelectVoteDelegate';
import { useUrnSelectedVoteDelegate } from './useUrnSelectedVoteDelegate';
import { useSelectRewardContract } from './useSelectRewardContract';
import { useUrnSelectedRewardContract } from './useUrnSelectedRewardContract';
import { useFreeMkr } from './useFreeMkr';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { lsMkrUsdsRewardAddress, mkrAddress } from '../generated';
import { TENDERLY_CHAIN_ID } from '../constants';
import { waitForPreparedExecuteAndMine } from '../../test/helpers';

describe('Open position, lock MKR, delegate, select reward contract and free MKR', async () => {
  const wrapper = WagmiWrapper;
  let URN_ADDRESS: `0x${string}`;
  const URN_INDEX = 1n; // Test account already has a URN open

  it('Should open urn', async () => {
    const { result: resultUrnIndex } = renderHook(() => useCurrentUrnIndex(), { wrapper });

    await waitFor(
      () => {
        expect(resultUrnIndex.current.data).toEqual(URN_INDEX);
        return;
      },
      { timeout: 5000 }
    );

    const { result: resultOpenUrn } = renderHook(() => useOpenUrn({ gas: GAS }), { wrapper });
    await waitForPreparedExecuteAndMine(resultOpenUrn);

    // If urn was open correctly, the new urn index should be 1
    const { result: resultNewUrnIndex } = renderHook(() => useCurrentUrnIndex(), { wrapper });

    await waitFor(
      () => {
        expect(resultNewUrnIndex.current.data).toEqual(URN_INDEX + 1n);
        return;
      },
      { timeout: 5000 }
    );

    const { result: resultUrnAddress } = renderHook(() => useUrnAddress(URN_INDEX), { wrapper });

    await waitFor(
      () => {
        expect(resultUrnAddress.current.data).toBeDefined();
        return;
      },
      { timeout: 5000 }
    );

    // Set the urn address value for future tests
    URN_ADDRESS = resultUrnAddress.current.data as `0x${string}`;
  });

  it('Should lock MKR', async () => {
    // Approve token to lock
    const { result: resultApproveMkr } = renderHook(
      () =>
        useSaMkrApprove({
          amount: parseEther('10'),
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveMkr);

    // Lock MKR into the Seal Module
    const { result: resultLockMkr } = renderHook(
      () =>
        useLockMkr({
          index: URN_INDEX,
          amount: parseEther('10'),
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultLockMkr);

    // Check Urn locked MKR
    const { result: resultVaultInfo } = renderHook(() => useVault(URN_ADDRESS), {
      wrapper
    });

    await waitFor(
      () => {
        expect(resultVaultInfo.current.data?.collateralAmount).toBe(parseEther('10'));
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Should delegate and select reward contract', async () => {
    const TEST_DELEGATE = '0x278c4Cbf1726Af5a62f0bCe40B1ddC2ea784aA45';
    const TEST_REWARD_CONTRACT = lsMkrUsdsRewardAddress[TENDERLY_CHAIN_ID];

    // Select delegate
    const { result: resultSelectDelegate } = renderHook(
      () =>
        useSelectVoteDelegate({
          index: URN_INDEX,
          voteDelegate: TEST_DELEGATE,
          gas: GAS
        }),
      { wrapper }
    );
    await waitForPreparedExecuteAndMine(resultSelectDelegate);

    // Check selected delegate
    const { result: resultUrnSelectedDelegate } = renderHook(
      () => useUrnSelectedVoteDelegate({ urn: URN_ADDRESS }),
      { wrapper }
    );
    await waitFor(
      () => {
        expect(resultUrnSelectedDelegate.current.data).toBe(TEST_DELEGATE);
        return;
      },
      { timeout: 5000 }
    );

    // Select reward contract
    const { result: resultSelectRewardContract } = renderHook(
      () =>
        useSelectRewardContract({
          index: URN_INDEX,
          rewardContract: TEST_REWARD_CONTRACT,
          gas: GAS
        }),
      { wrapper }
    );
    await waitForPreparedExecuteAndMine(resultSelectRewardContract);

    // Check selected reward contract
    const { result: resultUrnSelectedRewardContract } = renderHook(
      () => useUrnSelectedRewardContract({ urn: URN_ADDRESS }),
      {
        wrapper
      }
    );
    await waitFor(
      () => {
        expect(resultUrnSelectedRewardContract.current.data).toBe(TEST_REWARD_CONTRACT);
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Should free MKR', async () => {
    // Check test address' MKR balance
    const { result: resultMkrBalanceBefore } = renderHook(
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

    await waitFor(
      () => {
        expect(resultMkrBalanceBefore.current.data?.formatted).toEqual('90');
        return;
      },
      { timeout: 5000 }
    );

    // Free MKR from the Seal Module
    const { result: resultFreeMkr } = renderHook(
      () =>
        useFreeMkr({
          index: URN_INDEX,
          amount: parseEther('10'),
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultFreeMkr);

    // Check test address' MKR balance after freeing
    const { result: resultMkrBalanceAfter } = renderHook(
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

    // User should have 99.5 MKR after freeing 10 due to the exit fee
    await waitFor(
      () => {
        expect(resultMkrBalanceAfter.current.data?.formatted).toEqual('99.5');
        return;
      },
      { timeout: 5000 }
    );
  });
});
