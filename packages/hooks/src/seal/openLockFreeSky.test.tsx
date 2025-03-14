import { describe, expect, it } from 'vitest';
import { GAS, TEST_WALLET_ADDRESS, WagmiWrapper } from '../../test';
import { renderHook, waitFor } from '@testing-library/react';
import { useSaNgtApprove, useSaNstApprove } from './useSaApprove';
import { parseEther } from 'viem';
import { useOpenUrn } from './useOpenUrn';
import { useVault } from '../vaults/useVault';
import { lsMkrUsdsRewardAddress, skyAddress, usdsAddress } from '../generated';
import { TENDERLY_CHAIN_ID } from '../constants';
import { setErc20Balance } from '../../test/utils';
import { useLockSky } from './useLockSky';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { useFreeSky } from './useFreeSky';
import { useDrawUsds } from './useDrawUsds';
import { useWipe } from './useWipe';
import { useWipeAll } from './useWipeAll';
import { getUrnAddress, waitForPreparedExecuteAndMine } from '../../test/helpers';
import { useSelectRewardContract } from './useSelectRewardContract';
import { useSelectVoteDelegate } from './useSelectVoteDelegate';
import { useUrnSelectedRewardContract } from './useUrnSelectedRewardContract';
import { useUrnSelectedVoteDelegate } from './useUrnSelectedVoteDelegate';
import { useCurrentUrnIndex } from './useCurrentUrnIndex';
import { useUrnAddress } from './useUrnAddress';

