import { describe, expect, it } from 'vitest';
import { GAS, TEST_WALLET_ADDRESS, WagmiWrapper } from '../../test';
import { renderHook, waitFor } from '@testing-library/react';
import { useSaMkrApprove, useSaNgtApprove, useSaNstApprove } from './useSaApprove';
import { parseEther } from 'viem';
import { useCurrentUrnIndex } from './useCurrentUrnIndex';
import { useVault } from '../vaults/useVault';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { TENDERLY_CHAIN_ID } from '../constants';
import { getUrnAddress, waitForPreparedExecuteAndMine } from '../../test/helpers';
import { useSaMulticall } from './useSaMulticall';
import { TOKENS } from '../tokens/tokens.constants';
import {
  getSaDrawCalldata,
  getSaFreeMkrCalldata,
  getSaFreeSkyCalldata,
  getSaLockMkrCalldata,
  getSaLockSkyCalldata,
  getSaOpenCalldata,
  getSaSelectDelegateCalldata,
  getSaSelectRewardContractCalldata,
  getSaWipeAllCalldata
} from './calldata';
import { skyAddress, lsMkrUsdsRewardAddress } from '../generated';
import { useUrnSelectedRewardContract } from './useUrnSelectedRewardContract';
import { useUrnSelectedVoteDelegate } from './useUrnSelectedVoteDelegate';
import { setErc20Balance } from '../../test/utils';
import { MAX_UINT_256 } from '../../test/constants';
import { useRewardsSuppliedBalance } from '../rewards/useRewardsBalance';
import { useUrnAddress } from './useUrnAddress';

