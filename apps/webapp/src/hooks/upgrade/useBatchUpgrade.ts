import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHookParams } from '../hooks';
import {
  daiUsdsAbi,
  daiUsdsAddress,
  mcdDaiAddress,
  mkrAddress,
  mkrSkyAbi,
  mkrSkyAddress
} from '../generated';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { ApproveThenActHook, useApproveThenAct } from '../shared/useApproveThenAct';

/** The two upgradeable source tokens; each has a fixed upgrader + target. */
export type UpgradeSourceToken = 'DAI' | 'MKR';

/**
 * The standalone upgrade flow (DAI→USDS via `daiToUsds`, MKR→SKY via
 * `mkrToSky`): optional approve → upgrade.
 */
export function useBatchUpgrade({
  token,
  amount,
  enabled = true,
  ...flow
}: BatchWriteHookParams & {
  token: UpgradeSourceToken;
  amount: bigint;
}): ApproveThenActHook {
  const { address } = useConnection();
  const chainId = useChainId();

  const isDai = token === 'DAI';
  const source = isDai
    ? mcdDaiAddress[chainId as keyof typeof mcdDaiAddress]
    : mkrAddress[chainId as keyof typeof mkrAddress];
  const upgrader = isDai
    ? daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
    : mkrSkyAddress[chainId as keyof typeof mkrSkyAddress];

  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: source,
    owner: address,
    spender: upgrader
  });

  // The upgrade call is built only once an address exists: the upgrade modal
  // opens while disconnected, and an `undefined` recipient in the args makes
  // consumers that encode the calldata during render (e.g. useNetworkFee's
  // calls key) throw viem's InvalidAddressError.
  const upgradeCall = !address
    ? []
    : [
        isDai
          ? getWriteContractCall({
              to: upgrader,
              abi: daiUsdsAbi,
              functionName: 'daiToUsds',
              args: [address, amount]
            })
          : getWriteContractCall({
              to: upgrader,
              abi: mkrSkyAbi,
              functionName: 'mkrToSky',
              args: [address, amount]
            })
      ];

  return useApproveThenAct({
    ...flow,
    chainId,
    enabled: enabled && amount !== 0n,
    legs: [
      {
        approve: { token: source, spender: upgrader, amount, allowance, allowanceError },
        calls: upgradeCall
      }
    ]
  });
}
