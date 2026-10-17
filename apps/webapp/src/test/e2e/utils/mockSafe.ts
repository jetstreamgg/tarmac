import type { Page, Route } from '@playwright/test';
import {
  concat,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  encodePacked,
  getAddress,
  getContractAddress,
  http,
  isAddressEqual,
  keccak256,
  pad,
  parseAbi,
  parseEventLogs,
  size,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
  type PublicClient
} from 'viem';
import { arbitrum, base, optimism, unichain } from 'viem/chains';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import type { MockSafeHostRequest, MockSafeTxDetails } from '@/data/wagmi/config/safeMockConnector';
import { NetworkName } from './constants';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';

/**
 * Safe Apps e2e harness (APP-642): a real Safe on the forks, the Safe{Wallet}
 * side of the Safe Apps SDK (`window.__MOCK_SAFE_HOST__`, read by the `safe`
 * mock connector), and a routed Safe Transaction Service. All chain state lives
 * here in Node; the page only ever sees what Safe{Wallet} would tell it.
 */

/** Canonical Safe 1.4.1 deployments, at the same address on every fork. */
export const SAFE_1_4_1 = {
  singleton: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
  proxyFactory: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
  multiSendCallOnly: '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
  fallbackHandler: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99'
} as const satisfies Record<string, Address>;

const CHAIN_ID: Record<NetworkName, number> = {
  [NetworkName.mainnet]: TENDERLY_CHAIN_ID,
  [NetworkName.base]: base.id,
  [NetworkName.arbitrum]: arbitrum.id,
  [NetworkName.optimism]: optimism.id,
  [NetworkName.unichain]: unichain.id
};

// api.safe.global/tx-service/{shortName}; the legacy hosts are safe-transaction-{NetworkName}.
const TX_SERVICE_SHORT_NAME: Record<string, NetworkName> = {
  eth: NetworkName.mainnet,
  base: NetworkName.base,
  arb1: NetworkName.arbitrum,
  oeth: NetworkName.optimism,
  unichain: NetworkName.unichain
};

const TX_SERVICE_URL =
  /^https:\/\/(safe-transaction-[a-z0-9]+\.safe\.global|api\.safe\.global\/tx-service)\//;

// Tenderly accepts unsigned sends; the gas mirrors what mockRpcCalls gives the page.
const FORK_GAS = 0x7a1200n;

const safeAbi = parseAbi([
  'function setup(address[] _owners, uint256 _threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
  'function nonce() view returns (uint256)',
  'function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)',
  'function approveHash(bytes32 hashToApprove)',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool success)',
  'event ExecutionSuccess(bytes32 indexed txHash, uint256 payment)',
  'event ExecutionFailure(bytes32 indexed txHash, uint256 payment)'
]);

const proxyFactoryAbi = parseAbi([
  'function proxyCreationCode() pure returns (bytes)',
  'function createProxyWithNonce(address _singleton, bytes initializer, uint256 saltNonce) returns (address proxy)'
]);

const multiSendAbi = parseAbi(['function multiSend(bytes transactions) payable']);

// Read methods a Safe App may forward through `rpcCall`; anything else is a gap in this mock.
const RPC_ALLOWLIST = new Set([
  'eth_call',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getLogs',
  'eth_getBlockByHash',
  'eth_getBlockByNumber',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getTransactionCount',
  'eth_gasPrice',
  'eth_estimateGas'
]);

type Call = { to: Address; value: bigint; data: Hex };

export type MockSafeExecution = {
  transactionHash: Hex;
  blockNumber: number;
  executor: Address;
  executionDate: string;
  isSuccessful: boolean;
  gasUsed: number;
  fee: string;
  ethGasPrice: string;
  signers: Address[];
  signatures: Hex;
};

/** One Safe transaction as Safe{Wallet} queued it. */
export type MockSafeTx = {
  network: NetworkName;
  safeTxHash: Hex;
  to: Address;
  value: bigint;
  data: Hex;
  operation: 0 | 1;
  safeTxGas: bigint;
  nonce: bigint;
  /** The calls the Safe App asked for; one direct call, or the MultiSendCallOnly legs. */
  calls: Call[];
  submissionDate: string;
  execution: MockSafeExecution | null;
};

export type MockSafeController = {
  address: Address;
  /** Unexecuted transactions on the current network, lowest nonce first. */
  queued: () => MockSafeTx[];
  /** Resolves with the lowest-nonce queued transaction once one exists. */
  waitForQueued: (options?: { timeout?: number }) => Promise<MockSafeTx>;
  /** Signs with the first `threshold` owners and executes on-chain, as the owners would in Safe{Wallet}. */
  execute: (safeTxHash?: Hex) => Promise<MockSafeTx>;
  /** The user picks another network in Safe{Wallet}: the Safe App reloads on it. */
  switchNetwork: (network: NetworkName) => Promise<void>;
  /** Tx-service paths and host calls this mock does not answer; a spec asserts it stays empty. */
  unmockedRequests: string[];
};

