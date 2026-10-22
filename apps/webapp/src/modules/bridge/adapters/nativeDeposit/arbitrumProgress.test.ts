import { describe, expect, it, vi } from 'vitest';
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  pad,
  toEventSelector,
  type Hex,
  type Log
} from 'viem';
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
import { getBridgeAdapter } from '../registry';
import { ARBITRUM_DEPOSIT_LOGS, ARBITRUM_TICKET, SAFE_EXECUTION_FAILURE } from './depositFixtures';
import { ARB_RETRYABLE_TX, arbRetryableTxAbi } from './contracts';
import { TICKET_SCAN_CHUNK_BLOCKS, arbitrumDepositProgress } from './arbitrumProgress';

const NOW = 1_800_000_000_000;
const SOURCE = `0x${'5'.repeat(64)}`;
const REDEEM = `0x${'7'.repeat(64)}` as Hex;
const RETRY = `0x${'8'.repeat(64)}` as Hex;
const DAY = 86_400n;
const LIFETIME = 7n * DAY;
const CREATED_AT = 1_740_000_000n;
// Arbitrum One makes about four blocks a second.
const timestampOf = (block: bigint) => CREATED_AT + (block - ARBITRUM_TICKET.creationBlock) / 4n;
const blockAfter = (seconds: bigint) => ARBITRUM_TICKET.creationBlock + seconds * 4n;
const { ticketId } = ARBITRUM_TICKET;

const seed = (): PendingBridge => {
  const result = resolveBridgeRoute({ from: 'ethereum', to: 'arbitrum', amount: 1n, facts: {} });
  if (result.status !== 'ok') throw new Error(result.reason);
  return createPendingBridge({
    account: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    amount: 1n,
    from: 'ethereum',
    to: 'arbitrum',
    route: result.route,
    txHash: SOURCE,
    now: NOW
  });
};

const redeemScheduled = (retry: Hex, ticket: Hex = ticketId, address: string = ARB_RETRYABLE_TX): Log =>
  ({
    address,
    topics: [
      toEventSelector(
        'event RedeemScheduled(bytes32 indexed ticketId, bytes32 indexed retryTxHash, uint64 indexed sequenceNum, uint64 donatedGas, address gasDonor, uint256 maxRefund, uint256 submissionFeeRefund)'
      ),
      ticket,
      retry,
      pad('0x1')
    ],
    data: ARBITRUM_TICKET.redeemLogs[0].data
  }) as unknown as Log;

const noTicket = () =>
  new ContractFunctionExecutionError(
    new ContractFunctionRevertedError({
      abi: arbRetryableTxAbi,
      data: '0x80698456',
      functionName: 'getTimeout'
    }),
    {
      abi: arbRetryableTxAbi,
      functionName: 'getTimeout',
      args: [ticketId],
      contractAddress: ARB_RETRYABLE_TX
    }
  );

type Receipt = { status: 'success' | 'reverted'; logs: Log[]; blockNumber?: bigint };
type ScanLog = {
  event: 'RedeemScheduled' | 'LifetimeExtended';
  block: bigint;
  retryTxHash?: Hex;
  newTimeout?: bigint;
};

