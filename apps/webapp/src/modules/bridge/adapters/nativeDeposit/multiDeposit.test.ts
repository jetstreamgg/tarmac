import { describe, expect, it, vi } from 'vitest';
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  decodeFunctionData,
  pad,
  parseEther,
  toEventSelector,
  toHex,
  type Address,
  type Hex,
  type Log
} from 'viem';
import { skyL1TokenBridgeImplementationAbi, skyL1TokenGatewayImplementationAbi } from '@/hooks/generated';
import { createPendingBridge } from '../../model/pendingTransitions';
import { resolveBridgeRoute } from '../../model/resolveRoute';
import type { PendingBridge } from '../../model/types';
import type { AdapterContext, ChainReader } from '../types';
import { ARBITRUM_DEPOSIT_LOGS, ARBITRUM_TICKET, BASE_DEPOSIT_LOGS } from './depositFixtures';
import { ARB_RETRYABLE_TX, L1_USDS, arbRetryableTxAbi, l2CrossDomainMessengerAbi } from './contracts';
import { opStackDepositMessage } from './opStack';
import { opStackDepositProgress } from './opStackProgress';
import { arbitrumRetryableTicket } from './arbitrum';
import { arbitrumDepositProgress } from './arbitrumProgress';
import { progressOfAll } from './sameDeposit';

// One Ethereum transaction (a Safe's batch execution) carrying several Sky deposits to the same L2.

const NOW = 1_800_000_000_000;
const SOURCE = `0x${'5'.repeat(64)}`;
const OTHER = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const A100 = parseEther('100');
const A200 = parseEther('200');
const A300 = parseEther('300');
const word = (value: bigint) => pad(toHex(value)).slice(2);

const swap = (hex: string, from: string, to: string) => {
  const parts = hex.split(from);
  if (parts.length !== 2) throw new Error(`expected exactly one ${from}`);
  return parts.join(to);
};

// ---------- OP Stack (Base) ----------

const BASE_PORTAL_LOG = BASE_DEPOSIT_LOGS[1] as Log & { data: Hex; logIndex: number };
const BASE_AMOUNT = '00000000000000000000000000000000000000000000043ba8fa7070da980000';
const BASE_NONCE = '000100000000000000000000000000000000000000000000000000000008d546';

const basePortalLog = (amount: bigint, nonce: bigint, logIndex: number): Log =>
  ({
    ...BASE_PORTAL_LOG,
    data: swap(
      swap(BASE_PORTAL_LOG.data, BASE_AMOUNT, word(amount)),
      BASE_NONCE,
      `0001${word(nonce).slice(4)}`
    ),
    logIndex
  }) as unknown as Log;

const BASE_100 = basePortalLog(A100, 0x8d546n, 10);
const BASE_200 = basePortalLog(A200, 0x8d547n, 20);
const BASE_100_TWIN = basePortalLog(A100, 0x8d548n, 30);
const tokenWord = (token: Address) => pad(token).slice(2).toLowerCase();
const BASE_100_OTHER_TOKEN = {
  ...BASE_100,
  data: swap(
    basePortalLog(A100, 0x8d549n, 40).data,
    tokenWord(L1_USDS),
    tokenWord('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')
  ),
  logIndex: 40
} as unknown as Log;

const m100 = opStackDepositMessage([BASE_100], 'base')!;
const m200 = opStackDepositMessage([BASE_200], 'base')!;
const m100Twin = opStackDepositMessage([BASE_100_TWIN], 'base')!;

const baseRecipient = (() => {
  const relay = decodeFunctionData({ abi: l2CrossDomainMessengerAbi, data: m100.relayCalldata });
  const mint = decodeFunctionData({
    abi: skyL1TokenBridgeImplementationAbi,
    data: (relay.args as unknown as Hex[])[5]
  });
  return (mint.args as unknown as Address[])[3];
})();

const opSeed = (amount: bigint, account: string = baseRecipient): PendingBridge & { to: 'base' } => {
  const result = resolveBridgeRoute({ from: 'ethereum', to: 'base', amount, facts: {} });
  if (result.status !== 'ok') throw new Error(result.reason);
  const bridge = createPendingBridge({
    account,
    amount,
    from: 'ethereum',
    to: 'base',
    route: result.route,
    txHash: SOURCE,
    now: NOW
  });
  return { ...bridge, to: 'base' };
};

const opChains = (l1Logs: Log[], relayed: Hex[], failed: Hex[] = []) => {
  const l1 = { getTransactionReceipt: vi.fn(async () => ({ status: 'success', logs: l1Logs })) };
  const l2 = {
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
      throw new TransactionReceiptNotFoundError({ hash });
    }),
    getTransaction: vi.fn(async ({ hash }: { hash: Hex }) => {
      throw new TransactionNotFoundError({ hash });
    }),
    readContract: vi.fn(async ({ functionName, args }: { functionName: string; args: [Hex] }) =>
      (functionName === 'successfulMessages' ? relayed : failed).includes(args[0])
    )
  };
  const context: AdapterContext = {
    getClient: network =>
      (network === 'ethereum' ? l1 : network === 'base' ? l2 : undefined) as unknown as ChainReader
  };
  return context;
};

