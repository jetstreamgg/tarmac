import { describe, expect, it } from 'vitest';
import { GAS, TEST_WALLET_ADDRESS, WagmiWrapper } from '../../test';
import { renderHook, waitFor } from '@testing-library/react';
import { useStakeSkyApprove, useStakeUsdsApprove } from './useStakeApprove';
import { parseEther } from 'viem';
import { useCurrentUrnIndex } from './useCurrentUrnIndex';
import { useVault } from '../vaults/useVault';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { TENDERLY_CHAIN_ID } from '../constants';
import { getUrnAddress, waitForPreparedExecuteAndMine } from '../../test/helpers';
import { useStakeMulticall } from './useStakeMulticall';
import { TOKENS } from '../tokens/tokens.constants';
import {
  getStakeDrawCalldata,
  getStakeFreeCalldata,
  getStakeLockCalldata,
  getStakeOpenCalldata,
  getStakeSelectDelegateCalldata,
  getStakeSelectRewardContractCalldata,
  getStakeWipeAllCalldata
} from './calldata';
import { skyAddress, lsSkyUsdsRewardAddress } from '../generated';
import { useUrnSelectedRewardContract } from './useUrnSelectedRewardContract';
import { useUrnSelectedVoteDelegate } from './useUrnSelectedVoteDelegate';
import { setErc20Balance } from '../../test/utils';
import { MAX_UINT_256 } from '../../test/constants';
import { useRewardsSuppliedBalance } from '../rewards/useRewardsBalance';
import { useUrnAddress } from './useUrnAddress';
import { getIlkName } from '../vaults/helpers';
import { useStakeSkyAllowance } from './useStakeAllowance';
import { useBatchStakeMulticall } from './useBatchStakeMulticall';

