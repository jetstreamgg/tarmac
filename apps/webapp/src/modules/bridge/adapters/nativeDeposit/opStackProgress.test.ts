import { describe, expect, it, vi } from 'vitest';
import { TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex } from 'viem';
import { applyProgress, createPendingBridge, recordActionSent } from '../../model/pendingTransitions';
import { resolveBridgeRoute } from '../../model/resolveRoute';
import type { PendingBridge } from '../../model/types';
import { SENT_ACTION_DROPPED_MS } from '../sentAction';
import type { AdapterContext, ChainReader } from '../types';
import { getBridgeAdapter } from '../registry';
import { BASE_DEPOSIT_LOGS, SAFE_EXECUTION_FAILURE } from './depositFixtures';
import { L2_CROSS_DOMAIN_MESSENGER } from './contracts';
import { opStackDepositMessage } from './opStack';
import { opStackDepositProgress } from './opStackProgress';

const NOW = 1_800_000_000_000;
const SOURCE = `0x${'5'.repeat(64)}`;
const REPLAY = `0x${'7'.repeat(64)}`;
const MESSAGE = opStackDepositMessage(BASE_DEPOSIT_LOGS, 'base')!;

const seed = (): PendingBridge & { to: 'base' } => {
  const result = resolveBridgeRoute({ from: 'ethereum', to: 'base', amount: 1n, facts: {} });
  if (result.status !== 'ok') throw new Error(result.reason);
  const bridge = createPendingBridge({
    account: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    amount: 1n,
    from: 'ethereum',
    to: 'base',
    route: result.route,
    txHash: SOURCE,
    now: NOW
  });
  return { ...bridge, to: 'base' };
};

type Messages = { successful?: boolean; failed?: boolean };

const chains = ({
  l1Status = 'success',
  l1Logs = BASE_DEPOSIT_LOGS,
  messages = {},
  replayStatus
}: {
  l1Status?: 'success' | 'reverted' | 'missing' | 'error';
  l1Logs?: unknown[];
  messages?: Messages | 'error';
  replayStatus?: 'success' | 'reverted' | 'missing';
} = {}) => {
  const l1 = {
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
      if (l1Status === 'missing') throw new TransactionReceiptNotFoundError({ hash });
      if (l1Status === 'error') throw new Error('rpc down');
      return { status: l1Status, logs: l1Logs };
    }),
    readContract: vi.fn()
  };
  const l2 = {
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
      if (replayStatus === undefined || replayStatus === 'missing')
        throw new TransactionReceiptNotFoundError({ hash });
      return { status: replayStatus, logs: [] };
    }),
    getTransaction: vi.fn(async ({ hash }: { hash: Hex }) => {
      throw new TransactionNotFoundError({ hash });
    }),
    readContract: vi.fn(async ({ functionName, args }: { functionName: string; args: [Hex] }) => {
      if (messages === 'error') throw new Error('rpc down');
      expect(args).toEqual([MESSAGE.msgHash]);
      return functionName === 'successfulMessages' ? !!messages.successful : !!messages.failed;
    })
  };
  const context: AdapterContext = {
    getClient: network =>
      (network === 'ethereum' ? l1 : network === 'base' ? l2 : undefined) as unknown as ChainReader
  };
  return { l1, l2, context };
};