describe('OP Stack: several Sky deposits in one Ethereum transaction', () => {
  it('the crafted logs are distinct deposits of the amounts under test', () => {
    expect(new Set([m100.msgHash, m200.msgHash, m100Twin.msgHash]).size).toBe(3);
    expect(m100.relayCalldata.includes(word(A100))).toBe(true);
    expect(m200.relayCalldata.includes(word(A200))).toBe(true);
  });

  it('a lone deposit still arrives once relayed', async () => {
    const context = opChains([BASE_100], [m100.msgHash]);
    await expect(opStackDepositProgress(opSeed(A100), context, NOW)).resolves.toEqual({ kind: 'arrived' });
  });

  it('each card follows the message of its own amount', async () => {
    const context = opChains([BASE_100, BASE_200], [m100.msgHash]);
    await expect(opStackDepositProgress(opSeed(A100), context, NOW)).resolves.toEqual({ kind: 'arrived' });
    await expect(opStackDepositProgress(opSeed(A200), context, NOW)).resolves.toEqual({ kind: 'waiting' });
  });

  it('offers the replay of its own failed message, not the other', async () => {
    const context = opChains([BASE_100, BASE_200], [m200.msgHash], [m100.msgHash]);
    await expect(opStackDepositProgress(opSeed(A100), context, NOW)).resolves.toEqual({
      kind: 'ready',
      nextAction: 'replay',
      routeData: m100
    });
    await expect(opStackDepositProgress(opSeed(A200), context, NOW)).resolves.toEqual({ kind: 'arrived' });
  });

  it('never follows a message of another amount or recipient', async () => {
    const context = opChains([BASE_100, BASE_200], [m100.msgHash, m200.msgHash]);
    await expect(opStackDepositProgress(opSeed(A300), context, NOW)).resolves.toBeNull();
    await expect(opStackDepositProgress(opSeed(A100, OTHER), context, NOW)).resolves.toBeNull();
  });

  it('never follows a message of another token', async () => {
    const logs = [BASE_100, BASE_100_OTHER_TOKEN];
    const other = opStackDepositMessage([BASE_100_OTHER_TOKEN], 'base')!;
    expect(other.msgHash).not.toBe(m100.msgHash);
    await expect(opStackDepositProgress(opSeed(A100), opChains(logs, [other.msgHash]), NOW)).resolves.toEqual(
      { kind: 'waiting' }
    );
    await expect(
      opStackDepositProgress(opSeed(A100), opChains(logs, [m100.msgHash], [other.msgHash]), NOW)
    ).resolves.toEqual({ kind: 'arrived' });
  });

  describe('two deposits of the same amount to the same recipient', () => {
    const logs = [BASE_100, BASE_100_TWIN];

    it('arrive only once both were relayed', async () => {
      await expect(
        opStackDepositProgress(opSeed(A100), opChains(logs, [m100.msgHash, m100Twin.msgHash]), NOW)
      ).resolves.toEqual({ kind: 'arrived' });
      await expect(
        opStackDepositProgress(opSeed(A100), opChains(logs, [m100.msgHash]), NOW)
      ).resolves.toEqual({ kind: 'waiting' });
    });

    it('offer the replay of the one that failed', async () => {
      await expect(
        opStackDepositProgress(opSeed(A100), opChains(logs, [m100.msgHash], [m100Twin.msgHash]), NOW)
      ).resolves.toEqual({ kind: 'ready', nextAction: 'replay', routeData: m100Twin });
    });
  });
});

// ---------- Arbitrum ----------

const ARB_BRIDGE_LOG = ARBITRUM_DEPOSIT_LOGS[1] as Log & { topics: Hex[] };
const ARB_INBOX_LOG = ARBITRUM_DEPOSIT_LOGS[2] as Log & { topics: Hex[]; data: Hex };
const ARB_AMOUNT = '0000000000000000000000000000000000000000000000000de0b6b3a7640000';

// The fixture deposits sUSDS through the same gateway.
const L1_SUSDS = (
  decodeFunctionData({
    abi: skyL1TokenGatewayImplementationAbi,
    data: arbitrumRetryableTicket(ARBITRUM_DEPOSIT_LOGS as unknown as Log[])!.data
  }).args as unknown as Address[]
)[0];