const chains = ({
  l1Status = 'success',
  l1Logs = ARBITRUM_DEPOSIT_LOGS,
  receipts = {},
  timeout = 'none',
  latest = blockAfter(30n * DAY),
  scanLogs = [],
  failGetLogsFrom
}: {
  l1Status?: 'success' | 'reverted';
  l1Logs?: Log[];
  receipts?: Record<string, Receipt | 'error'>;
  timeout?: bigint | 'none' | 'error';
  latest?: bigint;
  scanLogs?: ScanLog[];
  failGetLogsFrom?: bigint;
} = {}) => {
  const l1 = {
    getTransactionReceipt: vi.fn(async () => ({ status: l1Status, logs: l1Logs }))
  };
  const l2 = {
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
      const receipt = receipts[hash];
      if (receipt === 'error') throw new Error('rpc down');
      if (!receipt) throw new TransactionReceiptNotFoundError({ hash });
      return receipt;
    }),
    getTransaction: vi.fn(async ({ hash }: { hash: Hex }) => {
      throw new TransactionNotFoundError({ hash });
    }),
    readContract: vi.fn(async ({ functionName, args }: { functionName: string; args?: [Hex] }) => {
      if (functionName === 'getLifetime') return LIFETIME;
      expect(args).toEqual([ticketId]);
      if (timeout === 'none') throw noTicket();
      if (timeout === 'error') throw new Error('rpc down');
      return timeout;
    }),
    getBlockNumber: vi.fn(async () => latest),
    getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({
      timestamp: timestampOf(blockNumber)
    })),
    getLogs: vi.fn(
      async ({
        event,
        fromBlock,
        toBlock
      }: {
        event: { name: string };
        fromBlock: bigint;
        toBlock: bigint;
      }) => {
        if (failGetLogsFrom !== undefined && fromBlock >= failGetLogsFrom) throw new Error('range too large');
        return scanLogs
          .filter(log => log.event === event.name && log.block >= fromBlock && log.block <= toBlock)
          .map(log => ({ args: { ticketId, retryTxHash: log.retryTxHash, newTimeout: log.newTimeout } }));
      }
    )
  };
  const context: AdapterContext = {
    getClient: network =>
      (network === 'ethereum' ? l1 : network === 'arbitrum' ? l2 : undefined) as unknown as ChainReader
  };
  return { l1, l2, context };
};

const CREATED: Receipt = {
  status: 'success',
  logs: ARBITRUM_TICKET.creationLogs as unknown as Log[],
  blockNumber: ARBITRUM_TICKET.creationBlock
};

