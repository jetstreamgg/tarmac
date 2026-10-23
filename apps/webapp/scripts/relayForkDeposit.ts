// Relays a native USDS deposit from the Tenderly Ethereum fork to a fork OP Stack L2
// (Base, OP, Unichain), playing the sequencer the forks lack. Dev mode only.
// Usage, from apps/webapp: node --env-file=.env scripts/relayForkDeposit.ts <base|optimism|unichain> <l1TxHash>
import { createPublicClient, http, keccak256, parseAbi, toHex, type Hash } from 'viem';
import { base, optimism, unichain } from 'viem/chains';
import { readOpStackDeposit, sendOpStackDeposit } from '../src/test/e2e/utils/opStackDepositRelay.ts';

const L2_RPC_ENV = {
  base: 'VITE_RPC_PROVIDER_TENDERLY_BASE',
  optimism: 'VITE_RPC_PROVIDER_TENDERLY_OPTIMISM',
  unichain: 'VITE_RPC_PROVIDER_TENDERLY_UNICHAIN'
} as const;
// The forks keep the mainnet addresses.
const PORTAL = { base, optimism, unichain } as const;

const messengerAbi = parseAbi(['function successfulMessages(bytes32) view returns (bool)']);
const FAILED_RELAY_TOPIC = keccak256(toHex('FailedRelayedMessage(bytes32)'));

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const [network, l1TxHash] = process.argv.slice(2) as [keyof typeof L2_RPC_ENV, Hash];
if (!(network in L2_RPC_ENV) || !/^0x[0-9a-fA-F]{64}$/.test(l1TxHash ?? ''))
  fail('Usage: node --env-file=.env scripts/relayForkDeposit.ts <base|optimism|unichain> <l1TxHash>');

const l1Rpc = process.env.VITE_RPC_PROVIDER_TENDERLY ?? fail('VITE_RPC_PROVIDER_TENDERLY is not set');
const l2Rpc = process.env[L2_RPC_ENV[network]] || fail(`${L2_RPC_ENV[network]} is not set`);
const l1 = createPublicClient({ transport: http(l1Rpc) });
const l2 = createPublicClient({ transport: http(l2Rpc) });

const receipt = await l1.getTransactionReceipt({ hash: l1TxHash });
if (receipt.status !== 'success') fail('The Ethereum deposit reverted; nothing to relay.');
const deposit = await readOpStackDeposit(l1, l1TxHash, PORTAL[network].contracts.portal[1].address).catch(
  () =>
    fail(
      `No TransactionDeposited log from the ${network} portal: not an OP Stack deposit, or sent to another L2.`
    )
);

// The deposit calls the L2 messenger's relayMessage, whose calldata hash is the message hash.
const relayed = await l2.readContract({
  address: deposit.to,
  abi: messengerAbi,
  functionName: 'successfulMessages',
  args: [keccak256(deposit.data)]
});
if (relayed) {
  console.log('Already relayed; nothing sent.');
  process.exit(0);
}

const relay = await sendOpStackDeposit(l2, l2Rpc, deposit).catch((error: Error) =>
  fail(`Nothing was relayed: ${error.message}`)
);
const failed = relay.logs.some(entry => entry.topics[0] === FAILED_RELAY_TOPIC);
console.log(failed ? 'Relayed, but the message failed on L2 (replayable from the app).' : 'Relayed.');
