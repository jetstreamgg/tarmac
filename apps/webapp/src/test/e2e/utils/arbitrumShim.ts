import { type Page } from '@playwright/test';
import {
  concat,
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionResult,
  keccak256,
  multicall3Abi,
  toHex,
  zeroHash,
  type Address,
  type Hex
} from 'viem';
import { skyL1TokenGatewayImplementationAbi } from '@/hooks/generated';
import { arbitrumRetryableTicket } from '@/modules/bridge/adapters/nativeDeposit/arbitrum';
import { l1ToL2Alias } from '@/modules/bridge/adapters/nativeDeposit/arbitrumQuote';
import {
  ARBITRUM_DEPOSIT,
  ARB_RETRYABLE_TX,
  NODE_INTERFACE,
  arbRetryableTxAbi,
  nodeInterfaceAbi
} from '@/modules/bridge/adapters/nativeDeposit/contracts';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';
import { NetworkName } from './constants';

type RpcRequest = { id: number; method: string; params?: unknown[] };
type RpcAnswer = { result: unknown } | { error: { code: number; message: string; data?: Hex } };
type RpcLog = { address: Address; topics: Hex[]; data: Hex; [field: string]: unknown };
type RpcReceipt = { transactionHash: Hex; status: Hex; logs: RpcLog[]; [field: string]: unknown };
type RpcTransaction = { hash: Hex; [field: string]: unknown };

type Ticket = { ticketId: Hex; data: Hex; created: RpcReceipt; timeout?: bigint };

/** What the app asked of ArbOS, for golden checks. */
export type ArbitrumShimLog = {
  /** NodeInterface.estimateRetryableTicket args, and the gas answered. */
  estimates: { args: readonly unknown[]; gas: bigint }[];
  gasPrices: bigint[];
  /** Redeems and keepalives the wallet sent to ArbRetryableTx. */
  sent: { action: 'redeem' | 'keepalive'; from: Address; data: Hex; gas: bigint; hash: Hex }[];
};

const LIFETIME_S = 7n * 86_400n;
const KEEPALIVE_GAS = 100_000n;
const ALIASED_GATEWAY = l1ToL2Alias(ARBITRUM_DEPOSIT.l1Gateway);
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const NO_CODE = '0x000000000000000000000000000000000000dEaD';
const same = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();
const nowS = () => BigInt(Math.floor(Date.now() / 1000));

const rpcAt = (url: string) => async (method: string, params: unknown[]) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const body = await response.json();
  if (body.error) throw new RpcError(`${method}: ${body.error.message}`, body.error.data);
  return body.result;
};

class RpcError extends Error {
  constructor(
    message: string,
    readonly data: Hex = '0x'
  ) {
    super(message);
  }
}

const log = (receipt: RpcReceipt, index: number, topics: Hex[], data: Hex): RpcLog => ({
  address: ARB_RETRYABLE_TX,
  topics,
  data,
  blockHash: receipt.blockHash,
  blockNumber: receipt.blockNumber,
  transactionHash: receipt.transactionHash,
  transactionIndex: receipt.transactionIndex,
  logIndex: toHex(index),
  removed: false
});

const redeemScheduled = (receipt: RpcReceipt, ticketId: Hex, retryTxHash: Hex, sequenceNum: bigint) =>
  log(
    receipt,
    0,
    encodeEventTopics({
      abi: arbRetryableTxAbi,
      eventName: 'RedeemScheduled',
      args: { ticketId, retryTxHash, sequenceNum }
    }) as Hex[],
    encodeAbiParameters(
      [{ type: 'uint64' }, { type: 'address' }, { type: 'uint256' }, { type: 'uint256' }],
      [0n, ALIASED_GATEWAY, 0n, 0n]
    )
  );

/**
 * Plays ArbOS's retryable tickets on the Arbitrum fork, which runs ArbRetryableTx's
 * views but never creates, schedules or redeems a ticket, and whose NodeInterface
 * doesn't run. Answers the page's Arbitrum calls about the tickets `relay`
 * registered; everything else reaches the fork. Every mint is real: the L2
 * gateway's finalizeInboundTransfer from the aliased L1 gateway, so it succeeds
 * or runs out of gas like a retry would.
 */