describe('arbitrumDepositProgress', () => {
  it('waits while ArbOS has not created the ticket', async () => {
    const { context, l2 } = chains();
    await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toEqual({ kind: 'waiting' });
    expect(l2.getTransactionReceipt).toHaveBeenCalledWith({ hash: ticketId });
    expect(l2.readContract).not.toHaveBeenCalled();
  });

  it('arrives when the auto-redeem retry succeeded', async () => {
    const { context, l2 } = chains({
      receipts: {
        [ticketId]: { ...CREATED, logs: [...CREATED.logs, redeemScheduled(RETRY)] },
        [RETRY]: { status: 'success', logs: [] }
      }
    });
    await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toEqual({ kind: 'arrived' });
    expect(l2.readContract).not.toHaveBeenCalled();
  });

  it('offers a redeem, with its timeout, while the ticket is alive', async () => {
    const { context } = chains({
      receipts: {
        [ticketId]: { ...CREATED, logs: [...CREATED.logs, redeemScheduled(RETRY)] },
        [RETRY]: { status: 'reverted', logs: [] }
      },
      timeout: CREATED_AT + LIFETIME
    });
    await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toEqual({
      kind: 'ready',
      nextAction: 'redeem',
      routeData: { ticketId, timeout: (CREATED_AT + LIFETIME).toString() }
    });
  });

  it('reads the ticket at the block the scan ends on', async () => {
    const latest = ARBITRUM_TICKET.creationBlock + 10n;
    const { context, l2 } = chains({ receipts: { [ticketId]: CREATED }, timeout: 1n, latest });
    await arbitrumDepositProgress(seed(), context, NOW);
    expect(l2.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'getTimeout', blockNumber: latest })
    );
  });

  it('ignores a RedeemScheduled log that ArbRetryableTx did not emit, or for another ticket', async () => {
    const { context } = chains({
      receipts: {
        [ticketId]: {
          ...CREATED,
          logs: [
            redeemScheduled(RETRY, ticketId, '0x000000000000000000000000000000000000dEaD'),
            redeemScheduled(RETRY, `0x${'9'.repeat(64)}`)
          ]
        },
        [RETRY]: { status: 'success', logs: [] }
      },
      timeout: 1n
    });
    await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toMatchObject({ kind: 'ready' });
  });

  describe('a ticket ArbOS no longer has', () => {
    it('arrives on the real manual redeem found by the scan', async () => {
      const { context, l2 } = chains({
        receipts: { [ticketId]: CREATED, [ARBITRUM_TICKET.retryTxHash]: { status: 'success', logs: [] } },
        latest: ARBITRUM_TICKET.redeemBlock + 1_000n,
        scanLogs: [
          {
            event: 'RedeemScheduled',
            block: ARBITRUM_TICKET.redeemBlock,
            retryTxHash: ARBITRUM_TICKET.retryTxHash
          }
        ]
      });
      await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toEqual({ kind: 'arrived' });
      expect(l2.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          address: ARB_RETRYABLE_TX,
          args: { ticketId },
          fromBlock: ARBITRUM_TICKET.creationBlock,
          strict: true
        })
      );
    });

    it('expires after a clean scan a day past the timeout, without reading to the latest block', async () => {
      const { context, l2 } = chains({ receipts: { [ticketId]: CREATED } });
      await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toEqual({ kind: 'expired' });
      // The scan stops in the chunk that passes 8 days; the latest block is 30 days out.
      const scanned = l2.getLogs.mock.calls.map(([params]) => Number(params.toBlock));
      expect(Math.max(...scanned)).toBeGreaterThan(Number(blockAfter(8n * DAY)));
      expect(Math.max(...scanned)).toBeLessThan(Number(blockAfter(8n * DAY) + TICKET_SCAN_CHUNK_BLOCKS));
    });

    it('follows a keepalive past the first timeout', async () => {
      const extendedTo = CREATED_AT + 3n * LIFETIME;
      const redeemBlock = blockAfter(2n * LIFETIME);
      const { context } = chains({
        receipts: { [ticketId]: CREATED, [RETRY]: { status: 'success', logs: [] } },
        latest: blockAfter(40n * DAY),
        scanLogs: [
          { event: 'LifetimeExtended', block: blockAfter(6n * DAY), newTimeout: extendedTo },
          { event: 'RedeemScheduled', block: redeemBlock, retryTxHash: RETRY }
        ]
      });
      await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toEqual({ kind: 'arrived' });
    });

    it('expires when the only retries failed (a canceled or expired ticket)', async () => {
      const { context } = chains({
        receipts: { [ticketId]: CREATED, [RETRY]: { status: 'reverted', logs: [] } },
        latest: ARBITRUM_TICKET.creationBlock + 100n,
        scanLogs: [
          { event: 'RedeemScheduled', block: ARBITRUM_TICKET.creationBlock + 50n, retryTxHash: RETRY }
        ]
      });
      await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toEqual({ kind: 'expired' });
    });

    it('changes nothing when the scan fails part way', async () => {
      const { context } = chains({
        receipts: { [ticketId]: CREATED },
        failGetLogsFrom: ARBITRUM_TICKET.creationBlock + TICKET_SCAN_CHUNK_BLOCKS
      });
      await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toBeNull();
    });

    it('changes nothing while a retry found by the scan has no receipt yet', async () => {
      const { context } = chains({
        receipts: { [ticketId]: CREATED },
        latest: ARBITRUM_TICKET.creationBlock + 100n,
        scanLogs: [
          { event: 'RedeemScheduled', block: ARBITRUM_TICKET.creationBlock + 50n, retryTxHash: RETRY }
        ]
      });
      await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toBeNull();
    });

    it("changes nothing while the auto-redeem's retry has no receipt yet", async () => {
      const { context } = chains({
        receipts: { [ticketId]: { ...CREATED, logs: [...CREATED.logs, redeemScheduled(RETRY)] } }
      });
      await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toBeNull();
    });

    it('arrives on a later successful retry even when an earlier one has no receipt', async () => {
      const { context } = chains({
        receipts: { [ticketId]: CREATED, [REDEEM]: { status: 'success', logs: [] } },
        latest: ARBITRUM_TICKET.creationBlock + 100n,
        scanLogs: [
          { event: 'RedeemScheduled', block: ARBITRUM_TICKET.creationBlock + 10n, retryTxHash: RETRY },
          { event: 'RedeemScheduled', block: ARBITRUM_TICKET.creationBlock + 50n, retryTxHash: REDEEM }
        ]
      });
      await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toEqual({ kind: 'arrived' });
    });

    it('changes nothing when a found retry receipt fails to read', async () => {
      const { context } = chains({
        receipts: { [ticketId]: CREATED, [RETRY]: 'error' },
        scanLogs: [
          { event: 'RedeemScheduled', block: ARBITRUM_TICKET.creationBlock + 5n, retryTxHash: RETRY }
        ]
      });
      await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toBeNull();
    });
  });

  it('changes nothing on a failed ticket read', async () => {
    const { context } = chains({ receipts: { [ticketId]: CREATED }, timeout: 'error' });
    await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toBeNull();
  });

  it('never ends on a failed ticket creation', async () => {
    const { context } = chains({ receipts: { [ticketId]: { ...CREATED, status: 'reverted' } } });
    await expect(arbitrumDepositProgress(seed(), context, NOW)).resolves.toBeNull();
  });

  it('fails a reverted deposit, and a Safe deposit whose execution failed', async () => {
    await expect(
      arbitrumDepositProgress(seed(), chains({ l1Status: 'reverted' }).context, NOW)
    ).resolves.toEqual({
      kind: 'failed',
      reason: 'source-tx-reverted'
    });
    const { safe, logs } = SAFE_EXECUTION_FAILURE['1.4.1'];
    const bridge = { ...seed(), account: safe.toLowerCase() };
    await expect(arbitrumDepositProgress(bridge, chains({ l1Logs: logs }).context, NOW)).resolves.toEqual({
      kind: 'failed',
      reason: 'safe-tx-reverted'
    });
    await expect(arbitrumDepositProgress(seed(), chains({ l1Logs: logs }).context, NOW)).resolves.toBeNull();
  });

  describe('a redeem this bridge sent', () => {
    const sent = (safe = false) =>
      recordActionSent(
        applyProgress(seed(), { kind: 'ready', nextAction: 'redeem', routeData: { ticketId } }, NOW),
        { action: 'redeem', txHash: REDEEM, at: NOW, ...(safe && { safe: true as const }) }
      );

    it('is confirmed or dropped by its receipt', async () => {
      const mined = chains({ receipts: { [REDEEM]: { status: 'success', logs: [] } } });
      await expect(arbitrumDepositProgress(sent(), mined.context, NOW)).resolves.toEqual({
        kind: 'action-confirmed',
        action: 'redeem',
        txHash: REDEEM
      });
      const reverted = chains({ receipts: { [REDEEM]: { status: 'reverted', logs: [] } } });
      await expect(arbitrumDepositProgress(sent(), reverted.context, NOW)).resolves.toEqual({
        kind: 'action-dropped',
        txHash: REDEEM
      });
    });

    it('waits while not mined, then is dropped once Arbitrum still does not know it', async () => {
      const { context } = chains();
      // Not settled: the ticket's own read goes on.
      await expect(arbitrumDepositProgress(sent(), context, NOW)).resolves.toEqual({ kind: 'waiting' });
      await expect(arbitrumDepositProgress(sent(), context, NOW + SENT_ACTION_DROPPED_MS)).resolves.toEqual({
        kind: 'action-dropped',
        txHash: REDEEM
      });
    });

    it('is left to the tracker when a Safe sent it', async () => {
      const { context } = chains({ receipts: { [REDEEM]: { status: 'success', logs: [] } } });
      await expect(arbitrumDepositProgress(sent(true), context, NOW)).resolves.toEqual({ kind: 'waiting' });
    });

    it('arrives on its own retry once confirmed, without a scan', async () => {
      const confirmed = recordAction(sent(), { action: 'redeem', txHash: REDEEM, at: NOW });
      const { context, l2 } = chains({
        receipts: {
          [ticketId]: CREATED,
          [REDEEM]: { status: 'success', logs: [redeemScheduled(RETRY)] },
          [RETRY]: { status: 'success', logs: [] }
        }
      });
      await expect(arbitrumDepositProgress(confirmed, context, NOW)).resolves.toEqual({ kind: 'arrived' });
      expect(l2.getLogs).not.toHaveBeenCalled();
    });

    it('is offered again when its retry failed', async () => {
      const confirmed = recordAction(sent(), { action: 'redeem', txHash: REDEEM, at: NOW });
      const { context } = chains({
        receipts: {
          [ticketId]: CREATED,
          [REDEEM]: { status: 'success', logs: [redeemScheduled(RETRY)] },
          [RETRY]: { status: 'reverted', logs: [] }
        },
        timeout: CREATED_AT + LIFETIME
      });
      const progress = await arbitrumDepositProgress(confirmed, context, NOW);
      expect(progress).toMatchObject({ kind: 'ready', nextAction: 'redeem' });
      expect(applyProgress(confirmed, progress!, NOW)).toMatchObject({
        status: 'ready',
        nextAction: 'redeem'
      });
    });
  });

  describe('a keepalive this bridge sent', () => {
    const KEEPALIVE = `0x${'9'.repeat(64)}` as Hex;
    const OLD = CREATED_AT + LIFETIME;
    const sent = () =>
      recordActionSent(
        applyProgress(
          seed(),
          { kind: 'ready', nextAction: 'redeem', routeData: { ticketId, timeout: OLD.toString() } },
          NOW
        ),
        { action: 'keepalive', txHash: KEEPALIVE, at: NOW }
      );

    it('is confirmed or dropped by its receipt', async () => {
      const mined = chains({ receipts: { [KEEPALIVE]: { status: 'success', logs: [] } } });
      await expect(arbitrumDepositProgress(sent(), mined.context, NOW)).resolves.toEqual({
        kind: 'action-confirmed',
        action: 'keepalive',
        txHash: KEEPALIVE
      });
      // A ticket redeemed or expired before it mined reverts it with NoTicketWithID.
      const reverted = chains({ receipts: { [KEEPALIVE]: { status: 'reverted', logs: [] } } });
      await expect(arbitrumDepositProgress(sent(), reverted.context, NOW)).resolves.toEqual({
        kind: 'action-dropped',
        txHash: KEEPALIVE
      });
    });

    it('keeps the redeem offered with the extended deadline once confirmed', async () => {
      const confirmed = recordAction(sent(), { action: 'keepalive', txHash: KEEPALIVE, at: NOW });
      expect(confirmed).toMatchObject({ status: 'ready', nextAction: 'redeem', readyAt: NOW });
      expect(confirmed.routeData).toEqual({ ticketId });
      const { context } = chains({
        receipts: { [ticketId]: CREATED, [KEEPALIVE]: { status: 'success', logs: [] } },
        timeout: OLD + LIFETIME
      });
      const progress = await arbitrumDepositProgress(confirmed, context, NOW);
      // Its receipt is no redeem: the deadline is read from the chain.
      expect(progress).toEqual({
        kind: 'ready',
        nextAction: 'redeem',
        routeData: { ticketId, timeout: (OLD + LIFETIME).toString() }
      });
      expect(applyProgress(confirmed, progress!, NOW + 1)).toMatchObject({
        status: 'ready',
        routeData: { ticketId, timeout: (OLD + LIFETIME).toString() }
      });
    });
  });

  it('is the native adapter for Ethereum to Arbitrum', async () => {
    const { context } = chains();
    await expect(getBridgeAdapter('native').checkProgress(seed(), NOW, context)).resolves.toEqual({
      kind: 'waiting'
    });
  });

  it('decodes the NoTicketWithID revert Arbitrum returns', () => {
    expect(noTicket().walk(cause => cause instanceof ContractFunctionRevertedError)).toMatchObject({
      data: { errorName: 'NoTicketWithID' }
    });
  });
});
