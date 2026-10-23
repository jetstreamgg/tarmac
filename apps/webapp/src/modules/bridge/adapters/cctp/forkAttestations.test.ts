import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, getAddress, slice, type Hex, type Log } from 'viem';
import { createPendingBridge } from '../../model/pendingTransitions';
import { resolveBridgeRoute } from '../../model/resolveRoute';
import { getBridgeAdapter } from '../registry';
import type { AdapterContext, ChainReader } from '../types';
import { cctpProgress } from './cctpProgress';
import { BASE_BURN_AMOUNT, BASE_BURN_ATTESTED, BASE_BURN_LOGS, BASE_BURN_TX } from './cctpFixtures';
import { MESSAGE_TRANSMITTER_V2, TOKEN_MESSENGER_V2, messageTransmitterV2Abi } from './contracts';
import { forkAttestationReader } from './forkAttestations';

const RELAY_TX = `0x${'ab'.repeat(32)}` as Hex;
const RELAYER = '0x000000000000000000000000000000000000dEaD';

/** The MessageReceived the Ethereum MessageTransmitter emits when `message` is received. */
const receivedLog = (message: Hex): Log =>
  ({
    address: MESSAGE_TRANSMITTER_V2,
    topics: encodeEventTopics({
      abi: messageTransmitterV2Abi,
      eventName: 'MessageReceived',
      args: {
        caller: RELAYER,
        nonce: slice(message, 12, 44),
        finalityThresholdExecuted: Number(BigInt(slice(message, 144, 148)))
      }
    }),
    data: encodeAbiParameters(
      [{ type: 'uint32' }, { type: 'bytes32' }, { type: 'bytes' }],
      [Number(BigInt(slice(message, 4, 8))), slice(message, 44, 76), slice(message, 148)]
    ),
    transactionHash: RELAY_TX
  }) as unknown as Log;

/** Overwrites `bytes` at byte `offset` of a message. */
const patch = (message: Hex, offset: number, bytes: string) =>
  `${message.slice(0, 2 + offset * 2)}${bytes}${message.slice(2 + offset * 2 + bytes.length)}` as Hex;

const BURNED_AT = 1_800_000_000n;

const chains = ({
  relayed = [BASE_BURN_ATTESTED.message],
  relayedAt = BURNED_AT + 30n,
  used = 1n
}: { relayed?: Hex[]; relayedAt?: bigint; used?: bigint } = {}) => {
  const l2 = {
    getTransactionReceipt: vi.fn(async () => ({ status: 'success', blockNumber: 7n, logs: BASE_BURN_LOGS })),
    getBlock: vi.fn(async () => ({ timestamp: BURNED_AT }))
  };
  const l1 = {
    getBlockNumber: vi.fn(async () => 26_250_599n),
    getBlock: vi.fn(async () => ({ timestamp: relayedAt })),
    getLogs: vi.fn(async () =>
      relayed.length
        ? [{ address: TOKEN_MESSENGER_V2, blockNumber: 26_250_500n, transactionHash: RELAY_TX }]
        : []
    ),
    getTransactionReceipt: vi.fn(async () => ({ status: 'success', logs: relayed.map(receivedLog) })),
    readContract: vi.fn(async () => used)
  };
  const context: AdapterContext = {
    getClient: network =>
      (network === 'ethereum' ? l1 : network === 'base' ? l2 : undefined) as unknown as ChainReader
  };
  return { l1, l2, context };
};

const seed = () => {
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
    now: 1_800_000_000_000
  });
  return { ...bridge, from: 'base' as const };
};

// Tenderly attests and relays a fork burn itself, so Iris never knows it.
describe('forkAttestationReader (Tenderly multichain fork)', () => {
  it('reads the copy Tenderly received on Ethereum as the attested message', async () => {
    const { context } = chains();
    const attested = await forkAttestationReader(context)(6, BASE_BURN_TX.hash);
    expect(attested.map(({ message }) => message)).toEqual([BASE_BURN_ATTESTED.message]);
  });

  it('looks for the mint to the burn recipient only', async () => {
    const setup = chains();
    await forkAttestationReader(setup.context)(6, BASE_BURN_TX.hash);
    expect(setup.l1.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TOKEN_MESSENGER_V2,
        args: { mintRecipient: getAddress(BASE_BURN_TX.from) }
      })
    );
  });

  it('reads none while Tenderly has not relayed the burn', async () => {
    await expect(
      forkAttestationReader(chains({ relayed: [] }).context)(6, BASE_BURN_TX.hash)
    ).resolves.toEqual([]);
  });

  it("ignores a received message that isn't this burn", async () => {
    // Another amount (body offset 68) to the same recipient.
    const other = patch(BASE_BURN_ATTESTED.message, 148 + 68 + 31, '01');
    await expect(
      forkAttestationReader(chains({ relayed: [other] }).context)(6, BASE_BURN_TX.hash)
    ).resolves.toEqual([]);
  });

  it('ignores a message received from another source domain', async () => {
    const fromArbitrum = patch(BASE_BURN_ATTESTED.message, 4, '00000003');
    await expect(
      forkAttestationReader(chains({ relayed: [fromArbitrum] }).context)(6, BASE_BURN_TX.hash)
    ).resolves.toEqual([]);
  });

  it('ignores an identical transfer relayed before this burn', async () => {
    const { context } = chains({ relayedAt: BURNED_AT - 600n });
    await expect(forkAttestationReader(context)(6, BASE_BURN_TX.hash)).resolves.toEqual([]);
    await expect(
      cctpProgress(seed(), context, 1_800_000_000_000, forkAttestationReader(context))
    ).resolves.toEqual({ kind: 'waiting' });
  });

  it('reads a relay mined in the same second as the burn', async () => {
    const { context } = chains({ relayedAt: BURNED_AT });
    const attested = await forkAttestationReader(context)(6, BASE_BURN_TX.hash);
    expect(attested.map(({ message }) => message)).toEqual([BASE_BURN_ATTESTED.message]);
  });

  it('lets the bridge arrive once Tenderly relayed it', async () => {
    const { context } = chains();
    await expect(
      cctpProgress(seed(), context, 1_800_000_000_000, forkAttestationReader(context))
    ).resolves.toEqual({
      kind: 'arrived'
    });
  });

  it('keeps the bridge waiting while Tenderly has not relayed it', async () => {
    const { context } = chains({ relayed: [] });
    await expect(
      cctpProgress(seed(), context, 1_800_000_000_000, forkAttestationReader(context))
    ).resolves.toEqual({
      kind: 'waiting'
    });
  });
});

describe('CCTP adapter on the Tenderly multichain fork', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the fork instead of Iris', async () => {
    const iris = vi.fn(async () => new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', iris);
    const { context } = chains();
    await expect(
      getBridgeAdapter('cctp').checkProgress(seed(), 1_800_000_000_000, { ...context, onTenderlyFork: true })
    ).resolves.toEqual({ kind: 'arrived' });
    expect(iris).not.toHaveBeenCalled();
  });

  it('keeps reading Iris everywhere else', async () => {
    const iris = vi.fn(async () => new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', iris);
    const { context, l1 } = chains();
    await getBridgeAdapter('cctp').checkProgress(seed(), 1_800_000_000_000, context);
    expect(iris).toHaveBeenCalled();
    expect(l1.getLogs).not.toHaveBeenCalled();
  });
});
