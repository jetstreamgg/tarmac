import { describe, expect, it, vi } from 'vitest';
import { TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex, type Log } from 'viem';
import {
  applyProgress,
  createPendingBridge,
  recordAction,
  recordActionSent
} from '../../model/pendingTransitions';
import { resolveBridgeRoute } from '../../model/resolveRoute';
import type { PendingBridge } from '../../model/types';
import { SENT_ACTION_DROPPED_MS } from '../sentAction';
import type { AdapterContext, ChainReader } from '../types';
import { cctpClaimMessage, cctpProgress } from './cctpProgress';
import {
  BASE_BURN_AMOUNT,
  BASE_BURN_ATTESTED,
  BASE_BURN_LOGS,
  BASE_BURN_MINT_RECIPIENT,
  BASE_BURN_TX
} from './cctp.fixtures';
import { MESSAGE_TRANSMITTER_V2 } from './contracts';
import type { AttestationReader, IrisAttestedMessage } from './iris';

const NOW = 1_800_000_000_000;
const CLAIM = `0x${'7'.repeat(64)}`;
const ATTESTED: IrisAttestedMessage = {
  message: BASE_BURN_ATTESTED.message,
  attestation: BASE_BURN_ATTESTED.attestation
};
const READY = {
  kind: 'ready',
  nextAction: 'claim',
  routeData: { cctpMessage: ATTESTED.message, cctpAttestation: ATTESTED.attestation }
};

const seed = (overrides: Partial<PendingBridge> = {}): PendingBridge & { from: 'base' } => {
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
  return { ...bridge, ...overrides, from: 'base' };
};

const chains = ({
  l2Status = 'success',
  l2Logs = BASE_BURN_LOGS,
  used = 0n,
  block = 26_000_000n,
  claimStatus,
  attested = [ATTESTED]
}: {
  l2Status?: 'success' | 'reverted' | 'error';
  l2Logs?: readonly Log[];
  used?: bigint | 'error';
  block?: bigint;
  claimStatus?: 'success' | 'reverted' | 'missing';
  attested?: IrisAttestedMessage[] | 'error';
} = {}) => {
  const l2 = {
    getTransactionReceipt: vi.fn(async () => {
      if (l2Status === 'error') throw new Error('rpc down');
      return { status: l2Status, logs: l2Logs };
    })
  };
  const l1 = {
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
      if (claimStatus === undefined || claimStatus === 'missing')
        throw new TransactionReceiptNotFoundError({ hash });
      return { status: claimStatus, logs: [] };
    }),
    getTransaction: vi.fn(async ({ hash }: { hash: Hex }) => {
      throw new TransactionNotFoundError({ hash });
    }),
    getBlockNumber: vi.fn(async () => block),
    readContract: vi.fn(
      async ({ address, functionName, args }: { address: Hex; functionName: string; args: [Hex] }) => {
        if (used === 'error') throw new Error('rpc down');
        expect(address).toBe(MESSAGE_TRANSMITTER_V2);
        expect(functionName).toBe('usedNonces');
        expect(args).toEqual([BASE_BURN_ATTESTED.nonce]);
        return used;
      }
    )
  };
  const readAttestations = vi.fn<AttestationReader>(async () => {
    if (attested === 'error') throw new Error('Iris responded 429');
    return attested;
  });
  const context: AdapterContext = {
    getClient: network =>
      (network === 'ethereum' ? l1 : network === 'base' ? l2 : undefined) as unknown as ChainReader
  };
  return { l1, l2, context, readAttestations };
};

// The transitions keep `from`, so every bridge here is still from Base.
const progress = (bridge: PendingBridge, setup: ReturnType<typeof chains>, now = NOW) =>
  cctpProgress(bridge as PendingBridge & { from: 'base' }, setup.context, now, setup.readAttestations);

/** Overwrites `bytes` at byte `offset` of a message. */
const patch = (message: Hex, offset: number, bytes: string) =>
  `${message.slice(0, 2 + offset * 2)}${bytes}${message.slice(2 + offset * 2 + bytes.length)}` as Hex;

