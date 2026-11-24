import { describe, expect, it, vi } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  getAddress,
  slice,
  zeroAddress,
  type Address,
  type Hex,
  type Log
} from 'viem';
import { applyProgress, createPendingBridge, recordActionSent } from '../../model/pendingTransitions';
import { resolveBridgeRoute } from '../../model/resolveRoute';
import { BASE_BURN_AMOUNT, BASE_BURN_ATTESTED, BASE_BURN_LOGS, BASE_BURN_TX } from './cctp.fixtures';
import {
  L1_USDC,
  L1_USDS,
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_V2,
  messageTransmitterV2Abi,
  tokenMessengerV2Abi
} from './contracts';
import {
  OTHERS_CLAIM_SCAN_CHUNK_BLOCKS,
  cctpConvertOffer,
  findOthersClaimReceipt,
  othersClaimSold
} from './convert';

const NOW = 1_800_000_000_000;
const BURNED_AT = 1_800_000_000n;
const RECEIVE_TX = `0x${'ab'.repeat(32)}` as Hex;
const FAIRY = '0x000000000000000000000000000000000000dEaD';
const RECIPIENT = getAddress(BASE_BURN_TX.from);

/** The MessageReceived the Ethereum MessageTransmitter emits when `message` is received. */
const receivedLog = (message: Hex): Log =>
  ({
    address: MESSAGE_TRANSMITTER_V2,
    topics: encodeEventTopics({
      abi: messageTransmitterV2Abi,
      eventName: 'MessageReceived',
      args: {
        caller: FAIRY,
        nonce: slice(message, 12, 44),
        finalityThresholdExecuted: Number(BigInt(slice(message, 144, 148)))
      }
    }),
    data: encodeAbiParameters(
      [{ type: 'uint32' }, { type: 'bytes32' }, { type: 'bytes' }],
      [Number(BigInt(slice(message, 4, 8))), slice(message, 44, 76), slice(message, 148)]
    )
  }) as unknown as Log;

const usdsMint = (to: Address, value = 1n): Log =>
  ({
    address: L1_USDS,
    topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from: zeroAddress, to } }),
    data: encodeAbiParameters([{ type: 'uint256' }], [value])
  }) as unknown as Log;

/** The USDC TokenMessengerV2 mints to `mintRecipient` on a receive, 6 decimals. */
const usdcMinted = (mintRecipient: Address, amount: bigint): Log =>
  ({
    address: TOKEN_MESSENGER_V2,
    topics: encodeEventTopics({
      abi: tokenMessengerV2Abi,
      eventName: 'MintAndWithdraw',
      args: { mintRecipient, mintToken: L1_USDC }
    }),
    data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [amount, 0n])
  }) as unknown as Log;

const arrived = () => {
  const result = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: 1n,
    facts: { cctp: { isOpen: true } }
  });
  if (result.status !== 'ok') throw new Error(result.reason);
  const bridge = createPendingBridge({
    account: BASE_BURN_TX.from,
    amount: BASE_BURN_AMOUNT * 10n ** 12n,
    from: 'base',
    to: 'ethereum',
    route: result.route,
    txHash: BASE_BURN_TX.hash,
    now: NOW
  });
  return applyProgress(bridge, { kind: 'arrived' }, NOW);
};

const HEAD = 30_000_000n;

/**
 * Ethereum `secondsPerBlock` (12 s by default) per block from the burn:
 * `receivedAfter` seconds after it, the receive mined in a block
 * `receivedAfter / secondsPerBlock` past the burn's.
 */
const chains = ({
  secondsPerBlock = 12n,
  receivedAfter = 600n,
  headAfter = 3_600n,
  logs = [receivedLog(BASE_BURN_ATTESTED.message)],
  minted = true,
  burnLogs = BASE_BURN_LOGS
}: {
  secondsPerBlock?: bigint;
  receivedAfter?: bigint;
  headAfter?: bigint;
  logs?: Log[];
  minted?: boolean;
  burnLogs?: readonly unknown[];
} = {}) => {
  const burnBlock = HEAD - headAfter / secondsPerBlock;
  const receiveBlock = burnBlock + receivedAfter / secondsPerBlock;
  const l2 = {
    getTransactionReceipt: vi.fn(async () => ({ status: 'success', blockNumber: 7n, logs: burnLogs })),
    getBlock: vi.fn(async () => ({ timestamp: BURNED_AT }))
  };
  const l1 = {
    getBlock: vi.fn(async ({ blockNumber }: { blockNumber?: bigint } = {}) =>
      blockNumber === undefined
        ? { number: HEAD, timestamp: BURNED_AT + headAfter }
        : { number: blockNumber, timestamp: BURNED_AT + (blockNumber - burnBlock) * secondsPerBlock }
    ),
    getLogs: vi.fn(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) =>
      minted && receiveBlock >= fromBlock && receiveBlock <= toBlock
        ? [{ address: TOKEN_MESSENGER_V2, blockNumber: receiveBlock, transactionHash: RECEIVE_TX }]
        : []
    ),
    getTransactionReceipt: vi.fn(async () => ({ status: 'success', transactionHash: RECEIVE_TX, logs }))
  };
  return { l1, l2, burnBlock };
};