export async function installArbitrumShim(page: Page) {
  const url = await getRpcUrlFromFile(NetworkName.arbitrum);
  const l1Rpc = rpcAt(await getRpcUrlFromFile(NetworkName.mainnet));
  const l2Rpc = rpcAt(url);
  const tickets = new Map<string, Ticket>();
  const receipts = new Map<string, RpcReceipt>();
  const transactions = new Map<string, RpcTransaction>();
  const seen: ArbitrumShimLog = { estimates: [], gasPrices: [], sent: [] };
  let sequence = 0n;

  const mintEstimate = async (data: Hex) =>
    BigInt(await l2Rpc('eth_estimateGas', [{ from: ALIASED_GATEWAY, to: ARBITRUM_DEPOSIT.l2Gateway, data }]));

  const intrinsicGas = async (data: Hex) =>
    BigInt(await l2Rpc('eth_estimateGas', [{ from: ALIASED_GATEWAY, to: NO_CODE, data }]));

  /** A real tx from the aliased gateway, the carrier of a synthesized receipt. */
  const sendFromAlias = async (to: Address, data: Hex, gas: bigint) => {
    await l2Rpc('tenderly_setBalance', [[ALIASED_GATEWAY], toHex(10n ** 18n)]);
    const hash: Hex = await l2Rpc('eth_sendTransaction', [
      { from: ALIASED_GATEWAY, to, data, gas: toHex(gas) }
    ]);
    const [receipt, transaction] = await Promise.all([
      l2Rpc('eth_getTransactionReceipt', [hash]) as Promise<RpcReceipt>,
      l2Rpc('eth_getTransactionByHash', [hash]) as Promise<RpcTransaction>
    ]);
    return { hash, receipt, transaction };
  };

  /** Stores a receipt and tx under `hash` that the wallet's call to ArbRetryableTx left. */
  const synthesize = (
    hash: Hex,
    carrier: { receipt: RpcReceipt; transaction: RpcTransaction },
    from: Address,
    data: Hex,
    logs: (receipt: RpcReceipt) => RpcLog[]
  ) => {
    const receipt: RpcReceipt = {
      ...carrier.receipt,
      transactionHash: hash,
      from,
      to: ARB_RETRYABLE_TX,
      status: '0x1',
      logs: []
    };
    receipt.logs = logs(receipt);
    receipts.set(hash.toLowerCase(), receipt);
    transactions.set(hash.toLowerCase(), {
      ...carrier.transaction,
      hash,
      from,
      to: ARB_RETRYABLE_TX,
      input: data
    });
  };

  const liveTicket = (ticketId: unknown) => {
    const ticket = typeof ticketId === 'string' ? tickets.get(ticketId.toLowerCase()) : undefined;
    return ticket?.timeout !== undefined ? ticket : undefined;
  };

  const decodeTicketCall = (data: Hex) => {
    try {
      const call = decodeFunctionData({ abi: arbRetryableTxAbi, data });
      return { functionName: call.functionName, ticket: liveTicket(call.args?.[0]) };
    } catch {
      return undefined;
    }
  };

  /** What ArbRetryableTx answers for a call on a live ticket; undefined leaves it to the fork. */
  const ticketCallResult = (to: unknown, data: Hex): Hex | undefined => {
    if (!same(to, ARB_RETRYABLE_TX)) return undefined;
    const call = decodeTicketCall(data);
    if (!call?.ticket) return undefined;
    const { timeout } = call.ticket;
    if (call.functionName === 'getTimeout' || call.functionName === 'keepalive')
      return encodeFunctionResult({
        abi: arbRetryableTxAbi,
        functionName: call.functionName,
        result: call.functionName === 'keepalive' ? timeout! + LIFETIME_S : timeout!
      });
    if (call.functionName === 'redeem')
      return encodeFunctionResult({ abi: arbRetryableTxAbi, functionName: 'redeem', result: zeroHash });
    return undefined;
  };

  /** The page batches its reads through Multicall3: answers the ticket calls, the fork the rest. */
  const aggregate3 = async (to: unknown, data: Hex, block: unknown): Promise<Hex | undefined> => {
    if (!same(to, MULTICALL3)) return undefined;
    let calls: readonly { target: Address; callData: Hex }[];
    try {
      const call = decodeFunctionData({ abi: multicall3Abi, data });
      if (call.functionName !== 'aggregate3') return undefined;
      calls = call.args[0];
    } catch {
      return undefined;
    }
    if (!calls.some(({ target, callData }) => ticketCallResult(target, callData))) return undefined;
    const results = await Promise.all(
      calls.map(async ({ target, callData }) => {
        const answered = ticketCallResult(target, callData);
        if (answered) return { success: true, returnData: answered };
        try {
          return {
            success: true,
            returnData: (await l2Rpc('eth_call', [{ to: target, data: callData }, block])) as Hex
          };
        } catch (error) {
          return { success: false, returnData: error instanceof RpcError ? error.data : '0x' };
        }
      })
    );
    return encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: results });
  };

  async function answer({ method, params = [] }: RpcRequest): Promise<RpcAnswer | undefined> {
    const tx = params[0] as { from?: Address; to?: string; data?: Hex; input?: Hex; gas?: Hex } | undefined;
    const data = tx?.data ?? tx?.input;
    switch (method) {
      case 'eth_gasPrice': {
        const price = BigInt(await l2Rpc(method, []));
        seen.gasPrices.push(price);
        return { result: toHex(price) };
      }
      case 'eth_estimateGas': {
        if (!data) return undefined;
        if (same(tx?.to, NODE_INTERFACE)) {
          const { args } = decodeFunctionData({ abi: nodeInterfaceAbi, data });
          const gas = await mintEstimate(args[6]);
          seen.estimates.push({ args, gas });
          return { result: toHex(gas) };
        }
        if (!same(tx?.to, ARB_RETRYABLE_TX)) return undefined;
        const call = decodeTicketCall(data);
        if (!call?.ticket) return undefined;
        if (call.functionName === 'redeem') return { result: toHex(await mintEstimate(call.ticket.data)) };
        if (call.functionName === 'keepalive') return { result: toHex(KEEPALIVE_GAS) };
        return undefined;
      }
      case 'eth_call': {
        if (!data) return undefined;
        const result = ticketCallResult(tx?.to, data) ?? (await aggregate3(tx?.to, data, params[1]));
        return result && { result };
      }
      case 'eth_getTransactionReceipt': {
        const receipt = receipts.get(String(params[0]).toLowerCase());
        return receipt && { result: receipt };
      }
      case 'eth_getTransactionByHash': {
        const transaction = transactions.get(String(params[0]).toLowerCase());
        return transaction && { result: transaction };
      }
      case 'eth_sendTransaction': {
        if (!data || !tx?.from || !same(tx.to, ARB_RETRYABLE_TX)) return undefined;
        const call = decodeTicketCall(data);
        const ticket = call?.ticket;
        if (!ticket || (call.functionName !== 'redeem' && call.functionName !== 'keepalive'))
          return undefined;
        const gas = BigInt(tx.gas ?? toHex(0));
        const hash = keccak256(concat([ticket.ticketId, toHex(++sequence, { size: 32 })]));
        seen.sent.push({ action: call.functionName, from: tx.from, data, gas, hash });
        if (call.functionName === 'redeem') {
          // The redeem's gas, less its own cost, funds the retry: the whole tx gas is a close enough cap.
          const retry = await sendFromAlias(ARBITRUM_DEPOSIT.l2Gateway, ticket.data, gas);
          if (retry.receipt.status === '0x1') ticket.timeout = undefined;
          synthesize(hash, retry, tx.from, data, receipt => [
            redeemScheduled(receipt, ticket.ticketId, retry.hash, sequence)
          ]);
        } else {
          ticket.timeout = ticket.timeout! + LIFETIME_S;
          const newTimeout = ticket.timeout;
          const carrier = await sendFromAlias(NO_CODE, '0x', await intrinsicGas('0x'));
          synthesize(hash, carrier, tx.from, data, receipt => [
            log(
              receipt,
              0,
              encodeEventTopics({
                abi: arbRetryableTxAbi,
                eventName: 'LifetimeExtended',
                args: { ticketId: ticket.ticketId }
              }) as Hex[],
              encodeAbiParameters([{ type: 'uint256' }], [newTimeout])
            )
          ]);
        }
        return { result: hash };
      }
    }
    return undefined;
  }

  await page.route(
    target => target.href === url,
    async route => {
      let request: RpcRequest;
      try {
        request = JSON.parse(route.request().postData() ?? '');
      } catch {
        return route.fallback();
      }
      if (Array.isArray(request)) return route.fallback();
      const answered = await answer(request);
      if (!answered) return route.fallback();
      return route.fulfill({ json: { jsonrpc: '2.0', id: request.id, ...answered } });
    }
  );

  /**
   * ArbOS's part once it reads an Ethereum deposit: creates the ticket and runs
   * its auto-redeem, the real mint at the deposit's maxGas, or just above the
   * intrinsic gas with `failAutoRedeem`. Returns the deposit call as sent, the
   * ticket, and whether the mint ran.
   */
  async function relay(l1TxHash: Hex, { failAutoRedeem = false } = {}) {
    const [l1Receipt, l1Tx] = await Promise.all([
      l1Rpc('eth_getTransactionReceipt', [l1TxHash]),
      l1Rpc('eth_getTransactionByHash', [l1TxHash])
    ]);
    const ticket = arbitrumRetryableTicket(l1Receipt.logs);
    if (!ticket) throw new Error(`No Sky retryable ticket in ${l1TxHash}`);
    const deposit = decodeFunctionData({ abi: skyL1TokenGatewayImplementationAbi, data: l1Tx.input });
    if (deposit.functionName !== 'outboundTransferCustomRefund')
      throw new Error(`Unexpected deposit call ${deposit.functionName}`);
    const maxGas = deposit.args[4] as bigint;
    // Arbitrum's intrinsic gas carries the L1 data cost, so the failing gas is measured, not fixed.
    const gas = failAutoRedeem ? (await intrinsicGas(ticket.data)) + 10_000n : maxGas;
    const retry = await sendFromAlias(ticket.to, ticket.data, gas);
    const created: RpcReceipt = {
      ...retry.receipt,
      transactionHash: ticket.ticketId,
      from: ALIASED_GATEWAY,
      to: ARB_RETRYABLE_TX,
      status: '0x1',
      logs: []
    };
    created.logs = [
      redeemScheduled(created, ticket.ticketId, retry.hash, 0n),
      {
        ...log(
          created,
          1,
          encodeEventTopics({
            abi: arbRetryableTxAbi,
            eventName: 'TicketCreated',
            args: { ticketId: ticket.ticketId }
          }) as Hex[],
          '0x'
        )
      }
    ];
    const minted = retry.receipt.status === '0x1';
    tickets.set(ticket.ticketId.toLowerCase(), {
      ticketId: ticket.ticketId,
      data: ticket.data,
      created,
      timeout: minted ? undefined : nowS() + LIFETIME_S
    });
    receipts.set(ticket.ticketId.toLowerCase(), created);
    return {
      ticket,
      minted,
      deposit: { to: l1Tx.to as Address, args: deposit.args, value: BigInt(l1Tx.value) },
      blockNumber: BigInt(l1Receipt.blockNumber)
    };
  }

  /** Moves a live ticket's deadline to `seconds` from now, or ends it (expired) with undefined. */
  function setTicketTimeout(ticketId: Hex, seconds: bigint | undefined) {
    const ticket = tickets.get(ticketId.toLowerCase());
    if (!ticket) throw new Error(`Unknown ticket ${ticketId}`);
    ticket.timeout = seconds === undefined ? undefined : nowS() + seconds;
  }

  return { seen, relay, setTicketTimeout, mintEstimate };
}
