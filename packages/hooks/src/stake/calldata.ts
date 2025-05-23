import { encodeFunctionData } from 'viem';
import { stakeModuleAbi } from '../generated';

export const getStakeOpenCalldata = ({ urnIndex }: { urnIndex: bigint }) =>
  encodeFunctionData({
    abi: stakeModuleAbi,
    functionName: 'open',
    args: [urnIndex]
  });

export const getStakeLockCalldata = ({
  ownerAddress,
  urnIndex,
  amount,
  refCode = 0
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
  amount: bigint;
  refCode?: number;
}) =>
  encodeFunctionData({
    abi: stakeModuleAbi,
    functionName: 'lock',
    args: [ownerAddress, urnIndex, amount, refCode]
  });

export const getStakeDrawCalldata = ({
  ownerAddress,
  urnIndex,
  toAddress,
  amount
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
  toAddress: `0x${string}`;
  amount: bigint;
}) =>
  encodeFunctionData({
    abi: stakeModuleAbi,
    functionName: 'draw',
    args: [ownerAddress, urnIndex, toAddress, amount]
  });

export const getStakeSelectRewardContractCalldata = ({
  ownerAddress,
  urnIndex,
  rewardContractAddress,
  refCode = 0
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
  rewardContractAddress: `0x${string}`;
  refCode?: number;
}) =>
  encodeFunctionData({
    abi: stakeModuleAbi,
    functionName: 'selectFarm',
    args: [ownerAddress, urnIndex, rewardContractAddress, refCode]
  });

export const getStakeSelectDelegateCalldata = ({
  ownerAddress,
  urnIndex,
  delegateAddress
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
  delegateAddress: `0x${string}`;
}) =>
  encodeFunctionData({
    abi: stakeModuleAbi,
    functionName: 'selectVoteDelegate',
    args: [ownerAddress, urnIndex, delegateAddress]
  });

export const getStakeFreeCalldata = ({
  ownerAddress,
  urnIndex,
  toAddress,
  amount
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
  toAddress: `0x${string}`;
  amount: bigint;
}) =>
  encodeFunctionData({
    abi: stakeModuleAbi,
    functionName: 'free',
    args: [ownerAddress, urnIndex, toAddress, amount]
  });

export const getStakeWipeCalldata = ({
  ownerAddress,
  urnIndex,
  amount
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
  amount: bigint;
}) =>
  encodeFunctionData({
    abi: stakeModuleAbi,
    functionName: 'wipe',
    args: [ownerAddress, urnIndex, amount]
  });

export const getStakeWipeAllCalldata = ({
  ownerAddress,
  urnIndex
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
}) =>
  encodeFunctionData({
    abi: stakeModuleAbi,
    functionName: 'wipeAll',
    args: [ownerAddress, urnIndex]
  });

export const getStakeGetRewardCalldata = ({
  ownerAddress,
  urnIndex,
  rewardContractAddress,
  toAddress
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
  rewardContractAddress: `0x${string}`;
  toAddress: `0x${string}`;
}) =>
  encodeFunctionData({
    abi: stakeModuleAbi,
    functionName: 'getReward',
    args: [ownerAddress, urnIndex, rewardContractAddress, toAddress]
  });

export const getStakeHopeCalldata = ({
  ownerAddress,
  urnIndex,
  usrAddress
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
  usrAddress: `0x${string}`;
}) =>
  encodeFunctionData({
    abi: stakeModuleAbi,
    functionName: 'hope',
    args: [ownerAddress, urnIndex, usrAddress]
  });

export const getStakeMulticallCalldata = ({ calldata }: { calldata: `0x${string}`[] }) =>
  encodeFunctionData({
    abi: stakeModuleAbi,
    functionName: 'multicall',
    args: [calldata]
  });