describe('Seal Module Multicall tests', async () => {
  const wrapper = WagmiWrapper;
  const URN_INDEX = 1n; // Test account already has a URN open
  const MKR_TO_LOCK = parseEther('20');
  const USDS_TO_DRAW = parseEther('10000');
  const SKY_TO_LOCK = parseEther('480000');
  const SELECTED_DELEGATE = '0x278c4Cbf1726Af5a62f0bCe40B1ddC2ea784aA45';

  it('Should open, lock MKR, draw USDS, select a reward contract and a delegate in a single multicall transaction', async () => {
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
    await waitForPreparedExecuteAndMine(resultApproveMkr);

    const { result: resultApproveUsds } = renderHook(
      () =>
        useSaNstApprove({
          amount: MAX_UINT_256,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveUsds);

    // Generate calldata for each operation
    const calldataOpen = getSaOpenCalldata({ urnIndex: URN_INDEX });

    const calldataLockMkr = getSaLockMkrCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      amount: MKR_TO_LOCK
    });

    const calldataDrawNst = getSaDrawCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      toAddress: TEST_WALLET_ADDRESS,
      amount: USDS_TO_DRAW
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
          calldata: [
            calldataOpen,
            calldataLockMkr,
            calldataDrawNst,
            calldataSelectRewardContract,
            calldataSelectDelegate
          ],
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall);

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

    // Check USDS drawn
    const { result: resultUSDSBalance } = renderHook(
      () =>
        useTokenBalance({
          address: TEST_WALLET_ADDRESS,
          token: TOKENS.usds.address[TENDERLY_CHAIN_ID],
          chainId: TENDERLY_CHAIN_ID
        }),
      {
        wrapper
      }
    );

    await waitFor(
      () => {
        // Test account already has 100 USDS
        expect(resultUSDSBalance.current.data?.value).toBe(USDS_TO_DRAW + parseEther('100'));
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

  it('Can lock additional SKY in position', async () => {
    // Set initial SKY balance
    await setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], '480000');

    // Approve SKY
    const { result: resultApproveSky } = renderHook(
      () =>
        useSaNgtApprove({
          amount: MAX_UINT_256,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveSky);

    // Generate calldata for locking SKY
    const calldataLockSky = getSaLockSkyCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      amount: SKY_TO_LOCK
    });

    // Call multicall with the lock SKY calldata
    const { result: resultMulticall } = renderHook(
      () =>
        useSaMulticall({
          calldata: [calldataLockSky],
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall);

    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);

    // Check Urn locked MKR equivalent amount
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
  });

  it('Can unseal SKY that was previously locked', async () => {
    // Approve SKY
    const { result: resultApproveSky } = renderHook(
      () =>
        useSaNgtApprove({
          amount: MAX_UINT_256,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveSky);

    const calldataFreeSky = getSaFreeSkyCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      toAddress: TEST_WALLET_ADDRESS,
      amount: SKY_TO_LOCK // Free the entire amount that was locked
    });

    // Call multicall with the free SKY calldata
    const { result: resultMulticall } = renderHook(
      () =>
        useSaMulticall({
          calldata: [calldataFreeSky],
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall);

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

    // Check SKY balance was returned (minus exit fee)
    const { result: resultSkyBalance } = renderHook(
      () =>
        useTokenBalance({
          address: TEST_WALLET_ADDRESS,
          token: TOKENS.sky.address[TENDERLY_CHAIN_ID],
          chainId: TENDERLY_CHAIN_ID
        }),
      {
        wrapper
      }
    );

    await waitFor(
      () => {
        // SKY balance reflects the 5% exit fee
        expect(resultSkyBalance.current.data?.value).toBe(parseEther('456000')); // 480000 - 5%
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Can lock both MKR and SKY in a single tx', async () => {
    // Equivalent of 20 MKR
    await setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], '480000');

    const calldataLockMkr = getSaLockMkrCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      amount: MKR_TO_LOCK
    });
    const calldataLockSky = getSaLockSkyCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      amount: SKY_TO_LOCK
    });

    const { result: resultMulticall } = renderHook(
      () =>
        useSaMulticall({
          calldata: [calldataLockMkr, calldataLockSky],
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall);

    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);

    // Check Urn locked MKR
    const { result: resultMkrLocked } = renderHook(() => useVault(urnAddress), {
      wrapper
    });

    await waitFor(
      () => {
        // Collateral amount is denominated in MKR.
        expect(resultMkrLocked.current.data?.collateralAmount).toBe(MKR_TO_LOCK * 3n);
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Should free MKR and SKY in different amounts than originally locked in a single transaction', async () => {
    const { result: resultApproveSky } = renderHook(
      () =>
        useSaNgtApprove({
          amount: MAX_UINT_256,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveSky);

    const freeMkrCalldata = getSaFreeMkrCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      toAddress: TEST_WALLET_ADDRESS,
      amount: parseEther('10')
    });

    const freeSkyCalldata = getSaFreeSkyCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      toAddress: TEST_WALLET_ADDRESS,
      amount: parseEther('720000')
    });

    // Call multicall with all the calldata
    const { result: resultMulticall } = renderHook(
      () =>
        useSaMulticall({
          calldata: [freeMkrCalldata, freeSkyCalldata],
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall);

    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);

    // check balance
    const { result: resultMkrLocked } = renderHook(() => useVault(urnAddress), {
      wrapper
    });

    await waitFor(
      () => {
        // Balance is back to original lock amount
        expect(resultMkrLocked.current.data?.collateralAmount).toBe(MKR_TO_LOCK);
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Should repay all debt and withdraw MKR in a single transaction', async () => {
    // Get calldata for wipe and free
    const calldataWipeAll = getSaWipeAllCalldata({ ownerAddress: TEST_WALLET_ADDRESS, urnIndex: URN_INDEX });
    const freeMkrCalldata = getSaFreeMkrCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      toAddress: TEST_WALLET_ADDRESS,
      amount: MKR_TO_LOCK
    });

    // Call multicall with all the calldata
    const { result: resultMulticall } = renderHook(
      () =>
        useSaMulticall({
          calldata: [calldataWipeAll, freeMkrCalldata],
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall);

    // Check users USDS and MKR balances
    const { result: resultUSDSBalance } = renderHook(
      () =>
        useTokenBalance({
          address: TEST_WALLET_ADDRESS,
          token: TOKENS.usds.address[TENDERLY_CHAIN_ID],
          chainId: TENDERLY_CHAIN_ID
        }),
      {
        wrapper
      }
    );

    await waitFor(
      () => {
        // Amount is less than the user started with due to stability fee
        const expectedValue = parseEther('100');
        const actualValue = resultUSDSBalance.current.data?.value;
        const isWithinRange = actualValue === expectedValue - 1n || actualValue === expectedValue - 2n;
        expect(isWithinRange).toBe(true);
        return;
      },
      { timeout: 5000 }
    );

    const { result: resultMKRBalance } = renderHook(
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
        // MKR balance reflects the 5% exit fee
        expect(resultMKRBalance.current.data?.value).toBe(parseEther('88.5'));
        return;
      },
      { timeout: 5000 }
    );

    const { result: resultNGTBalance } = renderHook(
      () =>
        useTokenBalance({
          address: TEST_WALLET_ADDRESS,
          token: TOKENS.sky.address[TENDERLY_CHAIN_ID],
          chainId: TENDERLY_CHAIN_ID
        }),
      {
        wrapper
      }
    );

    await waitFor(
      () => {
        // SKY balance reflects the 5% exit fee
        expect(resultNGTBalance.current.data?.value).toBe(parseEther('684000'));
        return;
      },
      { timeout: 5000 }
    );
  });
});
