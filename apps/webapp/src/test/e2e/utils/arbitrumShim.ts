import { type Page } from '@playwright/test';
import {
  concat,
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  encodeFunctionResult,
  keccak256,
  parseAbi,
  toFunctionSelector,
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
import { aggregate3Answer, rpcAt, same } from './rpcShim';
import { ANYONE, NetworkName } from './constants';

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
const NO_CODE = '0x000000000000000000000000000000000000dEaD';
const nowS = () => BigInt(Math.floor(Date.now() / 1000));

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

const safeExecAbi = parseAbi([
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool success)'
]);

/** The call the gateway got: the tx itself, or the one a Safe's execTransaction made. */
function gatewayCall(tx: { to: string; input: Hex; value: string }) {
  if (!tx.input.startsWith(toFunctionSelector(safeExecAbi[0]))) {
    return { to: tx.to as Address, data: tx.input, value: BigInt(tx.value) };
  }
  const [to, value, data] = decodeFunctionData({ abi: safeExecAbi, data: tx.input }).args;
  return { to, data, value };
}

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
  // RedeemScheduled logs of redeems sent outside the page, which the fork's log reads lack.
  const scheduledElsewhere: RpcLog[] = [];
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
        const result =
          ticketCallResult(tx?.to, data) ??
          (await aggregate3Answer(l2Rpc, { to: tx?.to, data, block: params[1] }, ticketCallResult));
        return result && { result };
      }
      case 'eth_getLogs': {
        const filter = params[0] as {
          address?: string;
          topics?: (Hex | null)[];
          fromBlock?: Hex;
          toBlock?: Hex;
        };
        if (!scheduledElsewhere.length || !same(filter?.address, ARB_RETRYABLE_TX)) return undefined;
        const [topic, ticketId] = filter.topics ?? [];
        const extra = scheduledElsewhere.filter(
          entry =>
            same(topic, entry.topics[0]) &&
            (!ticketId || same(ticketId, entry.topics[1])) &&
            (!filter.fromBlock || BigInt(entry.blockNumber as Hex) >= BigInt(filter.fromBlock)) &&
            (!filter.toBlock || BigInt(entry.blockNumber as Hex) <= BigInt(filter.toBlock))
        );
        if (!extra.length) return undefined;
        return { result: [...((await l2Rpc(method, params)) as RpcLog[]), ...extra] };
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
    const call = gatewayCall(l1Tx);
    const deposit = decodeFunctionData({ abi: skyL1TokenGatewayImplementationAbi, data: call.data });
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
      deposit: { to: call.to, args: deposit.args, value: call.value },
      blockNumber: BigInt(l1Receipt.blockNumber)
    };
  }

  /** Moves a live ticket's deadline to `seconds` from now, or ends it (expired) with undefined. */
  function setTicketTimeout(ticketId: Hex, seconds: bigint | undefined) {
    const ticket = tickets.get(ticketId.toLowerCase());
    if (!ticket) throw new Error(`Unknown ticket ${ticketId}`);
    ticket.timeout = seconds === undefined ? undefined : nowS() + seconds;
  }

  /**
   * A redeem of a live ticket that another wallet sends (as the retryables tool does), outside
   * the page: the real mint as its retry, and its RedeemScheduled log in the page's log reads.
   * Returns whether the mint ran.
   */
  async function redeemElsewhere(ticketId: Hex) {
    const ticket = liveTicket(ticketId);
    if (!ticket) throw new Error(`No live ticket ${ticketId}`);
    const data = encodeFunctionData({
      abi: arbRetryableTxAbi,
      functionName: 'redeem',
      args: [ticket.ticketId]
    });
    const retry = await sendFromAlias(
      ARBITRUM_DEPOSIT.l2Gateway,
      ticket.data,
      await mintEstimate(ticket.data)
    );
    const hash = keccak256(concat([ticket.ticketId, toHex(++sequence, { size: 32 })]));
    synthesize(hash, retry, ANYONE, data, receipt => [
      redeemScheduled(receipt, ticket.ticketId, retry.hash, sequence)
    ]);
    scheduledElsewhere.push(...receipts.get(hash.toLowerCase())!.logs);
    const minted = retry.receipt.status === '0x1';
    if (minted) ticket.timeout = undefined;
    return minted;
  }

  return { seen, relay, setTicketTimeout, mintEstimate, redeemElsewhere };
}