const forkClients = new Map<NetworkName, Promise<{ rpcUrl: string; publicClient: PublicClient }>>();

function getFork(network: NetworkName) {
  let fork = forkClients.get(network);
  if (!fork) {
    fork = getRpcUrlFromFile(network).then(rpcUrl => ({
      rpcUrl,
      publicClient: createPublicClient({ transport: http(rpcUrl), pollingInterval: 500 })
    }));
    forkClients.set(network, fork);
  }
  return fork;
}

async function sendFromOwner(network: NetworkName, from: Address, request: { address: Address; data: Hex }) {
  const { rpcUrl, publicClient } = await getFork(network);
  const wallet = createWalletClient({ account: from, transport: http(rpcUrl) });
  const hash = await wallet.sendTransaction({
    to: request.address,
    data: request.data,
    gas: FORK_GAS,
    chain: null
  });
  return publicClient.waitForTransactionReceipt({ hash });
}

const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * Deploys a Safe 1.4.1 proxy through the canonical factory on each network, or
 * reuses it when it already exists. Same owners, threshold and salt give the
 * same address on every fork, which this asserts.
 */
export async function deploySafe({
  owners,
  threshold = 1,
  saltNonce,
  networks = Object.values(NetworkName)
}: {
  owners: Address[];
  threshold?: number;
  saltNonce: bigint;
  networks?: NetworkName[];
}): Promise<Address> {
  if (threshold < 1 || threshold > owners.length) {
    throw new Error(`Mock Safe: threshold ${threshold} does not fit ${owners.length} owner(s)`);
  }
  const initializer = encodeFunctionData({
    abi: safeAbi,
    functionName: 'setup',
    args: [
      owners,
      BigInt(threshold),
      zeroAddress,
      '0x',
      SAFE_1_4_1.fallbackHandler,
      zeroAddress,
      0n,
      zeroAddress
    ]
  });
  const salt = keccak256(encodePacked(['bytes32', 'uint256'], [keccak256(initializer), saltNonce]));

  const addresses = await Promise.all(
    networks.map(async network => {
      const { publicClient } = await getFork(network);
      const creationCode = await publicClient.readContract({
        address: SAFE_1_4_1.proxyFactory,
        abi: proxyFactoryAbi,
        functionName: 'proxyCreationCode'
      });
      const address = getContractAddress({
        opcode: 'CREATE2',
        from: SAFE_1_4_1.proxyFactory,
        salt,
        bytecode: concat([creationCode, pad(SAFE_1_4_1.singleton)])
      });
      if (!(await publicClient.getCode({ address }))) {
        await sendFromOwner(network, owners[0], {
          address: SAFE_1_4_1.proxyFactory,
          data: encodeFunctionData({
            abi: proxyFactoryAbi,
            functionName: 'createProxyWithNonce',
            args: [SAFE_1_4_1.singleton, initializer, saltNonce]
          })
        });
        if (!(await publicClient.getCode({ address }))) {
          throw new Error(`Mock Safe: the factory deployed nothing at the predicted address on ${network}`);
        }
      }
      return address;
    })
  );

  if (new Set(addresses).size !== 1) throw new Error('Mock Safe: the Safe address differs across forks');
  return addresses[0];
}

const encodeMultiSend = (calls: Call[]): Hex =>
  concat(
    calls.map(call =>
      encodePacked(
        ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
        [0, call.to, call.value, BigInt(size(call.data)), call.data]
      )
    )
  );

// Safe{Wallet} keeps an app's gas as safeTxGas when it is a number, else 0 (ReviewSafeAppsTx, create.ts).
const parseSafeTxGas = (gas: unknown) =>
  typeof gas === 'number' && Number.isInteger(gas) && gas >= 0 ? BigInt(gas) : 0n;

// What the tx service decodes for a MultiSendCallOnly batch; a direct call gets null (we have no ABIs).
function decodedData(tx: MockSafeTx) {
  if (tx.operation !== 1) return null;
  return {
    method: 'multiSend',
    parameters: [
      {
        name: 'transactions',
        type: 'bytes',
        value: encodeMultiSend(tx.calls),
        valueDecoded: tx.calls.map(call => ({
          operation: 0,
          to: call.to,
          value: call.value.toString(),
          data: call.data,
          dataDecoded: null
        }))
      }
    ]
  };
}