const find = (setup: ReturnType<typeof chains>, bridge = arrived()) =>
  findOthersClaimReceipt({ l1: setup.l1 as never, l2: setup.l2 as never, bridge });

// APP-653: anyone can claim a CCTP transfer, so a claim this app never sent still has to tell whether it sold.
describe('findOthersClaimReceipt', () => {
  it('finds the receive someone else sent, by the mint to the recipient', async () => {
    const setup = chains();
    await expect(find(setup)).resolves.toMatchObject({ transactionHash: RECEIVE_TX });
    expect(setup.l1.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ address: TOKEN_MESSENGER_V2, args: { mintRecipient: RECIPIENT } })
    );
  });

  it('asks for at most the block range RPC providers cap logs at', async () => {
    const setup = chains({ receivedAfter: 60n, headAfter: 40n * 24n * 3_600n });
    await expect(find(setup)).resolves.toMatchObject({ transactionHash: RECEIVE_TX });
    for (const [{ fromBlock, toBlock }] of setup.l1.getLogs.mock.calls)
      expect(toBlock - fromBlock + 1n).toBeLessThanOrEqual(OTHERS_CLAIM_SCAN_CHUNK_BLOCKS);
    expect(setup.l1.getLogs.mock.calls.length).toBeGreaterThan(1);
  });

  it('scans from the head back to the burn, and no further', async () => {
    const setup = chains({ minted: false, headAfter: 3n * 24n * 3_600n });
    await expect(find(setup)).resolves.toBeNull();
    const calls = setup.l1.getLogs.mock.calls.map(([range]) => range);
    expect(calls[0].toBlock).toBe(HEAD);
    const lowest = calls.reduce((low, { fromBlock }) => (fromBlock < low ? fromBlock : low), HEAD);
    expect(lowest).toBeLessThanOrEqual(setup.burnBlock);
    expect(lowest).toBeGreaterThan(setup.burnBlock - OTHERS_CLAIM_SCAN_CHUNK_BLOCKS);
  });

  it('finds it when Ethereum mined blocks faster than its slots, as a fork does', async () => {
    const setup = chains({ secondsPerBlock: 2n });
    await expect(find(setup)).resolves.toMatchObject({ transactionHash: RECEIVE_TX });
  });

  it('scans back to the burn by block time, whatever the block rate', async () => {
    const setup = chains({ minted: false, secondsPerBlock: 2n });
    await expect(find(setup)).resolves.toBeNull();
    const lowest = setup.l1.getLogs.mock.calls.reduce(
      (low, [{ fromBlock }]) => (fromBlock < low ? fromBlock : low),
      HEAD
    );
    expect(lowest).toBeLessThanOrEqual(setup.burnBlock);
    expect(lowest).toBeGreaterThan(setup.burnBlock - OTHERS_CLAIM_SCAN_CHUNK_BLOCKS);
  });

  it('skips a mint to the recipient that holds no copy of this burn', async () => {
    await expect(find(chains({ logs: [usdsMint(RECIPIENT)] }))).resolves.toBeNull();
  });

  it('skips a mint mined before the burn: an identical earlier transfer', async () => {
    await expect(find(chains({ receivedAfter: -120n }))).resolves.toBeNull();
  });

  it("finds nothing when the burn isn't the one the app built for this bridge", async () => {
    await expect(find(chains({ burnLogs: [] }))).resolves.toBeNull();
  });

  it('fails when a read fails, so nothing is offered on a guess', async () => {
    const setup = chains();
    setup.l1.getLogs.mockRejectedValueOnce(new Error('rpc down'));
    await expect(find(setup)).rejects.toThrow('rpc down');
  });
});

