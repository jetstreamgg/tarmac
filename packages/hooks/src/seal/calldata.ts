import { encodeFunctionData } from 'viem';
import { sealModuleAbi } from '../generated';

export const getSaOpenCalldata = ({ urnIndex }: { urnIndex: bigint }) =>
  encodeFunctionData({
    abi: sealModuleAbi,
    functionName: 'open',
    args: [urnIndex]
  });

export const getSaLockMkrCalldata = ({
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
    abi: sealModuleAbi,
    functionName: 'lock',
    args: [ownerAddress, urnIndex, amount, refCode]
  });

export const getSaLockSkyCalldata = ({
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
    abi: sealModuleAbi,
    functionName: 'lockSky',
    args: [ownerAddress, urnIndex, amount, refCode]
  });

export const getSaDrawCalldata = ({
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
    abi: sealModuleAbi,
    functionName: 'draw',
    args: [ownerAddress, urnIndex, toAddress, amount]
  });

export const getSaSelectRewardContractCalldata = ({
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
    abi: sealModuleAbi,
    functionName: 'selectFarm',
    args: [ownerAddress, urnIndex, rewardContractAddress, refCode]
  });

export const getSaSelectDelegateCalldata = ({
  ownerAddress,
  urnIndex,
  delegateAddress
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
  delegateAddress: `0x${string}`;
}) =>
  encodeFunctionData({
    abi: sealModuleAbi,
    functionName: 'selectVoteDelegate',
    args: [ownerAddress, urnIndex, delegateAddress]
  });

export const getSaFreeMkrCalldata = ({
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
    abi: sealModuleAbi,
    functionName: 'free',
    args: [ownerAddress, urnIndex, toAddress, amount]
  });

export const getSaWipeCalldata = ({
  ownerAddress,
  urnIndex,
  amount
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
  amount: bigint;
}) =>
  encodeFunctionData({
    abi: sealModuleAbi,
    functionName: 'wipe',
    args: [ownerAddress, urnIndex, amount]
  });

export const getSaWipeAllCalldata = ({
  ownerAddress,
  urnIndex
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
}) =>
  encodeFunctionData({
    abi: sealModuleAbi,
    functionName: 'wipeAll',
    args: [ownerAddress, urnIndex]
  });

export const getSaGetRewardCalldata = ({
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
    abi: sealModuleAbi,
    functionName: 'getReward',
    args: [ownerAddress, urnIndex, rewardContractAddress, toAddress]
  });

export const getSaHopeCalldata = ({
  ownerAddress,
  urnIndex,
  usrAddress
}: {
  ownerAddress: `0x${string}`;
  urnIndex: bigint;
  usrAddress: `0x${string}`;
}) =>
  encodeFunctionData({
    abi: sealModuleAbi,
    functionName: 'hope',
    args: [ownerAddress, urnIndex, usrAddress]
  });

export const getSaMulticallCalldata = ({ calldata }: { calldata: `0x${string}`[] }) =>
  encodeFunctionData({
    abi: sealModuleAbi,
    functionName: 'multicall',
    args: [calldata]
  });