describe('Stake Module Multicall tests', async () => {
  const wrapper = WagmiWrapper;
  const URN_INDEX = 0n;
  const skyToLockStr = '1200000';
  const SKY_TO_LOCK = parseEther(skyToLockStr);
  const USDS_TO_DRAW = parseEther('30000');
  const SELECTED_DELEGATE = '0x173a1c04b79ed9266721c1154daa29addc0b9558'; // BLUE
  const LOADING_TIMEOUT = 15000;
  const ILK_NAME = getIlkName(2);

  it('Should open, lock SKY, draw USDS, select a reward contract and a delegate in a single multicall transaction', async () => {
    // Set initial SKY balance
    await setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], skyToLockStr);

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
    const { result: resultApproveSky } = renderHook(
      () =>
        useStakeSkyApprove({
          amount: MAX_UINT_256,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveSky, LOADING_TIMEOUT);

    const { result: resultApproveUsds } = renderHook(
      () =>
        useStakeUsdsApprove({
          amount: MAX_UINT_256,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveUsds, LOADING_TIMEOUT);

    // Generate calldata for each operation
    const calldataOpen = getStakeOpenCalldata({ urnIndex: URN_INDEX });

    const calldataLockSky = getStakeLockCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      amount: SKY_TO_LOCK
    });

    const calldataDrawNst = getStakeDrawCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      toAddress: TEST_WALLET_ADDRESS,
      amount: USDS_TO_DRAW
    });

    const calldataSelectRewardContract = getStakeSelectRewardContractCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      rewardContractAddress: lsSkyUsdsRewardAddress[TENDERLY_CHAIN_ID]
    });

    const calldataSelectDelegate = getStakeSelectDelegateCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      delegateAddress: SELECTED_DELEGATE
    });

    // Call multicall with all the calldata
    const { result: resultMulticall } = renderHook(
      () =>
        useStakeMulticall({
          calldata: [
            calldataOpen,
            calldataLockSky,
            calldataDrawNst,
            calldataSelectRewardContract,
            calldataSelectDelegate
          ],
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

    // Check Urn locked SKY
    const { result: resultSkyLocked } = renderHook(() => useVault(urnAddress, ILK_NAME), {
      wrapper
    });

    await waitFor(
      () => {
        expect(resultSkyLocked.current.data?.collateralAmount).toBe(SKY_TO_LOCK);
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
        expect(resultUrnSelectedRewardContract.current.data).toBe(lsSkyUsdsRewardAddress[TENDERLY_CHAIN_ID]);
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
        expect(resultUrnSelectedDelegate.current.data?.toLowerCase()).toBe(SELECTED_DELEGATE.toLowerCase());
        return;
      },
      { timeout: 5000 }
    );

    // Check balance of reward contract
    const { result: resultRewardContractBalance } = renderHook(
      () =>
        useRewardsSuppliedBalance({
          address: urnAddress,
          contractAddress: lsSkyUsdsRewardAddress[TENDERLY_CHAIN_ID],
          chainId: TENDERLY_CHAIN_ID
        }),
      {
        wrapper
      }
    );

    await waitFor(
      () => {
        expect(resultRewardContractBalance.current.data).toBe(SKY_TO_LOCK);
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Can lock additional SKY in position', async () => {
    // Set initial SKY balance
    await setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], skyToLockStr);

    // Approve SKY
    const { result: resultApproveSky } = renderHook(
      () =>
        useStakeSkyApprove({
          amount: MAX_UINT_256,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveSky, LOADING_TIMEOUT);

    // First check the current collateral amount before adding SKY
    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);
    const { result: resultInitialLocked } = renderHook(() => useVault(urnAddress, ILK_NAME), {
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

    // Generate calldata for locking SKY
    const calldataLockSky = getStakeLockCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      amount: SKY_TO_LOCK
    });

    // Call multicall with the lock SKY calldata
    const { result: resultMulticall } = renderHook(
      () =>
        useStakeMulticall({
          calldata: [calldataLockSky],
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall, LOADING_TIMEOUT);

    // Check Urn locked SKY equivalent amount
    const { result: resultSkyLocked } = renderHook(() => useVault(urnAddress, ILK_NAME), {
      wrapper
    });

    await waitFor(
      () => {
        expect(resultSkyLocked.current.data?.collateralAmount).toBe(
          (initialCollateralAmount || 0n) + SKY_TO_LOCK
        );
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Can unstake SKY that was previously locked', async () => {
    // Approve SKY
    const { result: resultApproveSky } = renderHook(
      () =>
        useStakeSkyApprove({
          amount: MAX_UINT_256,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveSky, LOADING_TIMEOUT);

    const calldataFreeSky = getStakeFreeCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      toAddress: TEST_WALLET_ADDRESS,
      amount: SKY_TO_LOCK // Free the entire amount that was locked
    });

    // Call multicall with the free SKY calldata
    const { result: resultMulticall } = renderHook(
      () =>
        useStakeMulticall({
          calldata: [calldataFreeSky],
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall, LOADING_TIMEOUT);

    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);

    // Check Urn locked SKY equivalent amount
    const { result: resultSkyLocked } = renderHook(() => useVault(urnAddress), {
      wrapper
    });

    await waitFor(
      () => {
        // After freeing SKY, no balance should remain locked
        expect(resultSkyLocked.current.data?.collateralAmount).toBe(0n);
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
        // SKY balance is full since no exit fee applies
        expect(resultSkyBalance.current.data?.value).toBe(SKY_TO_LOCK);
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Should repay all debt and withdraw SKY in a single transaction', async () => {
    // Get calldata for wipe and free
    const calldataWipeAll = getStakeWipeAllCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX
    });
    const freeSkyCalldata = getStakeFreeCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      toAddress: TEST_WALLET_ADDRESS,
      amount: SKY_TO_LOCK
    });

    // Call multicall with all the calldata
    const { result: resultMulticall } = renderHook(
      () =>
        useStakeMulticall({
          calldata: [calldataWipeAll, freeSkyCalldata],
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall, LOADING_TIMEOUT);

    // Check users USDS and SKY balances
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

    const { result: resultSKYBalance } = renderHook(
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
        // User should have double the SKY balance since no exit fee applies and locked twice
        expect(resultSKYBalance.current.data?.value).toBe(SKY_TO_LOCK * 2n);
        return;
      },
      { timeout: 5000 }
    );

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
        // SKY balance is the full amount locked since there is no exit fee
        expect(resultSkyBalance.current.data?.value).toBe(SKY_TO_LOCK * 2n);
        return;
      },
      { timeout: 5000 }
    );
  });

  it('Batch - Can lock additional SKY in position', async () => {
    // Set initial SKY balance
    await setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], skyToLockStr);

    // Reset SKY allowance
    const { result: resultApproveSky } = renderHook(
      () =>
        useStakeSkyApprove({
          // Minimum allowance
          amount: 1n,
          gas: GAS
        }),
      {
        wrapper
      }
    );
    await waitForPreparedExecuteAndMine(resultApproveSky, LOADING_TIMEOUT);

    // Refetch SKY allowance
    const { result: resultAllowanceSky } = renderHook(() => useStakeSkyAllowance(TEST_WALLET_ADDRESS), {
      wrapper: WagmiWrapper
    });

    resultAllowanceSky.current.mutate();
    await waitFor(
      () => {
        expect(resultAllowanceSky.current.data).toEqual(1n);
        return;
      },
      { timeout: 15000 }
    );

    // First check the current collateral amount before adding SKY
    const urnAddress = await getUrnAddress(URN_INDEX, useUrnAddress);
    const { result: resultInitialLocked } = renderHook(() => useVault(urnAddress, ILK_NAME), {
      wrapper
    });
    resultInitialLocked.current.mutate();

    let initialCollateralAmount: bigint | undefined;
    await waitFor(
      () => {
        initialCollateralAmount = resultInitialLocked.current.data?.collateralAmount;
        expect(resultInitialLocked.current.isLoading).toBe(false);
        expect(initialCollateralAmount).toBe(0n);
        return;
      },
      { timeout: 5000 }
    );

    // Generate calldata for locking SKY
    const calldataLockSky = getStakeLockCalldata({
      ownerAddress: TEST_WALLET_ADDRESS,
      urnIndex: URN_INDEX,
      amount: SKY_TO_LOCK
    });

    // Call multicall with the lock SKY calldata
    const { result: resultMulticall } = renderHook(
      () =>
        useBatchStakeMulticall({
          calldata: [calldataLockSky],
          skyAmount: SKY_TO_LOCK,
          usdsAmount: 0n,
          gas: GAS
        }),
      { wrapper }
    );

    await waitForPreparedExecuteAndMine(resultMulticall, LOADING_TIMEOUT);

    // Check Urn locked SKY equivalent amount
    const { result: resultSkyLocked } = renderHook(() => useVault(urnAddress, ILK_NAME), {
      wrapper
    });
    resultSkyLocked.current.mutate();

    await waitFor(
      () => {
        expect(resultSkyLocked.current.data?.collateralAmount).toBe(
          (initialCollateralAmount || 0n) + SKY_TO_LOCK
        );
        return;
      },
      { timeout: 5000 }
    );
  });
});
