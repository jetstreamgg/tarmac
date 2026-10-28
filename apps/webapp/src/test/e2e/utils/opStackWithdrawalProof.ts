import {
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  hexToBigInt,
  http,
  keccak256,
  parseAbi,
  toHex,
  type Address,
  type Hash,
  type Hex
} from 'viem';
import type { OpStackNetworkId } from '@/modules/bridge/adapters/nativeDeposit/contracts';
import { L1_USDS, OP_STACK_DEPOSIT } from '@/modules/bridge/adapters/nativeDeposit/contracts';
import { opStackWithdrawalMessage } from '@/modules/bridge/adapters/nativeWithdrawal/opStack';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';
import { forkRpc } from './opStackDepositRelay';
import { NetworkName } from './constants';

const portalAbi = parseAbi([
  'event WithdrawalProvenExtension1(bytes32 indexed withdrawalHash, address indexed proofSubmitter)',
  'function provenWithdrawals(bytes32, address) view returns (address disputeGameProxy, uint64 timestamp)',
  'function numProofSubmitters(bytes32) view returns (uint256)',
  'function proofMaturityDelaySeconds() view returns (uint256)',
  'function checkWithdrawal(bytes32, address) view'
]);

const escrowAbi = parseAbi([
  'function escrow() view returns (address)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)'
]);

// Storage layouts differ between portal versions, so slots are found by probing up to this one.
const MAX_SLOT = 120n;
const L1_BLOCK_SECONDS = 12n;
const DAY_BLOCKS = 7_200n;

const mappingSlot = (key: { type: 'bytes32' | 'address'; value: Hex }, slot: Hex | bigint) =>
  keccak256(
    encodeAbiParameters(
      [{ type: key.type }, { type: typeof slot === 'bigint' ? 'uint256' : 'bytes32' }],
      [key.value, slot]
    )
  );

/**
 * Plays the prover on the Ethereum fork, which never sees the L2 fork's state:
 * records `prover`'s matured proof of the withdrawal in `l2TxHash`, copying the
 * game and proof time of a real withdrawal proven a little over the maturity
 * delay ago, so the portal's own checkWithdrawal passes. Portal, messenger,
 * bridge and escrow then run for real on finalize.
 */
export async function proveOpStackWithdrawalOnFork(
  network: OpStackNetworkId,
  l2TxHash: Hash,
  prover: Address
): Promise<void> {
  const l1Rpc = await getRpcUrlFromFile(NetworkName.mainnet);
  const l1 = createPublicClient({ transport: http(l1Rpc) });
  const l2 = createPublicClient({ transport: http(await getRpcUrlFromFile(NetworkName[network])) });
  const portal = OP_STACK_DEPOSIT[network].portal;
  const receipt = await l2.getTransactionReceipt({ hash: l2TxHash });
  const message = opStackWithdrawalMessage(receipt.logs, network);
  if (!message) throw new Error(`No USDS withdrawal in ${l2TxHash}`);
  const { withdrawalHash } = message.withdrawal;

  const maturity = await l1.readContract({
    address: portal,
    abi: portalAbi,
    functionName: 'proofMaturityDelaySeconds'
  });
  const head = await l1.getBlockNumber();
  const matured = head - maturity / L1_BLOCK_SECONDS - 300n;
  const proofs = await l1.getLogs({
    address: portal,
    event: portalAbi[0],
    fromBlock: matured - 3n * DAY_BLOCKS,
    toBlock: matured
  });
  const setStorage = (slot: Hex, value: Hex) =>
    forkRpc(l1Rpc, 'tenderly_setStorageAt', [portal, slot, toHex(hexToBigInt(value), { size: 32 })]);

  for (const { args } of proofs.reverse()) {
    const [game, timestamp] = await l1.readContract({
      address: portal,
      abi: portalAbi,
      functionName: 'provenWithdrawals',
      args: [args.withdrawalHash!, args.proofSubmitter!]
    });
    const slots = await findProofSlots(l1, portal, args.withdrawalHash!, args.proofSubmitter!, game);
    const proven = mappingSlot(
      { type: 'address', value: prover },
      mappingSlot({ type: 'bytes32', value: withdrawalHash }, slots.proven)
    );
    await setStorage(proven, toHex((BigInt(timestamp) << 160n) | hexToBigInt(game)));
    const submitters = mappingSlot({ type: 'bytes32', value: withdrawalHash }, slots.submitters);
    await setStorage(submitters, toHex(1n));
    await setStorage(keccak256(submitters), prover);
    try {
      await l1.readContract({
        address: portal,
        abi: portalAbi,
        functionName: 'checkWithdrawal',
        args: [withdrawalHash, prover]
      });
      return;
    } catch {
      // That game can't finalize any more (retired or blacklisted): try an older proof's.
    }
  }
  throw new Error(`No finalizable game found on the ${network} portal`);
}

async function findProofSlots(
  l1: ReturnType<typeof createPublicClient>,
  portal: Address,
  withdrawalHash: Hex,
  submitter: Address,
  game: Address
): Promise<{ proven: bigint; submitters: bigint }> {
  const count = await l1.readContract({
    address: portal,
    abi: portalAbi,
    functionName: 'numProofSubmitters',
    args: [withdrawalHash]
  });
  let proven: bigint | undefined;
  let submitters: bigint | undefined;
  for (let slot = 0n; slot < MAX_SLOT && (proven === undefined || submitters === undefined); slot++) {
    const byHash = mappingSlot({ type: 'bytes32', value: withdrawalHash }, slot);
    const [entry, length] = await Promise.all([
      l1.getStorageAt({ address: portal, slot: mappingSlot({ type: 'address', value: submitter }, byHash) }),
      l1.getStorageAt({ address: portal, slot: byHash })
    ]);
    const mask = (1n << 160n) - 1n;
    if (proven === undefined && entry && (hexToBigInt(entry) & mask) === hexToBigInt(game)) proven = slot;
    if (submitters === undefined && length && count > 0n && hexToBigInt(length) === count) submitters = slot;
  }
  if (proven === undefined || submitters === undefined)
    throw new Error('Proof slots not found on the portal');
  return { proven, submitters };
}

/**
 * Sets the USDS the L1 bridge may pull from Sky's escrow, as the escrow on the Ethereum fork,
 * and returns the previous allowance. At 0 the bridge's release reverts, so the messenger
 * stores the finalized withdrawal's message as failed.
 */
export async function setOpStackEscrowAllowance(network: OpStackNetworkId, amount: bigint): Promise<bigint> {
  const l1Rpc = await getRpcUrlFromFile(NetworkName.mainnet);
  const l1 = createPublicClient({ transport: http(l1Rpc) });
  const bridge = OP_STACK_DEPOSIT[network].l1TokenBridge;
  const escrow = await l1.readContract({ address: bridge, abi: escrowAbi, functionName: 'escrow' });
  const previous = await l1.readContract({
    address: L1_USDS,
    abi: escrowAbi,
    functionName: 'allowance',
    args: [escrow, bridge]
  });
  const hash = await forkRpc<Hash>(l1Rpc, 'eth_sendTransaction', [
    {
      from: escrow,
      to: L1_USDS,
      data: encodeFunctionData({ abi: escrowAbi, functionName: 'approve', args: [bridge, amount] })
    }
  ]);
  const receipt = await l1.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('The escrow approve reverted');
  return previous;
}
