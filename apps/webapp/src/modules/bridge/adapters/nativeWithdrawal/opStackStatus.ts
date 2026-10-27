import {
  BaseError,
  ContractFunctionRevertedError,
  encodeAbiParameters,
  keccak256,
  zeroHash,
  type Address,
  type Hex
} from 'viem';
import { getBridgeNetwork } from '../../model/networks';
import { OP_STACK_DEPOSIT, type OpStackNetworkId } from '../nativeDeposit/contracts';
import type { ChainReader } from '../types';
import {
  anchorStateRegistryAbi,
  disputeGameAbi,
  disputeGameFactoryAbi,
  L2_TO_L1_MESSAGE_PASSER,
  optimismPortalAbi
} from './contracts';

/** Super root games prove a timestamp across chains: their root is read per chain id (OP Mainnet, Unichain). */
const SUPER_GAME_TYPES = [4, 5, 7, 9, 10];
export const isSuperGameType = (gameType: number) => SUPER_GAME_TYPES.includes(gameType);

/** GameStatus.CHALLENGER_WINS: the game's root was proven wrong. */
const CHALLENGER_WINS = 1;
/** How many of the newest respected games the picker looks through. */
const GAME_SEARCH_SIZE = 50n;
/** How many of the newest proofs are read: anyone can prove a withdrawal, any number of times. */
const PROVER_READ_LIMIT = 10n;
/** The proxy's fallback upstream serves storage proofs this far back (Base and OP Mainnet ~7 days). */
export const PROOF_WINDOW_SECONDS = 6n * 24n * 60n * 60n;

/** The portal's view of the fault proof system, read at runtime: an upgrade can change any of it. */
export type PortalSystem = {
  portal: Address;
  factory: Address;
  registry: Address;
  respectedGameType: number;
  maturitySeconds: bigint;
  finalitySeconds: bigint;
  paused: boolean;
};

export async function readPortalSystem(l1: ChainReader, network: OpStackNetworkId): Promise<PortalSystem> {
  const { portal } = OP_STACK_DEPOSIT[network];
  const read = <
    name extends 'disputeGameFactory' | 'anchorStateRegistry' | 'proofMaturityDelaySeconds' | 'paused'
  >(
    functionName: name
  ) => l1.readContract({ address: portal, abi: optimismPortalAbi, functionName });
  const [factory, registry, maturitySeconds, paused] = await Promise.all([
    read('disputeGameFactory'),
    read('anchorStateRegistry'),
    read('proofMaturityDelaySeconds'),
    read('paused')
  ]);
  const [respectedGameType, finalitySeconds] = await Promise.all([
    l1.readContract({ address: registry, abi: anchorStateRegistryAbi, functionName: 'respectedGameType' }),
    l1.readContract({
      address: registry,
      abi: anchorStateRegistryAbi,
      functionName: 'disputeGameFinalityDelaySeconds'
    })
  ]);
  return { portal, factory, registry, respectedGameType, maturitySeconds, finalitySeconds, paused };
}

/** The custom error a contract call reverted with; undefined for any other failure (an RPC error). */
export const revertName = (error: unknown): string | undefined =>
  error instanceof BaseError
    ? (
        error.walk(
          cause => cause instanceof ContractFunctionRevertedError
        ) as ContractFunctionRevertedError | null
      )?.data?.errorName
    : undefined;

export type ProofState =
  /** `checkWithdrawal` passes: the withdrawal finalizes with this prover's proof. */
  | { kind: 'finalizable'; prover: Address }
  /** A valid proof, waiting for its maturity delay and its game's finality, around `etaAt` (ms). */
  | { kind: 'maturing'; prover: Address; etaAt: number }
  /** The proof can never finalize: its game lost, was blacklisted or retired. */
  | { kind: 'invalid'; prover: Address }
  | { kind: 'finalized' };

const readGame = <
  name extends
    'status' | 'createdAt' | 'resolvedAt' | 'expectedResolution' | 'maxClockDuration' | 'l2SequenceNumber'
>(
  l1: ChainReader,
  game: Address,
  functionName: name
) => l1.readContract({ address: game, abi: disputeGameAbi, functionName });

/** When a game's root becomes valid for finalizing, in seconds: its resolution plus the finality delay. */
async function gameValidAt(l1: ChainReader, system: PortalSystem, game: Address): Promise<bigint> {
  const resolvedAt = await readGame(l1, game, 'resolvedAt');
  if (resolvedAt > 0n) return resolvedAt + system.finalitySeconds;
  // Base's games say when they resolve; a fault game resolves once its root's clock runs out.
  const resolution = isSuperGameType(system.respectedGameType)
    ? (await readGame(l1, game, 'createdAt')) + (await readGame(l1, game, 'maxClockDuration'))
    : await readGame(l1, game, 'expectedResolution');
  return resolution + system.finalitySeconds;
}