describe('cctpProgress (golden: Base burn 0x5bb3d46a…6b6a)', () => {
  it('waits while Circle has not attested the burn', async () => {
    const setup = chains({ attested: [] });
    await expect(progress(seed(), setup)).resolves.toEqual({ kind: 'waiting' });
    expect(setup.readAttestations).toHaveBeenCalledWith(6, BASE_BURN_TX.hash);
    expect(setup.l1.readContract).not.toHaveBeenCalled();
  });

  it('offers the claim with the attested message once Circle attested it', async () => {
    await expect(progress(seed(), chains())).resolves.toEqual(READY);
  });

  it('arrives once the nonce is used on Ethereum, by any claim', async () => {
    await expect(progress(seed(), chains({ used: 1n }))).resolves.toEqual({ kind: 'arrived' });
  });

  it('claims with the stored message and asks Iris no more', async () => {
    const setup = chains();
    const ready = applyProgress(seed(), (await progress(seed(), setup))!, NOW);
    expect(cctpClaimMessage(ready.routeData)).toEqual(ATTESTED);
    setup.readAttestations.mockClear();
    await expect(progress(ready, setup)).resolves.toEqual(READY);
    expect(setup.readAttestations).not.toHaveBeenCalled();
  });

  it('asks Iris again when the stored message is not a copy of the burn', async () => {
    const setup = chains();
    const stored = seed({
      routeData: { cctpMessage: patch(ATTESTED.message, 148 + 68, '0'.repeat(64)), cctpAttestation: '0x01' }
    });
    await expect(progress(stored, setup)).resolves.toEqual(READY);
    expect(setup.readAttestations).toHaveBeenCalled();
  });

  it("never claims an attested message that isn't this burn's", async () => {
    const other = { ...ATTESTED, message: patch(ATTESTED.message, 148 + 36, '1'.repeat(64)) };
    await expect(progress(seed(), chains({ attested: [other] }))).resolves.toEqual({ kind: 'waiting' });
  });

  it('never reads usedNonces with the zero nonce of the unattested message', async () => {
    const source = BASE_BURN_LOGS.find(
      log => log.address.toLowerCase() === MESSAGE_TRANSMITTER_V2.toLowerCase()
    )!;
    // The MessageSent message as Iris would echo it before attesting: nonce and finality still zero.
    const unattested = `0x${source.data.slice(2 + 128, 2 + 128 + 376 * 2)}` as Hex;
    const setup = chains({ attested: [{ message: unattested, attestation: ATTESTED.attestation }] });
    await expect(progress(seed(), setup)).resolves.toEqual({ kind: 'waiting' });
    expect(setup.l1.readContract).not.toHaveBeenCalled();
  });

  it('waits for a new attestation once the message is past its expiration block', async () => {
    const expiring = {
      ...ATTESTED,
      message: patch(ATTESTED.message, 148 + 196, 100n.toString(16).padStart(64, '0'))
    };
    await expect(progress(seed(), chains({ attested: [expiring], block: 100n }))).resolves.toEqual({
      kind: 'waiting'
    });
    await expect(progress(seed(), chains({ attested: [expiring], block: 99n }))).resolves.toMatchObject({
      kind: 'ready'
    });
  });

  it('fails when the burn reverted on the L2', async () => {
    await expect(progress(seed(), chains({ l2Status: 'reverted' }))).resolves.toEqual({
      kind: 'failed',
      reason: 'source-tx-reverted'
    });
  });

  it.each([
    ['another amount', { amount: (BASE_BURN_AMOUNT + 1n) * 10n ** 12n }],
    ['another sender', { account: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f' }],
    ['another recipient', { recipient: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' }]
  ])("changes nothing when the receipt's burn has %s", async (_, change) => {
    const setup = chains();
    await expect(progress(seed(change), setup)).resolves.toBeNull();
    expect(setup.readAttestations).not.toHaveBeenCalled();
  });

  it('matches the default recipient, the sender, when the bridge stored none', async () => {
    expect(BASE_BURN_MINT_RECIPIENT.toLowerCase()).toBe(BASE_BURN_TX.from.toLowerCase());
    await expect(progress(seed({ recipient: BASE_BURN_MINT_RECIPIENT }), chains())).resolves.toEqual(READY);
  });

  it('offers nothing when the receipt holds two identical burns', async () => {
    const setup = chains({ l2Logs: [...BASE_BURN_LOGS, ...BASE_BURN_LOGS] });
    await expect(progress(seed(), setup)).resolves.toBeNull();
  });

  it.each([
    ['the L2 receipt', { l2Status: 'error' as const }],
    ['Iris', { attested: 'error' as const }],
    ['usedNonces', { used: 'error' as const }]
  ])('changes nothing when %s fails', async (_, failure) => {
    await expect(progress(seed(), chains(failure))).resolves.toBeNull();
  });

  it('changes nothing without both clients or a source hash', async () => {
    const setup = chains();
    const onlyL2: AdapterContext = {
      getClient: network => setup.context.getClient(network === 'base' ? 'base' : 'avalanche')
    };
    await expect(cctpProgress(seed(), onlyL2, NOW, setup.readAttestations)).resolves.toBeNull();
    await expect(progress(seed({ txHash: undefined }), setup)).resolves.toBeNull();
  });

  describe('a claim sent from this browser', () => {
    const sent = (at = NOW) => recordActionSent(seed(), { action: 'claim', txHash: CLAIM, at });

    it('confirms it from its Ethereum receipt', async () => {
      await expect(progress(sent(), chains({ claimStatus: 'success' }))).resolves.toEqual({
        kind: 'action-confirmed',
        action: 'claim',
        txHash: CLAIM
      });
    });

    it('drops it when it reverted', async () => {
      await expect(progress(sent(), chains({ claimStatus: 'reverted' }))).resolves.toEqual({
        kind: 'action-dropped',
        txHash: CLAIM
      });
    });

    it('reads the bridge while it may still mine', async () => {
      await expect(progress(sent(), chains({ claimStatus: 'missing' }))).resolves.toEqual(READY);
    });

    it('drops it once Ethereum still has no trace of it', async () => {
      await expect(
        progress(sent(), chains({ claimStatus: 'missing' }), NOW + SENT_ACTION_DROPPED_MS)
      ).resolves.toEqual({ kind: 'action-dropped', txHash: CLAIM });
    });
  });

  describe('a convert sent after the claim settled', () => {
    const SELL = `0x${'5'.repeat(64)}`;
    const claimed = () =>
      recordAction(applyProgress(seed(), READY as never, NOW), { action: 'claim', txHash: CLAIM, at: NOW });
    const sent = (safe = false) =>
      recordActionSent(claimed(), { action: 'convert', txHash: SELL, at: NOW, ...(safe && { safe: true }) });

    it('confirms it from its Ethereum receipt', async () => {
      await expect(progress(sent(), chains({ claimStatus: 'success' }))).resolves.toEqual({
        kind: 'action-confirmed',
        action: 'convert',
        txHash: SELL
      });
    });

    it('drops it when it reverted, or once Ethereum still has no trace of it', async () => {
      await expect(progress(sent(), chains({ claimStatus: 'reverted' }))).resolves.toEqual({
        kind: 'action-dropped',
        txHash: SELL
      });
      await expect(
        progress(sent(), chains({ claimStatus: 'missing' }), NOW + SENT_ACTION_DROPPED_MS)
      ).resolves.toEqual({ kind: 'action-dropped', txHash: SELL });
    });

    // The bridge itself is settled: nothing else is read for it.
    it('changes nothing while it may still mine, and reads nothing more', async () => {
      const setup = chains({ claimStatus: 'missing' });
      await expect(progress(sent(), setup)).resolves.toBeNull();
      expect(setup.l2.getTransactionReceipt).not.toHaveBeenCalled();
      expect(setup.readAttestations).not.toHaveBeenCalled();
    });

    it("leaves a Safe's convert to the tracker and reads nothing for a settled bridge", async () => {
      for (const bridge of [sent(true), claimed()]) {
        const setup = chains({ claimStatus: 'success' });
        await expect(progress(bridge, setup)).resolves.toBeNull();
        expect(setup.l1.getTransactionReceipt).not.toHaveBeenCalled();
        expect(setup.l2.getTransactionReceipt).not.toHaveBeenCalled();
      }
    });
  });

  // Its calls id is no transaction hash: the tracker asks the wallet how the bundle ended.
  describe('a claim or convert sent as a wallet bundle', () => {
    const CALLS = '0xcallsid';
    const claimed = () =>
      recordAction(applyProgress(seed(), READY as never, NOW), { action: 'claim', txHash: CLAIM, at: NOW });

    it('reads the bridge for a bundled claim, never a receipt under its calls id', async () => {
      const setup = chains({ claimStatus: 'success' });
      const sent = recordActionSent(seed(), { action: 'claim', txHash: CALLS, at: NOW, bundle: true });
      await expect(progress(sent, setup, NOW + SENT_ACTION_DROPPED_MS)).resolves.toEqual(READY);
      expect(setup.l1.getTransactionReceipt).not.toHaveBeenCalled();
    });

    it('reads nothing for a bundled convert of a settled bridge', async () => {
      const setup = chains({ claimStatus: 'success' });
      const sent = recordActionSent(claimed(), { action: 'convert', txHash: CALLS, at: NOW, bundle: true });
      await expect(progress(sent, setup, NOW + SENT_ACTION_DROPPED_MS)).resolves.toBeNull();
      expect(setup.l1.getTransactionReceipt).not.toHaveBeenCalled();
    });
  });

  it('walks a bridge from pending to claimed', async () => {
    let bridge: PendingBridge = seed();
    bridge = applyProgress(bridge, (await progress(bridge, chains({ attested: [] })))!, NOW);
    expect(bridge.status).toBe('pending');
    bridge = applyProgress(bridge, (await progress(bridge, chains()))!, NOW);
    expect(bridge.status).toBe('ready');
    bridge = recordActionSent(bridge, { action: 'claim', txHash: CLAIM, at: NOW });
    bridge = applyProgress(bridge, (await progress(bridge, chains({ claimStatus: 'success' })))!, NOW);
    expect(bridge.status).toBe('claimed');
    expect(bridge.actions).toEqual([{ action: 'claim', txHash: CLAIM, at: NOW }]);
    // Settled: the used nonce is not read again.
    await expect(progress(bridge, chains({ used: 1n }))).resolves.toBeNull();
  });
});
