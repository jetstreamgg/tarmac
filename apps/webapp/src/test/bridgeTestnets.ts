/**
 * Plays the parts nobody plays on the bridge's Tenderly testnets, which no
 * sequencer, relayer or Circle attester watches.
 *
 *   pnpm bridge-testnets setup                 lets the Ethereum testnet accept the app's test CCTP attestations
 *   pnpm bridge-testnets fund <address> [usds] gives <address> ETH and USDS (default 1000) on every testnet
 *   pnpm bridge-testnets relay <txHash>        delivers an Ethereum deposit to Base, OP Mainnet or Unichain
 *
 * Each needs the testnets' admin RPCs (public ones refuse impersonated sends):
 * BRIDGE_TESTNET_ADMIN_RPC_{MAINNET,BASE,ARBITRUM,OPTIMISM,UNICHAIN} in apps/webapp/.env.
 * Deposits to Arbitrum can't be relayed: the app tracks their ticket by an id
 * the testnet can't reproduce.
 */
import {
  createPublicClient,
  encodeFunctionData,
  http,
  isAddress,
  isHash,
  parseAbi,
  parseUnits,
  toHex,
  type Address,
  type Hash,
  type Hex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { extractTransactionDepositedLogs, opaqueDataToDepositData } from 'viem/op-stack';
import { MESSAGE_TRANSMITTER_V2 } from '@/modules/bridge/adapters/cctp/contracts';
import { TEST_ATTESTER_KEY } from '@/modules/bridge/adapters/cctp/testnetAttester';
import {
  ARBITRUM_DEPOSIT,
  L1_USDS,
  OP_STACK_DEPOSIT,
  type OpStackNetworkId
} from '@/modules/bridge/adapters/nativeDeposit/contracts';

type Network = 'mainnet' | 'base' | 'arbitrum' | 'optimism' | 'unichain';

const USDS: Record<Network, Address> = {
  mainnet: L1_USDS,
  base: OP_STACK_DEPOSIT.base.l2Usds,
  arbitrum: ARBITRUM_DEPOSIT.l2Usds,
  optimism: OP_STACK_DEPOSIT.optimism.l2Usds,
  unichain: OP_STACK_DEPOSIT.unichain.l2Usds
};

const adminRpc = (network: Network) => {
  const name = `BRIDGE_TESTNET_ADMIN_RPC_${network.toUpperCase()}`;
  const url = process.env[name];
  if (!url) throw new Error(`Set ${name} to the ${network} testnet's admin RPC`);
  return url;
};

const rpc = async <T>(network: Network, method: string, params: unknown[]): Promise<T> => {
  const response = await fetch(adminRpc(network), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const body = await response.json();
  if (body.error) throw new Error(`${method} on ${network}: ${body.error.message}`);
  return body.result as T;
};

const client = (network: Network) => createPublicClient({ transport: http(adminRpc(network)) });

/** Sends from any account, as the admin RPC allows, and waits for success. */
async function sendAs(
  network: Network,
  tx: { from: Address; to: Address; data: Hex; value?: bigint; gas?: bigint }
) {
  const hash = await rpc<Hash>(network, 'eth_sendTransaction', [
    {
      from: tx.from,
      to: tx.to,
      data: tx.data,
      value: toHex(tx.value ?? 0n),
      gas: toHex(tx.gas ?? 500_000n),
      gasPrice: '0x0'
    }
  ]);
  const receipt = await client(network).waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`Reverted on ${network}: ${hash}`);
  return receipt;
}

const attesterAbi = parseAbi([
  'function attesterManager() view returns (address)',
  'function isEnabledAttester(address) view returns (bool)',
  'function signatureThreshold() view returns (uint256)',
  'function enableAttester(address)',
  'function setSignatureThreshold(uint256)'
]);

async function setup() {
  const l1 = client('mainnet');
  const transmitter = { address: MESSAGE_TRANSMITTER_V2, abi: attesterAbi } as const;
  const attester = privateKeyToAccount(TEST_ATTESTER_KEY).address;
  const manager = await l1.readContract({ ...transmitter, functionName: 'attesterManager' });
  if (!(await l1.readContract({ ...transmitter, functionName: 'isEnabledAttester', args: [attester] }))) {
    const data = encodeFunctionData({ abi: attesterAbi, functionName: 'enableAttester', args: [attester] });
    await sendAs('mainnet', { from: manager, to: MESSAGE_TRANSMITTER_V2, data });
  }
  if ((await l1.readContract({ ...transmitter, functionName: 'signatureThreshold' })) !== 1n) {
    const data = encodeFunctionData({ abi: attesterAbi, functionName: 'setSignatureThreshold', args: [1n] });
    await sendAs('mainnet', { from: manager, to: MESSAGE_TRANSMITTER_V2, data });
  }
  console.log(`Test attester ${attester} enabled on the Ethereum testnet, threshold 1`);
}

async function fund(address: Address, usds: string) {
  for (const network of Object.keys(USDS) as Network[]) {
    await rpc(network, 'tenderly_setBalance', [[address], toHex(parseUnits('10', 18))]);
    await rpc(network, 'tenderly_setErc20Balance', [USDS[network], [address], toHex(parseUnits(usds, 18))]);
    console.log(`${network}: 10 ETH, ${usds} USDS`);
  }
}

/**
 * Does the sequencer's part on the L2 testnet: sends the exact deposit tx from
 * the Ethereum deposit's TransactionDeposited log, from its (aliased) sender.
 */
async function relay(txHash: Hash) {
  const receipt = await client('mainnet').getTransactionReceipt({ hash: txHash });
  const [log] = extractTransactionDepositedLogs({ logs: receipt.logs });
  const network = (Object.keys(OP_STACK_DEPOSIT) as OpStackNetworkId[]).find(
    id => OP_STACK_DEPOSIT[id].portal.toLowerCase() === log?.address.toLowerCase()
  );
  if (!log || !network) throw new Error(`No OP Stack deposit in ${txHash}`);
  const deposit = opaqueDataToDepositData(log.args.opaqueData);
  await rpc(network, 'tenderly_setBalance', [[log.args.from], toHex(parseUnits('1', 18))]);
  const relayed = await sendAs(network, {
    from: log.args.from,
    to: log.args.to,
    data: deposit.data,
    value: deposit.value,
    gas: deposit.gas
  });
  console.log(`Relayed to ${network}: ${relayed.transactionHash}`);
}

const [command, ...args] = process.argv.slice(2);
const run: Record<string, () => Promise<void>> = {
  setup,
  fund: () => {
    if (!isAddress(args[0] ?? '')) throw new Error('Usage: fund <address> [usds]');
    return fund(args[0] as Address, args[1] ?? '1000');
  },
  relay: () => {
    if (!isHash(args[0] ?? '')) throw new Error('Usage: relay <txHash>');
    return relay(args[0] as Hash);
  }
};

if (!command || !run[command]) {
  console.error('Usage: bridge-testnets setup | fund <address> [usds] | relay <txHash>');
  process.exit(1);
}
run[command]().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