const txStatus = (tx: MockSafeTx): MockSafeTxDetails['txStatus'] =>
  !tx.execution ? 'AWAITING_CONFIRMATIONS' : tx.execution.isSuccessful ? 'SUCCESS' : 'FAILED';

const maskHex = (text: string) =>
  text.replace(/0x[0-9a-fA-F]{64}/g, '{hash}').replace(/0x[0-9a-fA-F]{40}/g, '{address}');

/**
 * Turns Safe mode on for `page`: call it before the first navigation. The
 * `safe` connector then reconnects on every load, as inside the Safe{Wallet}
 * iframe, and the tx service answers from this Node-side state.
 */
export async function enableSafeMode(
  page: Page,
  {
    safe,
    owners,
    threshold = 1,
    network = NetworkName.mainnet,
    networks = Object.values(NetworkName)
  }: {
    safe: Address;
    owners: Address[];
    threshold?: number;
    /** The network the Safe App opens on. */
    network?: NetworkName;
    /** Where the Safe is deployed; the tx service knows it only there. */
    networks?: NetworkName[];
  }
): Promise<MockSafeController> {
  const address = getAddress(safe);
  const checksummedOwners = owners.map(owner => getAddress(owner));
  const txs: MockSafeTx[] = [];
  const unmockedRequests: string[] = [];
  let current = network;

  const queuedOn = (on: NetworkName) =>
    txs.filter(tx => tx.network === on && !tx.execution).sort((a, b) => Number(a.nonce - b.nonce));

  const readNonce = async (on: NetworkName) =>
    (await getFork(on)).publicClient.readContract({ address, abi: safeAbi, functionName: 'nonce' });

  async function queue(calls: Call[], safeTxGas: bigint): Promise<MockSafeTx> {
    const batch = calls.length > 1;
    const to = batch ? SAFE_1_4_1.multiSendCallOnly : calls[0].to;
    const value = batch ? 0n : calls[0].value;
    const data = batch
      ? encodeFunctionData({ abi: multiSendAbi, functionName: 'multiSend', args: [encodeMultiSend(calls)] })
      : calls[0].data;
    const operation = batch ? 1 : 0;
    const nonce = (await readNonce(current)) + BigInt(queuedOn(current).length);
    const { publicClient } = await getFork(current);
    const safeTxHash = await publicClient.readContract({
      address,
      abi: safeAbi,
      functionName: 'getTransactionHash',
      args: [to, value, data, operation, safeTxGas, 0n, 0n, zeroAddress, zeroAddress, nonce]
    });
    const tx: MockSafeTx = {
      network: current,
      safeTxHash,
      to,
      value,
      data,
      operation,
      safeTxGas,
      nonce,
      calls,
      submissionDate: isoNow(),
      execution: null
    };
    txs.push(tx);
    return tx;
  }

  const findTx = (safeTxHash: string, on: NetworkName) =>
    txs.find(tx => tx.network === on && tx.safeTxHash.toLowerCase() === safeTxHash.toLowerCase());

  async function host(request: MockSafeHostRequest): Promise<unknown> {
    switch (request.method) {
      case 'getSafeInfo':
        return {
          safeAddress: address,
          chainId: CHAIN_ID[current],
          threshold,
          owners: checksummedOwners,
          isReadOnly: false
        };
      case 'sendTransactions': {
        const { txs: requested, params } = request.params;
        if (requested.length === 0) throw new Error('Mock Safe: no transactions to send');
        const calls = requested.map(tx => ({
          to: getAddress(tx.to),
          value: BigInt(tx.value || 0),
          data: (tx.data || '0x') as Hex
        }));
        const tx = await queue(calls, parseSafeTxGas(params?.safeTxGas));
        return { safeTxHash: tx.safeTxHash };
      }
      case 'getTxBySafeTxHash': {
        // The provider also asks with plain tx hashes and expects a rejection for those.
        const tx = findTx(request.params.safeTxHash, current);
        if (!tx) throw new Error('Mock Safe: transaction not found');
        const details: MockSafeTxDetails = {
          safeAddress: address,
          txId: `multisig_${address}_${tx.safeTxHash}`,
          txStatus: txStatus(tx),
          txHash: tx.execution?.transactionHash ?? null,
          executedAt: tx.execution ? Date.parse(tx.execution.executionDate) : null,
          txData: {
            hexData: tx.data,
            to: { value: tx.to },
            value: tx.value.toString(),
            operation: tx.operation,
            dataDecoded: decodedData(tx)
          }
        };
        return details;
      }
      case 'rpcCall': {
        const { call, params } = request.params;
        if (!RPC_ALLOWLIST.has(call)) {
          unmockedRequests.push(`host rpcCall ${call}`);
          throw new Error(`Mock Safe: ${call} is not supported`);
        }
        const { rpcUrl } = await getFork(current);
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: call, params })
        });
        const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
        if (body.error)
          throw new Error(`Mock Safe: ${call} failed: ${body.error.message ?? 'unknown error'}`);
        return body.result ?? null;
      }
      default: {
        const method = (request as { method: string }).method;
        unmockedRequests.push(`host ${method}`);
        throw new Error(`Mock Safe: ${method} is not supported`);
      }
    }
  }

  // SafeMultisigTransactionResponse, field for field (tx service OpenAPI).
  function txServiceTx(tx: MockSafeTx) {
    const execution = tx.execution;
    return {
      safe: address,
      to: tx.to,
      value: tx.value.toString(),
      data: tx.data === '0x' ? null : tx.data,
      operation: tx.operation,
      gasToken: zeroAddress,
      safeTxGas: Number(tx.safeTxGas),
      baseGas: 0,
      gasPrice: '0',
      refundReceiver: zeroAddress,
      nonce: Number(tx.nonce),
      executionDate: execution?.executionDate ?? null,
      submissionDate: tx.submissionDate,
      modified: execution?.executionDate ?? tx.submissionDate,
      blockNumber: execution?.blockNumber ?? null,
      transactionHash: execution?.transactionHash ?? null,
      safeTxHash: tx.safeTxHash,
      proposer: checksummedOwners[0],
      proposedByDelegate: null,
      executor: execution?.executor ?? null,
      isExecuted: !!execution,
      isSuccessful: execution ? execution.isSuccessful : null,
      ethGasPrice: execution?.ethGasPrice ?? null,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
      gasUsed: execution?.gasUsed ?? null,
      fee: execution?.fee ?? null,
      payment: execution ? '0' : null,
      origin: '{}',
      dataDecoded: decodedData(tx),
      confirmationsRequired: threshold,
      confirmations: (execution?.signers ?? []).map(owner => ({
        owner,
        submissionDate: execution!.executionDate,
        transactionHash: null,
        signature: concat([pad(owner), zeroHash, '0x01']),
        signatureType: 'APPROVED_HASH'
      })),
      trusted: true,
      signatures: execution?.signatures ?? null
    };
  }

  async function txServiceAnswer(on: NetworkName, url: URL, path: string) {
    const isThisSafe = (candidate: string) =>
      networks.includes(on) && isAddressEqual(candidate as Address, address);

    const safeInfo = path.match(/^\/api\/v1\/safes\/(0x[0-9a-fA-F]{40})\/?$/);
    if (safeInfo) {
      if (!isThisSafe(safeInfo[1])) return { status: 404, body: '' };
      return {
        status: 200,
        body: {
          address,
          nonce: (await readNonce(on)).toString(),
          threshold,
          owners: checksummedOwners,
          masterCopy: SAFE_1_4_1.singleton,
          modules: [],
          fallbackHandler: SAFE_1_4_1.fallbackHandler,
          guard: zeroAddress,
          moduleGuard: zeroAddress,
          version: '1.4.1'
        }
      };
    }

    const single = path.match(/^\/api\/v1\/multisig-transactions\/(0x[0-9a-fA-F]{64})\/?$/);
    if (single) {
      const tx = findTx(single[1], on);
      if (!tx) return { status: 404, body: { detail: 'No MultisigTransaction matches the given query.' } };
      return { status: 200, body: txServiceTx(tx) };
    }

    const list = path.match(/^\/api\/v1\/safes\/(0x[0-9a-fA-F]{40})\/multisig-transactions\/?$/);
    if (list) {
      const { searchParams } = url;
      const nonce = searchParams.get('nonce');
      const executed = searchParams.get('executed');
      const ascending = searchParams.get('ordering') === 'nonce';
      const results = (isThisSafe(list[1]) ? txs.filter(tx => tx.network === on) : [])
        .filter(tx => nonce === null || tx.nonce.toString() === nonce)
        .filter(tx => executed === null || String(!!tx.execution) === executed)
        .sort((a, b) => (ascending ? 1 : -1) * Number(a.nonce - b.nonce));
      const limit = Number(searchParams.get('limit') ?? 100);
      const offset = Number(searchParams.get('offset') ?? 0);
      const pageUrl = (at: number) => {
        const next = new URL(url);
        next.searchParams.set('offset', String(at));
        return next.toString();
      };
      return {
        status: 200,
        body: {
          count: results.length,
          countUniqueNonce: new Set(results.map(tx => tx.nonce)).size,
          next: offset + limit < results.length ? pageUrl(offset + limit) : null,
          previous: offset > 0 ? pageUrl(Math.max(0, offset - limit)) : null,
          results: results.slice(offset, offset + limit).map(txServiceTx)
        }
      };
    }
    return undefined;
  }

  async function txService(route: Route) {
    const request = route.request();
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });

    const url = new URL(request.url());
    const legacy = url.hostname.match(/^safe-transaction-([a-z0-9]+)\.safe\.global$/);
    const gateway = url.pathname.match(/^\/tx-service\/([a-z0-9]+)(\/.*)$/);
    const on = legacy
      ? Object.values(NetworkName).find(name => name === legacy[1])
      : gateway
        ? TX_SERVICE_SHORT_NAME[gateway[1]]
        : undefined;
    const path = legacy ? url.pathname : (gateway?.[2] ?? '');

    const answer = on && request.method() === 'GET' ? await txServiceAnswer(on, url, path) : undefined;
    if (!answer) {
      unmockedRequests.push(maskHex(`${request.method()} ${url.hostname}${url.pathname}`));
      return route.fulfill({ status: 404, headers, contentType: 'application/json', body: '' });
    }
    return route.fulfill({
      status: answer.status,
      headers,
      contentType: 'application/json',
      body: typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body)
    });
  }

  async function execute(safeTxHash?: Hex): Promise<MockSafeTx> {
    const tx = safeTxHash ? findTx(safeTxHash, current) : queuedOn(current)[0];
    if (!tx) throw new Error('Mock Safe: nothing to execute');
    if (tx.execution) throw new Error('Mock Safe: transaction already executed');
    // A v=1 signature from msg.sender skips the hash check, so a wrong nonce would
    // still execute, as a different safeTxHash. Only the next nonce may go.
    const onChainNonce = await readNonce(tx.network);
    if (tx.nonce !== onChainNonce) {
      throw new Error(`Mock Safe: nonce ${tx.nonce} is not next (on-chain nonce ${onChainNonce})`);
    }

    const signers = checksummedOwners.slice(0, threshold);
    const executor = checksummedOwners[0];
    for (const signer of signers.filter(signer => signer !== executor)) {
      await sendFromOwner(tx.network, signer, {
        address,
        data: encodeFunctionData({ abi: safeAbi, functionName: 'approveHash', args: [tx.safeTxHash] })
      });
    }
    // Approved-hash signatures (v=1), sorted by owner as checkNSignatures requires.
    const signatures = concat(
      [...signers]
        .sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))
        .map(owner => concat([pad(owner), zeroHash, '0x01']))
    );

    const receipt = await sendFromOwner(tx.network, executor, {
      address,
      data: encodeFunctionData({
        abi: safeAbi,
        functionName: 'execTransaction',
        args: [
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
          tx.safeTxGas,
          0n,
          0n,
          zeroAddress,
          zeroAddress,
          signatures
        ]
      })
    });
    if (receipt.status !== 'success') {
      // With safeTxGas 0 and no refund an inner revert reverts the whole call (GS013): nothing executed.
      throw new Error('Mock Safe: execTransaction reverted; the transaction stays queued');
    }
    const outcome = parseEventLogs({
      abi: safeAbi,
      eventName: ['ExecutionSuccess', 'ExecutionFailure'],
      logs: receipt.logs.filter(log => isAddressEqual(log.address, address))
    }).find(log => log.args.txHash === tx.safeTxHash);
    if (!outcome) throw new Error('Mock Safe: no ExecutionSuccess or ExecutionFailure for this safeTxHash');

    tx.execution = {
      transactionHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
      executor,
      executionDate: isoNow(),
      isSuccessful: outcome.eventName === 'ExecutionSuccess',
      gasUsed: Number(receipt.gasUsed),
      fee: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
      ethGasPrice: receipt.effectiveGasPrice.toString(),
      signers,
      signatures
    };
    return tx;
  }

  await page.exposeFunction('__MOCK_SAFE_HOST__', host);
  await page.route(TX_SERVICE_URL, txService);

  return {
    address,
    queued: () => queuedOn(current),
    async waitForQueued({ timeout = 30_000 } = {}) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const [next] = queuedOn(current);
        if (next) return next;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Mock Safe: no transaction queued within ${timeout}ms`);
    },
    execute,
    async switchNetwork(next: NetworkName) {
      if (!networks.includes(next)) throw new Error(`Mock Safe: the Safe is not deployed on ${next}`);
      current = next;
      await page.reload();
    },
    unmockedRequests
  };
}
