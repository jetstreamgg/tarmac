/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@playwright/test';
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  keccak256,
  parseAbi,
  toHex,
  type Address,
  type Hex
} from 'viem';
import type { MockSafeHost, MockSafeTxDetails } from '@/data/wagmi/config/safeMockConnector';
import { NetworkName } from './constants';

const h = vi.hoisted(() => ({
  getRpcUrlFromFile: vi.fn(),
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  sendTransaction: vi.fn()
}));
vi.mock('./getRpcUrlFromFile', () => ({ getRpcUrlFromFile: h.getRpcUrlFromFile }));
vi.mock('viem', async importOriginal => ({
  ...(await importOriginal<typeof import('viem')>()),
  createPublicClient: () => ({
    readContract: h.readContract,
    waitForTransactionReceipt: h.waitForTransactionReceipt
  }),
  createWalletClient: () => ({ sendTransaction: h.sendTransaction })
}));

const SAFE = getAddress('0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe');
const OWNER = getAddress('0x0000000000000000000000000000000000000001');
const TARGET = getAddress('0x1111111111111111111111111111111111111111');
const TX_HASH = `0x${'bb'.repeat(32)}` as Hex;
const executionSuccess = parseAbi(['event ExecutionSuccess(bytes32 indexed txHash, uint256 payment)']);
const multiSendAbi = parseAbi(['function multiSend(bytes transactions) payable']);

async function enable(networks = [NetworkName.mainnet]) {
  const { enableSafeMode } = await import('./mockSafe');
  let host: MockSafeHost | undefined;
  const page = {
    exposeFunction: async (_name: string, fn: MockSafeHost) => {
      host = fn;
    },
    route: async () => {},
    reload: async () => {}
  } as unknown as Page;
  const safeMode = await enableSafeMode(page, { safe: SAFE, owners: [OWNER], networks });
  const send = async (...data: Hex[]) =>
    (await host!({
      method: 'sendTransactions',
      params: { txs: data.map(d => ({ to: TARGET, value: '0', data: d })) }
    })) as { safeTxHash: Hex };
  return { safeMode, send, host: (request: Parameters<MockSafeHost>[0]) => host!(request) };
}

function executedReceipt(safeTxHash: Hex) {
  return {
    status: 'success',
    transactionHash: TX_HASH,
    blockNumber: 1n,
    gasUsed: 21_000n,
    // viem's formatter gives null when the node leaves it out.
    effectiveGasPrice: null,
    logs: [
      {
        address: SAFE as Address,
        topics: encodeEventTopics({ abi: executionSuccess, args: { txHash: safeTxHash } }),
        data: encodeAbiParameters([{ type: 'uint256' }], [0n])
      }
    ]
  };
}