/**
 * Where one prover's proof of a withdrawal stands. `checkWithdrawal` decides
 * finalizable; otherwise the proof's game decides between invalid (lost, or
 * no longer proper while nothing is paused) and maturing. Any other failure
 * throws: unknown is never terminal.
 */
export async function readProofState(
  l1: ChainReader,
  system: PortalSystem,
  withdrawalHash: Hex,
  prover: Address
): Promise<ProofState | undefined> {
  try {
    await l1.readContract({
      address: system.portal,
      abi: optimismPortalAbi,
      functionName: 'checkWithdrawal',
      args: [withdrawalHash, prover]
    });
    return { kind: 'finalizable', prover };
  } catch (error) {
    const name = revertName(error);
    if (name === 'OptimismPortal_AlreadyFinalized') return { kind: 'finalized' };
    if (name === 'OptimismPortal_Unproven') return undefined;
    if (name === 'OptimismPortal_InvalidProofTimestamp') return { kind: 'invalid', prover };
    if (name !== 'OptimismPortal_ProofNotOldEnough' && name !== 'OptimismPortal_InvalidRootClaim')
      throw error;
  }
  const [game, provenAt] = await l1.readContract({
    address: system.portal,
    abi: optimismPortalAbi,
    functionName: 'provenWithdrawals',
    args: [withdrawalHash, prover]
  });
  const [status, proper, registryPaused] = await Promise.all([
    readGame(l1, game, 'status'),
    l1.readContract({
      address: system.registry,
      abi: anchorStateRegistryAbi,
      functionName: 'isGameProper',
      args: [game]
    }),
    l1.readContract({ address: system.registry, abi: anchorStateRegistryAbi, functionName: 'paused' })
  ]);
  // A pause makes every game improper for a while; it invalidates nothing.
  if (status === CHALLENGER_WINS || (!proper && !registryPaused && !system.paused))
    return { kind: 'invalid', prover };
  const validAt = await gameValidAt(l1, system, game);
  const matureAt = provenAt + system.maturitySeconds;
  // The portal needs both strictly past.
  const etaAt = Number((matureAt > validAt ? matureAt : validAt) + 1n) * 1000;
  return { kind: 'maturing', prover, etaAt };
}

/** The wallets that proved the withdrawal most recently, oldest first. */
export async function readProvers(
  l1: ChainReader,
  system: PortalSystem,
  withdrawalHash: Hex
): Promise<Address[]> {
  const count = await l1.readContract({
    address: system.portal,
    abi: optimismPortalAbi,
    functionName: 'numProofSubmitters',
    args: [withdrawalHash]
  });
  const first = count > PROVER_READ_LIMIT ? count - PROVER_READ_LIMIT : 0n;
  return Promise.all(
    Array.from({ length: Number(count - first) }, (_, index) =>
      l1.readContract({
        address: system.portal,
        abi: optimismPortalAbi,
        functionName: 'proofSubmitters',
        args: [withdrawalHash, first + BigInt(index)]
      })
    )
  );
}

/** The version 0 output root a game claims and a prove's output root proof hashes to. */
export const outputRoot = (proof: {
  version: Hex;
  stateRoot: Hex;
  messagePasserStorageRoot: Hex;
  latestBlockhash: Hex;
}) =>
  keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }],
      [proof.version, proof.stateRoot, proof.messagePasserStorageRoot, proof.latestBlockhash]
    )
  );

/** The L2's own output root at a block; undefined when the reader can't serve storage proofs. */
async function l2OutputRoot(l2: ChainReader, blockNumber: bigint): Promise<Hex | undefined> {
  if (!l2.getProof) return undefined;
  const [block, proof] = await Promise.all([
    l2.getBlock({ blockNumber }),
    l2.getProof({ address: L2_TO_L1_MESSAGE_PASSER, storageKeys: [], blockNumber })
  ]);
  if (!block.hash) return undefined;
  return outputRoot({
    version: zeroHash,
    stateRoot: block.stateRoot,
    messagePasserStorageRoot: proof.storageHash,
    latestBlockhash: block.hash
  });
}

/** The game a prove uses: its factory index, and the L2 block whose state its root commits to. */
export type ProveGame = { index: bigint; game: Address; l2BlockNumber: bigint; usesSuperRoots: boolean };

