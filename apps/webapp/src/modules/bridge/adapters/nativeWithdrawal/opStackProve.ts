import { getAddress, isAddressEqual, type Address, type Client, type Log } from 'viem';
import { buildProveWithdrawal } from 'viem/op-stack';
import { getBridgeNetwork } from '../../model/networks';
import type { OpStackNetworkId } from '../nativeDeposit/contracts';
import type { ChainReader } from '../types';
import { disputeGameAbi, disputeGameFactoryAbi } from './contracts';
import { opStackProveCall, opStackWithdrawalMessage } from './opStack';
import { isSuperGameType, outputRoot, readPortalSystem } from './opStackStatus';

const uint = (value: string | undefined) => (value && /^\d+$/.test(value) ? BigInt(value) : undefined);

/**
 * The prove of a bridge's withdrawal, against the game the tracker picked
 * (routeData `gameIndex` and `l2BlockNumber`). The withdrawal is read from
 * the L2 receipt and must be the recorded one; the proof is built from the
 * L2's state at that block and must hash to the game's root claim, or
 * nothing is built: a stale pick or another chain's state never reaches the
 * wallet.
 */
export async function buildOpStackProve({
  l1,
  l2,
  network,
  logs,
  amount,
  recipient,
  routeData
}: {
  l1: ChainReader;
  /** Serves the L2's storage proofs. */
  l2: Client;
  network: OpStackNetworkId;
  logs: Log[];
  amount: bigint;
  recipient: Address;
  routeData: Record<string, string> | undefined;
}) {
  const message = opStackWithdrawalMessage(logs, network);
  if (!message || message.amount !== amount || !isAddressEqual(message.to, getAddress(recipient)))
    throw new Error("The withdrawal doesn't match this bridge.");
  const gameIndex = uint(routeData?.gameIndex);
  const l2BlockNumber = uint(routeData?.l2BlockNumber);
  if (gameIndex === undefined || l2BlockNumber === undefined)
    throw new Error('No dispute game covers the withdrawal yet.');

  const system = await readPortalSystem(l1, network);
  const [gameType, , game] = await l1.readContract({
    address: system.factory,
    abi: disputeGameFactoryAbi,
    functionName: 'gameAtIndex',
    args: [gameIndex]
  });
  if (gameType !== system.respectedGameType)
    throw new Error("The dispute game isn't one the portal accepts.");
  const claim = isSuperGameType(gameType)
    ? await l1.readContract({
        address: game,
        abi: disputeGameAbi,
        functionName: 'rootClaimByChainId',
        args: [BigInt(getBridgeNetwork(network).chainId!)]
      })
    : await l1.readContract({ address: game, abi: disputeGameAbi, functionName: 'rootClaim' });

  // The block is already resolved from a super root's timestamp, so viem proves it as a block number.
  const { outputRootProof, withdrawalProof } = await buildProveWithdrawal(l2, {
    withdrawal: message.withdrawal,
    game: { index: gameIndex, l2BlockNumber, usesSuperRoots: false } as never,
    chain: null
  } as never);
  if (outputRoot(outputRootProof) !== claim)
    throw new Error("The L2 state doesn't match the dispute game's root.");
  return opStackProveCall({
    network,
    withdrawal: message.withdrawal,
    disputeGameIndex: gameIndex,
    outputRootProof,
    withdrawalProof
  });
}
