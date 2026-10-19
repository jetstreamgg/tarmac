/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@playwright/test';
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  keccak256,
  parseAbi,
  toHex,
  type Address,
  type Hex
} from 'viem';
import type { MockSafeHost } from '@/data/wagmi/config/safeMockConnector';
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

async function enable() {
  const { enableSafeMode } = await import('./mockSafe');
  let host: MockSafeHost | undefined;
  const page = {
    exposeFunction: async (_name: string, fn: MockSafeHost) => {
      host = fn;
    },
    route: async () => {}
  } as unknown as Page;
  const safeMode = await enableSafeMode(page, {
    safe: SAFE,
    owners: [OWNER],
    networks: [NetworkName.mainnet]
  });
  const send = async (data: Hex) =>
    (await host!({ method: 'sendTransactions', params: { txs: [{ to: TARGET, value: '0', data }] } })) as {
      safeTxHash: Hex;
    };
  return { safeMode, send };
}

describe('enableSafeMode', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
    h.waitForTransactionReceipt.mockResolvedValue({
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
    });

    await safeMode.execute(safeTxHash);
    expect(safeMode.queued()).toEqual([]);
  });
});