describe('Open position, lock SKY, withdraw USDS, repay USDS and free SKY', async () => {
  const wrapper = WagmiWrapper;
  const SKY_AMOUNT = '720000';
  const SKY_AMOUNT_AFTER_EXIT = '684000';
  const URN_INDEX = 1n; // Test account already has a URN open

  await Promise.all([
    setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], SKY_AMOUNT),
    setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '10000')
  ]);

  it('Should lock SKY', async () => {
    // Make sure URN_INDEX is correct
    const { result: resultUrnIndex } = renderHook(() => useCurrentUrnIndex(), { wrapper });

    await waitFor(
      () => {
        expect(resultUrnIndex.current.data).toEqual(URN_INDEX);
        return;
      },
      { timeout: 5000 }
    );

    // First open the Urn
    const { result: resultOpenUrn } = renderHook(() => useOpenUrn({ gas: GAS }), { wrapper });
    await waitForPreparedExecuteAndMine(resultOpenUrn);

    // Then lock SKY into the Seal Module
    // Approve token to lock
    const { result: resultApproveNgt } = renderHook(
      () =>
        useSaNgtApprove({
          amount: parseEther(SKY_AMOUNT),
          gas: GAS
        }),
      {
        wrapper
      }
    );

    await waitForPreparedExecuteAndMine(resultApproveNgt);

    // Lock SKY into the Seal Module
    const { result: resultLockNgt } = renderHook(
      () =>
        useLockSky({
          index: URN_INDEX,
          amount: parseEther(SKY_AMOUNT),
          gas: GAS
        }),
      {
        wrapper
      }
    );

    await waitForPreparedExecuteAndMine(resultLockNgt);

    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);

    // Check Urn locked MKR as that's the token that gets locked in the SA
    const { result: resultVaultInfo } = renderHook(() => useVault(urnAddress), {
      wrapper
    });

    await waitFor(
      () => {
        // Urn should have 30 MKR corresponding to 720000 SKY / 24000 SKY per MKR
        expect(resultVaultInfo.current.data?.collateralAmount).toBe(parseEther('30'));
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Should withdraw USDS', async () => {
    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);

    // Check max available USDS to withdraw
    const { result: resultVaultInfo } = renderHook(() => useVault(urnAddress), {
      wrapper
    });

    await waitFor(
      () => {
        expect(resultVaultInfo.current.data).toBeDefined();
        return;
      },
      { timeout: 5000 }
    );

    const NST_TO_WITHDRAW = resultVaultInfo.current.data?.maxSafeBorrowableIntAmount as bigint;

    const { result: resultDrawNst } = renderHook(
      () =>
        useDrawUsds({
          index: URN_INDEX,
          to: TEST_WALLET_ADDRESS,
          amount: NST_TO_WITHDRAW,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultDrawNst);

    // Check the user balance USDS after withdrawing
    const { result: resultNstBalance } = renderHook(
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

    // User should have at least the max safe withdrawable amount of USDS after withdrawing
    await waitFor(
      () => {
        expect(resultNstBalance.current.data?.value).toBeGreaterThanOrEqual(NST_TO_WITHDRAW);
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Should delegate and select reward contract', async () => {
    const TEST_DELEGATE = '0x278c4Cbf1726Af5a62f0bCe40B1ddC2ea784aA45';
    const TEST_REWARD_CONTRACT = lsMkrUsdsRewardAddress[TENDERLY_CHAIN_ID];

    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);

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
      () => useUrnSelectedVoteDelegate({ urn: urnAddress }),
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
      () => useUrnSelectedRewardContract({ urn: urnAddress }),
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

  it('Should repay USDS', async () => {
    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);

    // Get the amount of USDS that needs to be repaid
    const { result: resultVaultInfo } = renderHook(() => useVault(urnAddress), {
      wrapper
    });

    await waitFor(
      () => {
        expect(resultVaultInfo.current.data).toBeDefined();
        return;
      },
      { timeout: 5000 }
    );
    resultVaultInfo.current.mutate();
    await waitFor(
      () => {
        expect(resultVaultInfo.current.data).toBeDefined();
        return;
      },
      { timeout: 5000 }
    );
    await waitFor(
      () => {
        expect(resultVaultInfo.current.data?.debtValue).not.toEqual(0n);
        return;
      },
      { timeout: 5000 }
    );

    const NST_TO_REPAY = resultVaultInfo.current.data?.debtValue as bigint;

    // First approve USDS
    const { result: resultApproveNst } = renderHook(
      () =>
        useSaNstApprove({
          amount: NST_TO_REPAY * 10n,
          gas: GAS
        }),
      {
        wrapper
      }
    );

    await waitForPreparedExecuteAndMine(resultApproveNst);

    // Repay part of the USDS
    const { result: resultWipeNst } = renderHook(
      () =>
        useWipe({
          index: URN_INDEX,
          amount: 100000000000000000000n, // 100 wad to keep us above the dust limit
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultWipeNst);

    resultVaultInfo.current.mutate();
    await waitFor(
      () => {
        expect(resultVaultInfo.current.data).toBeDefined();
        return;
      },
      { timeout: 5000 }
    );
    await waitFor(
      () => {
        expect(resultVaultInfo.current.data?.debtValue).not.toEqual(0n);
        return;
      },
      { timeout: 5000 }
    );

    // Repay all the remaining USDS
    const { result: resultWipeAllNst } = renderHook(
      () =>
        useWipeAll({
          index: URN_INDEX,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultWipeAllNst);

    resultVaultInfo.current.mutate();
    await waitFor(
      () => {
        expect(resultVaultInfo.current.data).toBeDefined();
        return;
      },
      { timeout: 5000 }
    );
    await waitFor(
      () => {
        expect(resultVaultInfo.current.data?.debtValue).toEqual(0n);
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Should free SKY', async () => {
    // Check test address' SKY balance
    const { result: resultNgtBalanceBefore } = renderHook(
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

    await waitFor(
      () => {
        expect(resultNgtBalanceBefore.current.data?.formatted).toEqual('0');
        return;
      },
      { timeout: 5000 }
    );

    // Free SKY from the Seal Module
    const { result: resultFreeNgt } = renderHook(
      () =>
        useFreeSky({
          index: URN_INDEX,
          amount: parseEther(SKY_AMOUNT),
          gas: GAS
        }),
      {
        wrapper
      }
    );

    await waitForPreparedExecuteAndMine(resultFreeNgt);

    // Check test address' SKY balance after freeing
    const { result: resultNgtBalanceAfter } = renderHook(
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

    // User should have 684000 SKY after freeing 720000 due to the exit fee
    await waitFor(
      () => {
        expect(resultNgtBalanceAfter.current.data?.formatted).toEqual(SKY_AMOUNT_AFTER_EXIT);
        return;
      },
      { timeout: 5000 }
    );
  });
});