describe('opStackDepositProgress', () => {
  it('waits while the L2 messenger has not relayed the message', async () => {
    const { context, l2 } = chains();
    await expect(opStackDepositProgress(seed(), context, NOW)).resolves.toEqual({ kind: 'waiting' });
    expect(l2.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: L2_CROSS_DOMAIN_MESSENGER, functionName: 'successfulMessages' })
    );
  });

  it('is arrived only once the messenger relayed the message', async () => {
    const { context } = chains({ messages: { successful: true } });
    await expect(opStackDepositProgress(seed(), context, NOW)).resolves.toEqual({ kind: 'arrived' });
  });

  it('is arrived after a replay, though the message stays in failedMessages', async () => {
    const { context } = chains({ messages: { successful: true, failed: true } });
    await expect(opStackDepositProgress(seed(), context, NOW)).resolves.toEqual({ kind: 'arrived' });
  });

  it('offers a replay of a failed relay, with the message to send again', async () => {
    const { context } = chains({ messages: { failed: true } });
    await expect(opStackDepositProgress(seed(), context, NOW)).resolves.toEqual({
      kind: 'ready',
      nextAction: 'replay',
      routeData: {
        msgHash: MESSAGE.msgHash,
        l2TxHash: MESSAGE.l2TxHash,
        relayCalldata: MESSAGE.relayCalldata
      }
    });
  });

  it('fails a deposit whose Ethereum transaction reverted', async () => {
    const { context } = chains({ l1Status: 'reverted' });
    await expect(opStackDepositProgress(seed(), context, NOW)).resolves.toEqual({
      kind: 'failed',
      reason: 'source-tx-reverted'
    });
  });

  it.each(['1.3.0', '1.4.1'] as const)(
    'fails a Safe deposit whose inner call failed (Safe %s), as it moved nothing',
    async version => {
      const { safe, logs } = SAFE_EXECUTION_FAILURE[version];
      const { context, l2 } = chains({ l1Logs: logs });
      await expect(opStackDepositProgress({ ...seed(), account: safe }, context, NOW)).resolves.toEqual({
        kind: 'failed',
        reason: 'safe-tx-reverted'
      });
      expect(l2.readContract).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['the Ethereum receipt is not there yet', { l1Status: 'missing' as const }],
    ['the Ethereum receipt read fails', { l1Status: 'error' as const }],
    ['the receipt holds no Sky message', { l1Logs: [] }],
    ["another Safe's execution failed", { l1Logs: SAFE_EXECUTION_FAILURE['1.4.1'].logs }],
    ['the L2 messenger read fails', { messages: 'error' as const }]
  ])('changes nothing when %s', async (_, setup) => {
    const { context } = chains(setup);
    await expect(opStackDepositProgress(seed(), context, NOW)).resolves.toBeNull();
  });

  it('changes nothing without a client for either network', async () => {
    await expect(opStackDepositProgress(seed(), { getClient: () => undefined }, NOW)).resolves.toBeNull();
  });

  describe('a sent replay', () => {
    const withSentReplay = (safe?: true) => {
      const ready = applyProgress(seed(), { kind: 'ready', nextAction: 'replay', routeData: MESSAGE }, NOW);
      return {
        ...recordActionSent(ready, { action: 'replay', txHash: REPLAY, at: NOW, ...(safe && { safe }) }),
        to: 'base' as const
      };
    };

    it('is confirmed by its mined L2 receipt', async () => {
      const { context } = chains({ messages: { successful: true }, replayStatus: 'success' });
      await expect(opStackDepositProgress(withSentReplay(), context, NOW)).resolves.toEqual({
        kind: 'action-confirmed',
        action: 'replay',
        txHash: REPLAY
      });
    });

    it('is dropped when it reverted', async () => {
      const { context } = chains({ messages: { failed: true }, replayStatus: 'reverted' });
      await expect(opStackDepositProgress(withSentReplay(), context, NOW)).resolves.toEqual({
        kind: 'action-dropped',
        txHash: REPLAY
      });
    });

    it('leaves the message read to go on while it is not mined', async () => {
      const { context } = chains({ messages: { failed: true }, replayStatus: 'missing' });
      await expect(opStackDepositProgress(withSentReplay(), context, NOW)).resolves.toMatchObject({
        kind: 'ready',
        nextAction: 'replay'
      });
    });

    it('is dropped once the L2 still does not know it after the drop window', async () => {
      const { context } = chains({ messages: { failed: true }, replayStatus: 'missing' });
      await expect(
        opStackDepositProgress(withSentReplay(), context, NOW + SENT_ACTION_DROPPED_MS)
      ).resolves.toEqual({ kind: 'action-dropped', txHash: REPLAY });
    });

    it('is left to the tracker when a Safe sent it', async () => {
      const { context, l2 } = chains({ messages: { failed: true } });
      await opStackDepositProgress(withSentReplay(true), context, NOW);
      expect(l2.getTransactionReceipt).not.toHaveBeenCalled();
    });

    it('once the bridge arrived, is the only thing read', async () => {
      const arrived = { ...applyProgress(withSentReplay(), { kind: 'arrived' }, NOW), to: 'base' as const };
      const { context, l1 } = chains({ messages: { successful: true }, replayStatus: 'missing' });
      await expect(opStackDepositProgress(arrived, context, NOW)).resolves.toBeNull();
      expect(l1.getTransactionReceipt).not.toHaveBeenCalled();
      const mined = chains({ messages: { successful: true }, replayStatus: 'success' });
      await expect(opStackDepositProgress(arrived, mined.context, NOW)).resolves.toEqual({
        kind: 'action-confirmed',
        action: 'replay',
        txHash: REPLAY
      });
    });

    it('confirmed, takes the bridge back to pending until the message reads as relayed', () => {
      const confirmed = applyProgress(
        withSentReplay(),
        { kind: 'action-confirmed', action: 'replay', txHash: REPLAY },
        NOW
      );
      expect(confirmed).toMatchObject({ status: 'pending', actions: [{ action: 'replay', txHash: REPLAY }] });
    });
  });

  it('runs for Ethereum to OP Stack deposits through the registry', async () => {
    const { context } = chains({ messages: { successful: true } });
    await expect(getBridgeAdapter('native').checkProgress(seed(), NOW, context)).resolves.toEqual({
      kind: 'arrived'
    });
  });
});
