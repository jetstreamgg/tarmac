import { expect, type Page, type Route } from '@playwright/test';
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
  type BaseError,
  type EIP1193RequestFn,
  type Hex,
  type PublicClient
} from 'viem';
import { arbitrum, base, optimism, unichain } from 'viem/chains';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { SAFE_TRANSACTION_SERVICE_URL } from '@/hooks/shared/constants';
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

// Matched against the app's own tx-service hosts, so a host change there can't bypass the mock.
const txServiceNetwork = (url: URL) =>
  Object.values(NetworkName).find(network => SAFE_TRANSACTION_SERVICE_URL[CHAIN_ID[network]] === url.origin);

// Tenderly accepts unsigned sends; the gas mirrors what mockRpcCalls gives the page.
const FORK_GAS = 0x7a1200n;

const safeAbi = parseAbi([
  'function setup(address[] _owners, uint256 _threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
  'function nonce() view returns (uint256)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function addOwnerWithThreshold(address owner, uint256 _threshold)',
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
  /** The packed legs `data` passes to multiSend; null for a direct call. */
  multiSendTransactions: Hex | null;
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
    fork = getRpcUrlFromFile(network).then(
      rpcUrl => ({
        rpcUrl,
        publicClient: createPublicClient({ transport: http(rpcUrl), pollingInterval: 500 })
      }),
      error => {
        // Not cached, so the next call reads the file again.
        forkClients.delete(network);
        throw error;
      }
    );
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

/**
 * Adds `newOwner` to a 1-of-n Safe on one fork only, so the same address has
 * different owners there: what a Safe that was set up on its own per network looks like.
 */
export async function addSafeOwner({
  safe,
  owner,
  newOwner,
  network
}: {
  safe: Address;
  owner: Address;
  newOwner: Address;
  network: NetworkName;
}) {
  const { publicClient } = await getFork(network);
  const data = encodeFunctionData({
    abi: safeAbi,
    functionName: 'addOwnerWithThreshold',
    args: [newOwner, 1n]
  });
  const receipt = await sendFromOwner(network, owner, {
    address: safe,
    data: encodeFunctionData({
      abi: safeAbi,
      functionName: 'execTransaction',
      args: [safe, 0n, data, 0, 0n, 0n, 0n, zeroAddress, zeroAddress, concat([pad(owner), zeroHash, '0x01'])]
    })
  });
  const owners = await publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'getOwners' });
  if (receipt.status !== 'success' || !owners.some(other => isAddressEqual(other, newOwner))) {
    throw new Error(`Mock Safe: adding an owner on ${network} failed`);
  }
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
  if (!tx.multiSendTransactions) return null;
  return {
    method: 'multiSend',
    parameters: [
      {
        name: 'transactions',
        type: 'bytes',
        value: tx.multiSendTransactions,
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
    /** Where the Safe is deployed, and so where `switchNetwork` may go. */
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

  // One proposal or execution at a time, so no execution lands between a nonce read and the queue count.
  let last: Promise<unknown> = Promise.resolve();
  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const run = last.then(work);
    last = run.catch(() => undefined);
    return run;
  }

  async function propose(on: NetworkName, calls: Call[], safeTxGas: bigint): Promise<MockSafeTx> {
    const multiSendTransactions = calls.length > 1 ? encodeMultiSend(calls) : null;
    const to = multiSendTransactions ? SAFE_1_4_1.multiSendCallOnly : calls[0].to;
    const value = multiSendTransactions ? 0n : calls[0].value;
    const data = multiSendTransactions
      ? encodeFunctionData({ abi: multiSendAbi, functionName: 'multiSend', args: [multiSendTransactions] })
      : calls[0].data;
    const operation = multiSendTransactions ? 1 : 0;
    const nonce = (await readNonce(on)) + BigInt(queuedOn(on).length);
    const { publicClient } = await getFork(on);
    const safeTxHash = await publicClient.readContract({
      address,
      abi: safeAbi,
      functionName: 'getTransactionHash',
      args: [to, value, data, operation, safeTxGas, 0n, 0n, zeroAddress, zeroAddress, nonce]
    });
    const tx: MockSafeTx = {
      network: on,
      safeTxHash,
      to,
      value,
      data,
      operation,
      safeTxGas,
      nonce,
      calls,
      multiSendTransactions,
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
        // The network the page sent from, before a switch can move `current`.
        const on = current;
        const { txs: requested, params } = request.params;
        if (requested.length === 0) throw new Error('Mock Safe: no transactions to send');
        const calls = requested.map(tx => ({
          to: getAddress(tx.to),
          value: BigInt(tx.value || 0),
          data: (tx.data || '0x') as Hex
        }));
        const tx = await serialize(() => propose(on, calls, parseSafeTxGas(params?.safeTxGas)));
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
        const { publicClient } = await getFork(current);
        try {
          return (await (publicClient.request as EIP1193RequestFn)({ method: call, params })) ?? null;
        } catch (error) {
          // The page gets only this message: `details` is the node's error, without the RPC URL.
          throw new Error(`Mock Safe: ${call} failed: ${(error as BaseError).details ?? 'unknown error'}`, {
            cause: error
          });
        }
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

  // SafeInfoResponse from the fork: 404 where this Safe has no code, as for a Safe never deployed there.
  async function safeInfo(on: NetworkName) {
    const { publicClient } = await getFork(on);
    if (!(await publicClient.getCode({ address }))) return null;
    const read = <F extends 'nonce' | 'getThreshold' | 'getOwners'>(functionName: F) =>
      publicClient.readContract({ address, abi: safeAbi, functionName });
    const [nonce, threshold, owners] = await Promise.all([
      read('nonce'),
      read('getThreshold'),
      read('getOwners')
    ]);
    return {
      address,
      nonce: nonce.toString(),
      threshold: Number(threshold),
      owners: owners.map(owner => getAddress(owner)),
      masterCopy: SAFE_1_4_1.singleton,
      modules: [],
      fallbackHandler: SAFE_1_4_1.fallbackHandler,
      guard: zeroAddress,
      version: '1.4.1'
    };
  }

  async function txService(route: Route) {
    const request = route.request();
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });

    const url = new URL(request.url());
    const on = txServiceNetwork(url);
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
    const isThisSafe = (path: string) => isAddressEqual(path as Address, address);
    // The app reads a transaction by its safeTxHash, the Safe itself, and what executed at a nonce.
    const single = url.pathname.match(/^\/api\/v1\/multisig-transactions\/(0x[0-9a-fA-F]{64})\/?$/);
    const safePath = url.pathname.match(/^\/api\/v1\/safes\/(0x[0-9a-fA-F]{40})\/?$/);
    const atNonce = url.pathname.match(/^\/api\/v1\/safes\/(0x[0-9a-fA-F]{40})\/multisig-transactions\/?$/);
    if (on && request.method() === 'GET' && safePath && isThisSafe(safePath[1])) {
      const info = await safeInfo(on);
      return json(info ? 200 : 404, info ?? { detail: 'Not found.' });
    }
    if (on && request.method() === 'GET' && atNonce && isThisSafe(atNonce[1])) {
      const nonce = url.searchParams.get('nonce');
      const executed = url.searchParams.get('executed');
      const results = txs
        .filter(tx => tx.network === on)
        .filter(tx => nonce === null || tx.nonce.toString() === nonce)
        .filter(tx => executed === null || String(!!tx.execution) === executed)
        .map(txServiceTx);
      return json(200, { count: results.length, next: null, previous: null, results });
    }
    if (!on || !single || request.method() !== 'GET') {
      unmockedRequests.push(maskHex(`${request.method()} ${url.hostname}${url.pathname}`));
      return route.fulfill({ status: 404, headers, contentType: 'application/json', body: '' });
    }
    const tx = findTx(single[1], on);
    return route.fulfill({
      status: tx ? 200 : 404,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(
        tx ? txServiceTx(tx) : { detail: 'No MultisigTransaction matches the given query.' }
      )
    });
  }

  function execute(safeTxHash?: Hex): Promise<MockSafeTx> {
    const on = current;
    return serialize(() => executeOn(on, safeTxHash));
  }

  async function executeOn(on: NetworkName, safeTxHash?: Hex): Promise<MockSafeTx> {
    const tx = safeTxHash ? findTx(safeTxHash, on) : queuedOn(on)[0];
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

    // The tx ran on chain, so nothing past this point may throw and leave it queued.
    const gasPrice = receipt.effectiveGasPrice ?? 0n;
    tx.execution = {
      transactionHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
      executor,
      executionDate: isoNow(),
      isSuccessful: outcome.eventName === 'ExecutionSuccess',
      gasUsed: Number(receipt.gasUsed),
      fee: (receipt.gasUsed * gasPrice).toString(),
      ethGasPrice: gasPrice.toString(),
      signers,
      signatures
    };
    return tx;
  }

  await page.exposeFunction('__MOCK_SAFE_HOST__', host);
  await page.route(url => txServiceNetwork(url) !== undefined, txService);

  return {
    address,
    queued: () => queuedOn(current),
    async waitForQueued({ timeout = 30_000 } = {}) {
      const on = current;
      await expect
        .poll(() => queuedOn(on).length, { message: 'Mock Safe: no transaction queued', timeout })
        .toBeGreaterThan(0);
      return queuedOn(on)[0];
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