const arbPair = (amount: bigint, messageNum: bigint, token: Address = L1_USDS): Log[] => {
  const num = pad(toHex(messageNum));
  const data = swap(ARB_INBOX_LOG.data, ARB_AMOUNT, word(amount));
  return [
    { ...ARB_BRIDGE_LOG, topics: [ARB_BRIDGE_LOG.topics[0], num, ARB_BRIDGE_LOG.topics[2]] },
    {
      ...ARB_INBOX_LOG,
      topics: [ARB_INBOX_LOG.topics[0], num],
      data: token === L1_SUSDS ? data : swap(data, tokenWord(L1_SUSDS), tokenWord(token))
    }
  ] as unknown as Log[];
};

const ARB_100 = arbPair(A100, 0x1cb55en);
const ARB_200 = arbPair(A200, 0x1cb55fn);
const ARB_100_TWIN = arbPair(A100, 0x1cb560n);
const ARB_100_SUSDS = arbPair(A100, 0x1cb561n, L1_SUSDS);
const t100 = arbitrumRetryableTicket(ARB_100)!;
const t200 = arbitrumRetryableTicket(ARB_200)!;
const t100Twin = arbitrumRetryableTicket(ARB_100_TWIN)!;
const t100Susds = arbitrumRetryableTicket(ARB_100_SUSDS)!;
const RETRY: Record<string, Hex> = {
  [t100.ticketId]: `0x${'8'.repeat(64)}`,
  [t200.ticketId]: `0x${'9'.repeat(64)}`,
  [t100Twin.ticketId]: `0x${'a'.repeat(64)}`,
  [t100Susds.ticketId]: `0x${'b'.repeat(64)}`
};
const CREATION_BLOCK = ARBITRUM_TICKET.creationBlock;
const TIMEOUT = 1_740_000_000n + 7n * 86_400n;

const arbRecipient = (
  decodeFunctionData({ abi: skyL1TokenGatewayImplementationAbi, data: t100.data })
    .args as unknown as Address[]
)[2];

const arbSeed = (amount: bigint, account: string = arbRecipient): PendingBridge => {
  const result = resolveBridgeRoute({ from: 'ethereum', to: 'arbitrum', amount, facts: {} });
  if (result.status !== 'ok') throw new Error(result.reason);
  return createPendingBridge({
    account,
    amount,
    from: 'ethereum',
    to: 'arbitrum',
    route: result.route,
    txHash: SOURCE,
    now: NOW
  });
};

const redeemScheduled = (ticket: Hex, retry: Hex): Log =>
  ({
    address: ARB_RETRYABLE_TX,
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

const noTicket = (ticketId: Hex) =>
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

/** Each ticket's auto-redeem: delivered, or failed with the ticket still alive. */
const arbChains = (l1Logs: Log[], tickets: Record<string, 'redeemed' | 'alive'>) => {
  const receipts: Record<string, { status: 'success' | 'reverted'; logs: Log[]; blockNumber?: bigint }> = {};
  for (const [ticketId, state] of Object.entries(tickets)) {
    receipts[ticketId] = {
      status: 'success',
      logs: [
        ...(ARBITRUM_TICKET.creationLogs as unknown as Log[]),
        redeemScheduled(ticketId as Hex, RETRY[ticketId])
      ],
      blockNumber: CREATION_BLOCK
    };
    receipts[RETRY[ticketId]] = { status: state === 'redeemed' ? 'success' : 'reverted', logs: [] };
  }
  const l1 = { getTransactionReceipt: vi.fn(async () => ({ status: 'success', logs: l1Logs })) };
  const l2 = {
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
      const receipt = receipts[hash];
      if (!receipt) throw new TransactionReceiptNotFoundError({ hash });
      return receipt;
    }),
    getTransaction: vi.fn(async ({ hash }: { hash: Hex }) => {
      throw new TransactionNotFoundError({ hash });
    }),
    readContract: vi.fn(async ({ functionName, args }: { functionName: string; args?: [Hex] }) => {
      if (functionName === 'getLifetime') return 7n * 86_400n;
      if (tickets[args![0]] !== 'alive') throw noTicket(args![0]);
      return TIMEOUT;
    }),
    getBlockNumber: vi.fn(async () => CREATION_BLOCK + 100n),
    getBlock: vi.fn(async () => ({ timestamp: 1_740_000_000n })),
    getLogs: vi.fn(async () => [])
  };
  const context: AdapterContext = {
    getClient: network =>
      (network === 'ethereum' ? l1 : network === 'arbitrum' ? l2 : undefined) as unknown as ChainReader
  };
  return context;
};