/**
 * The oldest of the newest respected games that covers the withdrawal and a
 * prove can use: not lost, still proper, created before now, recent enough
 * for the proxy to serve its L2 state, and claiming the L2's own output root
 * (a wrong root would revert the prove). Anyone can create a game for any L2
 * block in any order, so every one is read, and a game that fails a read is
 * skipped. A super root game's L2 block is found from its timestamp with the
 * chain's fixed block time, and checked. Undefined while no game covers it.
 */
export async function pickProveGame({
  l1,
  l2,
  network,
  system,
  withdrawalBlock,
  now
}: {
  l1: ChainReader;
  l2: ChainReader;
  network: OpStackNetworkId;
  system: PortalSystem;
  withdrawalBlock: { number: bigint; timestamp: bigint };
  now: number;
}): Promise<ProveGame | undefined> {
  const usesSuperRoots = isSuperGameType(system.respectedGameType);
  const count = await l1.readContract({
    address: system.factory,
    abi: disputeGameFactoryAbi,
    functionName: 'gameCount'
  });
  if (count === 0n) return undefined;
  // Newest first.
  const games = await l1.readContract({
    address: system.factory,
    abi: disputeGameFactoryAbi,
    functionName: 'findLatestGames',
    args: [system.respectedGameType, count - 1n, count < GAME_SEARCH_SIZE ? count : GAME_SEARCH_SIZE]
  });
  const proxy = (metadata: Hex) => `0x${metadata.slice(26)}` as Address;
  const sequences = await Promise.all(
    games.map(({ metadata }) => readGame(l1, proxy(metadata), 'l2SequenceNumber').catch(() => undefined))
  );
  const target = usesSuperRoots ? withdrawalBlock.timestamp : withdrawalBlock.number;
  const head = await l2.getBlock();
  const nowSeconds = BigInt(Math.floor(now / 1000));
  const chainId = BigInt(getBridgeNetwork(network).chainId!);

  const usable = async (i: number, l2Sequence: bigint): Promise<ProveGame | undefined> => {
    const game = proxy(games[i].metadata);
    if (usesSuperRoots && head.timestamp - l2Sequence > PROOF_WINDOW_SECONDS) return undefined;
    const [status, createdAt, proper] = await Promise.all([
      readGame(l1, game, 'status'),
      readGame(l1, game, 'createdAt'),
      l1.readContract({
        address: system.registry,
        abi: anchorStateRegistryAbi,
        functionName: 'isGameProper',
        args: [game]
      })
    ]);
    if (status === CHALLENGER_WINS || !proper || createdAt >= nowSeconds) return undefined;
    const l2BlockNumber = usesSuperRoots ? await blockAtTimestamp(l2, head, l2Sequence) : l2Sequence;
    if (l2BlockNumber === undefined) return undefined;
    if (!usesSuperRoots) {
      const block = await l2.getBlock({ blockNumber: l2BlockNumber });
      if (head.timestamp - block.timestamp > PROOF_WINDOW_SECONDS) return undefined;
    }
    const claim = usesSuperRoots
      ? await l1.readContract({
          address: game,
          abi: disputeGameAbi,
          functionName: 'rootClaimByChainId',
          args: [chainId]
        })
      : games[i].rootClaim;
    if ((await l2OutputRoot(l2, l2BlockNumber)) !== claim) return undefined;
    return { index: games[i].index, game, l2BlockNumber, usesSuperRoots };
  };

  // Oldest first: the oldest one finalizes first.
  for (let i = games.length - 1; i >= 0; i--) {
    const l2Sequence = sequences[i];
    if (l2Sequence === undefined || l2Sequence < target) continue;
    const picked = await usable(i, l2Sequence).catch(() => undefined);
    if (picked) return picked;
  }
  return undefined;
}

/** The L2 block at exactly `timestamp`, from the head and the chain's block time; undefined if it isn't one. */
async function blockAtTimestamp(
  l2: ChainReader,
  head: { number: bigint; timestamp: bigint },
  timestamp: bigint
): Promise<bigint | undefined> {
  if (timestamp > head.timestamp) return undefined;
  const parent = await l2.getBlock({ blockNumber: head.number - 1n });
  const blockTime = head.timestamp - parent.timestamp;
  if (blockTime <= 0n || (head.timestamp - timestamp) % blockTime !== 0n) return undefined;
  const number = head.number - (head.timestamp - timestamp) / blockTime;
  const block = await l2.getBlock({ blockNumber: number });
  return block.timestamp === timestamp ? number : undefined;
}