describe('cctpConvertOffer, after a claim someone else sent', () => {
  const offer = (change: Partial<Parameters<typeof cctpConvertOffer>[0]> = {}) =>
    cctpConvertOffer({
      bridge: arrived(),
      account: BASE_BURN_TX.from,
      claimSold: false,
      usdcBalance: BASE_BURN_AMOUNT * 2n,
      othersClaimTxHash: RECEIVE_TX,
      ...change
    });

  it('offers the minted USDC to the recipient when that receive sold nothing', () => {
    expect(offer()).toBe(BASE_BURN_AMOUNT);
  });

  it('offers no more than the recipient still holds, and nothing once it holds none', () => {
    expect(offer({ usdcBalance: 5n })).toBe(5n);
    expect(offer({ usdcBalance: 0n })).toBeUndefined();
  });

  it('offers nothing when that receive sold it, or while that is unknown', () => {
    expect(offer({ claimSold: true })).toBeUndefined();
    expect(offer({ claimSold: undefined })).toBeUndefined();
  });

  it('offers it only to the recipient, and only once', () => {
    expect(offer({ account: FAIRY })).toBeUndefined();
    const converting = recordActionSent(arrived(), { action: 'convert', txHash: '0xsell', at: NOW });
    expect(offer({ bridge: converting })).toBeUndefined();
  });

  it('offers nothing while no receive was found', () => {
    expect(offer({ othersClaimTxHash: undefined })).toBeUndefined();
  });
});

describe('a receive that sold for USDS', () => {
  it('reads as sold from its receipt', async () => {
    const { claimSoldForUsds } = await import('./convert');
    expect(claimSoldForUsds([usdsMint(RECIPIENT)], RECIPIENT)).toBe(true);
  });
});

describe('othersClaimSold', () => {
  const RECEIVE_BLOCK = HEAD - 25_000n;
  const RECEIVED = 2_000_000n;
  const SALE_TX = `0x${'cd'.repeat(32)}` as Hex;
  const receive = (logs: Log[] = [usdcMinted(RECIPIENT, RECEIVED)]) =>
    ({ transactionHash: RECEIVE_TX, blockNumber: RECEIVE_BLOCK, logs }) as never;
  /** Ethereum with the USDS mints to the recipient at `mints`' blocks. */
  const l1 = (mints: { blockNumber: bigint; value: bigint; transactionHash?: Hex }[] = []) => ({
    getBlockNumber: vi.fn(async () => HEAD),
    getLogs: vi.fn(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) =>
      mints
        .filter(mint => mint.blockNumber >= fromBlock && mint.blockNumber <= toBlock)
        .map(({ blockNumber, value, transactionHash = SALE_TX }) => ({
          ...usdsMint(RECIPIENT, value),
          blockNumber,
          transactionHash,
          args: { from: zeroAddress, to: RECIPIENT, value }
        }))
    )
  });
  const sold = (chain: ReturnType<typeof l1>, from = receive()) =>
    othersClaimSold({ l1: chain as never, receive: from, recipient: RECIPIENT });

  it('reads sold from the receive itself, with no scan', async () => {
    const chain = l1();
    await expect(sold(chain, receive([usdcMinted(RECIPIENT, RECEIVED), usdsMint(RECIPIENT)]))).resolves.toBe(
      true
    );
    expect(chain.getLogs).not.toHaveBeenCalled();
  });

  it('reads sold when a later transaction minted the recipient the USDS of what it received', async () => {
    const chain = l1([{ blockNumber: RECEIVE_BLOCK + 1n, value: RECEIVED * 10n ** 12n }]);
    await expect(sold(chain)).resolves.toBe(true);
    expect(chain.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ address: L1_USDS, args: { from: zeroAddress, to: RECIPIENT } })
    );
  });

  it('reads unsold with no such mint, or only a smaller one, scanning the head back to the receive', async () => {
    const chain = l1([
      { blockNumber: RECEIVE_BLOCK + 5n, value: RECEIVED * 10n ** 12n - 1n },
      { blockNumber: RECEIVE_BLOCK - 1n, value: RECEIVED * 10n ** 12n }
    ]);
    await expect(sold(chain)).resolves.toBe(false);
    const ranges = chain.getLogs.mock.calls.map(([range]) => range);
    expect(ranges[0].toBlock).toBe(HEAD);
    for (const { fromBlock, toBlock } of ranges) {
      expect(toBlock - fromBlock + 1n).toBeLessThanOrEqual(OTHERS_CLAIM_SCAN_CHUNK_BLOCKS);
      expect(fromBlock).toBeGreaterThanOrEqual(RECEIVE_BLOCK);
    }
    expect(ranges.at(-1)!.fromBlock).toBe(RECEIVE_BLOCK);
  });

  it('reads sold past the reach of the scan, so nothing is offered on a guess', async () => {
    const chain = l1();
    const old = {
      transactionHash: RECEIVE_TX,
      blockNumber: HEAD - 400_000n,
      logs: [usdcMinted(RECIPIENT, RECEIVED)]
    };
    await expect(sold(chain, old as never)).resolves.toBe(true);
    expect(chain.getLogs).not.toHaveBeenCalled();
  });

  it('fails when a read fails', async () => {
    const chain = l1();
    chain.getLogs.mockRejectedValueOnce(new Error('rpc down'));
    await expect(sold(chain)).rejects.toThrow('rpc down');
  });
});