describe('Arbitrum: several Sky retryable tickets in one Ethereum transaction', () => {
  const redeem = (ticketId: Hex) => ({
    kind: 'ready',
    nextAction: 'redeem',
    routeData: { ticketId, timeout: TIMEOUT.toString() }
  });

  it('the crafted logs are distinct tickets of the amounts under test', () => {
    expect(new Set([t100.ticketId, t200.ticketId, t100Twin.ticketId]).size).toBe(3);
    expect(t100.data.includes(word(A100))).toBe(true);
    expect(t200.data.includes(word(A200))).toBe(true);
  });

  it('a lone ticket still arrives once redeemed', async () => {
    const context = arbChains(ARB_100, { [t100.ticketId]: 'redeemed' });
    await expect(arbitrumDepositProgress(arbSeed(A100), context, NOW)).resolves.toEqual({ kind: 'arrived' });
  });

  it('each card follows the ticket of its own amount', async () => {
    const context = arbChains([...ARB_100, ...ARB_200], { [t100.ticketId]: 'redeemed' });
    await expect(arbitrumDepositProgress(arbSeed(A100), context, NOW)).resolves.toEqual({ kind: 'arrived' });
    await expect(arbitrumDepositProgress(arbSeed(A200), context, NOW)).resolves.toEqual({ kind: 'waiting' });
  });

  it('offers the redeem of its own failed ticket, with its deadline, not the other', async () => {
    const context = arbChains([...ARB_100, ...ARB_200], {
      [t100.ticketId]: 'alive',
      [t200.ticketId]: 'redeemed'
    });
    await expect(arbitrumDepositProgress(arbSeed(A100), context, NOW)).resolves.toEqual(
      redeem(t100.ticketId)
    );
    await expect(arbitrumDepositProgress(arbSeed(A200), context, NOW)).resolves.toEqual({ kind: 'arrived' });
  });

  it('never follows a ticket of another amount or recipient', async () => {
    const context = arbChains([...ARB_100, ...ARB_200], {
      [t100.ticketId]: 'redeemed',
      [t200.ticketId]: 'redeemed'
    });
    await expect(arbitrumDepositProgress(arbSeed(A300), context, NOW)).resolves.toBeNull();
    await expect(arbitrumDepositProgress(arbSeed(A100, OTHER), context, NOW)).resolves.toBeNull();
  });

  it('never follows a ticket of another token', async () => {
    const logs = [...ARB_100, ...ARB_100_SUSDS];
    await expect(
      arbitrumDepositProgress(arbSeed(A100), arbChains(logs, { [t100Susds.ticketId]: 'redeemed' }), NOW)
    ).resolves.toEqual({ kind: 'waiting' });
    await expect(
      arbitrumDepositProgress(
        arbSeed(A100),
        arbChains(logs, { [t100.ticketId]: 'redeemed', [t100Susds.ticketId]: 'alive' }),
        NOW
      )
    ).resolves.toEqual({ kind: 'arrived' });
  });

  describe('two tickets of the same amount to the same recipient', () => {
    const logs = [...ARB_100, ...ARB_100_TWIN];

    it('arrive only once both were redeemed', async () => {
      await expect(
        arbitrumDepositProgress(
          arbSeed(A100),
          arbChains(logs, { [t100.ticketId]: 'redeemed', [t100Twin.ticketId]: 'redeemed' }),
          NOW
        )
      ).resolves.toEqual({ kind: 'arrived' });
      await expect(
        arbitrumDepositProgress(arbSeed(A100), arbChains(logs, { [t100.ticketId]: 'redeemed' }), NOW)
      ).resolves.toEqual({ kind: 'waiting' });
    });

    it('offer the redeem of the one whose auto-redeem failed', async () => {
      await expect(
        arbitrumDepositProgress(
          arbSeed(A100),
          arbChains(logs, { [t100.ticketId]: 'redeemed', [t100Twin.ticketId]: 'alive' }),
          NOW
        )
      ).resolves.toEqual(redeem(t100Twin.ticketId));
    });
  });
});

describe('deposits a card cannot tell apart', () => {
  const ready = { kind: 'ready', nextAction: 'redeem', routeData: { ticketId: '0x01' } } as const;

  it('is never settled by part of them', () => {
    expect(progressOfAll([{ kind: 'arrived' }, null])).toBeNull();
    expect(progressOfAll([{ kind: 'arrived' }, { kind: 'expired' }])).toBeNull();
    expect(progressOfAll([{ kind: 'arrived' }, { kind: 'waiting' }])).toEqual({ kind: 'waiting' });
    expect(progressOfAll([])).toBeNull();
  });

  it('offers the action one of them needs, and settles once all agree', () => {
    expect(progressOfAll([{ kind: 'waiting' }, ready])).toEqual(ready);
    expect(progressOfAll([{ kind: 'expired' }, ready])).toEqual(ready);
    expect(progressOfAll([{ kind: 'expired' }, { kind: 'expired' }])).toEqual({ kind: 'expired' });
    expect(progressOfAll([{ kind: 'arrived' }, { kind: 'arrived' }])).toEqual({ kind: 'arrived' });
  });
});