// The Safe nonce as the fork reports it: an execution bumps it as soon as it is sent.
function forkNonce({ hold }: { hold?: { read: number; until: Promise<bigint> } } = {}) {
  let nonce = 0n;
  let reads = 0;
  h.readContract.mockImplementation(
    async ({ functionName, args }: { functionName: string; args: unknown[] }) => {
      if (functionName !== 'nonce') return keccak256(toHex(args.join()));
      reads += 1;
      return reads === hold?.read ? hold.until : nonce;
    }
  );
  h.sendTransaction.mockImplementation(async () => {
    nonce += 1n;
    return TX_HASH;
  });
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('enableSafeMode', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    h.getRpcUrlFromFile.mockResolvedValue('http://fork.test');
    h.readContract.mockImplementation(
      async ({ functionName, args }: { functionName: string; args: unknown[] }) =>
        functionName === 'nonce' ? 0n : keccak256(toHex(args.join()))
    );
  });

  it('gives sends made at once consecutive nonces', async () => {
    const { safeMode, send } = await enable();
    await Promise.all([send('0xaa'), send('0xbb')]);
    expect(safeMode.queued().map(tx => tx.nonce)).toEqual([0n, 1n]);
  });

  it('reads the fork again after a failed first read', async () => {
    h.getRpcUrlFromFile.mockRejectedValueOnce(new Error('tenderlyTestnetData.json is mid-write'));
    const { safeMode, send } = await enable();
    await expect(send('0xaa')).rejects.toThrow('mid-write');
    await send('0xaa');
    expect(safeMode.queued()).toHaveLength(1);
  });

  it('stops listing a transaction as queued once execTransaction lands', async () => {
    const { safeMode, send } = await enable();
    const { safeTxHash } = await send('0xaa');
    h.sendTransaction.mockResolvedValue(TX_HASH);
    h.waitForTransactionReceipt.mockResolvedValue(executedReceipt(safeTxHash));

    await safeMode.execute(safeTxHash);
    expect(safeMode.queued()).toEqual([]);
  });

  it('gives a send made while an execution waits for its receipt the next nonce', async () => {
    forkNonce();
    const { safeMode, send } = await enable();
    const { safeTxHash } = await send('0xaa');
    let mined!: () => void;
    h.waitForTransactionReceipt.mockReturnValue(
      new Promise(resolve => (mined = () => resolve(executedReceipt(safeTxHash))))
    );

    const executing = safeMode.execute(safeTxHash);
    await vi.waitFor(() => expect(h.sendTransaction).toHaveBeenCalled());
    const next = send('0xbb');
    await settle();
    mined();
    await Promise.all([executing, next]);
    expect(safeMode.queued().map(tx => tx.nonce)).toEqual([1n]);
  });

  it('gives a send whose nonce read started before an execution the next nonce', async () => {
    let release!: (nonce: bigint) => void;
    forkNonce({ hold: { read: 2, until: new Promise(resolve => (release = resolve)) } });
    const { safeMode, send } = await enable();
    const { safeTxHash } = await send('0xaa');
    h.waitForTransactionReceipt.mockResolvedValue(executedReceipt(safeTxHash));

    // Reads the nonce from before the execution below mines.
    const next = send('0xbb');
    await settle();
    const executing = safeMode.execute(safeTxHash);
    await settle();
    release(0n);
    await Promise.all([executing, next]);
    expect(safeMode.queued().map(tx => tx.nonce)).toEqual([1n]);
  });

  it('keeps sends on the network they were made on when the network switches before they are proposed', async () => {
    let release!: (nonce: bigint) => void;
    forkNonce({ hold: { read: 1, until: new Promise(resolve => (release = resolve)) } });
    const { safeMode, send } = await enable([NetworkName.mainnet, NetworkName.base]);

    const first = send('0xaa');
    await settle();
    const second = send('0xbb');
    await safeMode.switchNetwork(NetworkName.base);
    release(0n);
    await Promise.all([first, second]);
    expect(safeMode.queued()).toEqual([]);
    await safeMode.switchNetwork(NetworkName.mainnet);
    expect(safeMode.queued().map(tx => tx.nonce)).toEqual([0n, 1n]);
  });

  it('waits for a transaction on the network it was called on', async () => {
    const { safeMode, send } = await enable([NetworkName.mainnet, NetworkName.base]);
    await send('0xaa');

    const waiting = safeMode.waitForQueued({ timeout: 1_000 });
    await safeMode.switchNetwork(NetworkName.base);
    expect((await waiting).network).toBe(NetworkName.mainnet);
  });

  it('decodes a batch from the same bytes it executes', async () => {
    const { safeMode, send, host } = await enable();
    const { safeTxHash } = await send('0xaa', '0xbb');
    const details = (await host({
      method: 'getTxBySafeTxHash',
      params: { safeTxHash }
    })) as MockSafeTxDetails;

    const [tx] = safeMode.queued();
    const [executed] = decodeFunctionData({ abi: multiSendAbi, data: tx.data }).args;
    expect(details.txData.dataDecoded?.parameters[0].value).toBe(executed);
  });
});
