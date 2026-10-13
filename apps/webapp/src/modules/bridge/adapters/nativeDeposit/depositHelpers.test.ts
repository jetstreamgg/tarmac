import { describe, expect, it } from 'vitest';
import {
  decodeAbiParameters,
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  zeroAddress,
  type Address,
  type Hex,
  type Log
} from 'viem';
import { skyL1TokenBridgeImplementationAbi, skyL1TokenGatewayImplementationAbi } from '@/hooks/generated';
import {
  arbitrumDepositCall,
  arbitrumOutboundCalldata,
  arbitrumRetryableTicket,
  retryableQuote
} from './arbitrum';
import { ARBITRUM_DEPOSIT, OP_STACK_DEPOSIT } from './contracts';
import {
  ARBITRUM_DEPOSIT_LOGS,
  ARBITRUM_DEPOSIT_TX,
  BASE_DEPOSIT_LOGS,
  BASE_DEPOSIT_TX
} from './depositFixtures';
import { OP_STACK_MIN_GAS_LIMIT, opStackDepositCall, opStackDepositMessage } from './opStack';

const SUSDS = '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD';

describe('OP Stack deposit (golden: Base mainnet deposit 0x36f35ee8…537f)', () => {
  it('builds the same bridgeERC20To calldata as the real deposit', () => {
    const real = decodeFunctionData({
      abi: skyL1TokenBridgeImplementationAbi,
      data: BASE_DEPOSIT_TX.input
    });
    const [, , recipient, amount, minGasLimit, extraData] = real.args as readonly [
      Address,
      Address,
      Address,
      bigint,
      number,
      Hex
    ];
    const call = opStackDepositCall({ network: 'base', recipient, amount });
    expect(call.address).toBe(OP_STACK_DEPOSIT.base.l1TokenBridge);
    expect(minGasLimit).toBe(OP_STACK_MIN_GAS_LIMIT);
    // The real deposit came from Superbridge, which tags extraData; the L2 bridge only echoes it in an event.
    expect(call.args[5]).toBe('0x');
    const [token, l2Token, to, value, gas] = call.args;
    expect(encodeFunctionData({ ...call, args: [token, l2Token, to, value, gas, extraData] })).toBe(
      BASE_DEPOSIT_TX.input
    );
  });

  it('reads the msgHash and L2 tx hash that Base relayed', () => {
    expect(opStackDepositMessage(BASE_DEPOSIT_LOGS, 'base')).toMatchObject({
      msgHash: '0x1bf132c3ab73d979a2bcff617342e2462d0cc34cff279206cb859b4912466fb7',
      l2TxHash: '0xaaea002ad43a667914e489cc586677f3b974b1c195c721a8510b12374aec0570'
    });
  });

  it('ignores the deposit on another network, whose portal and bridge differ', () => {
    expect(opStackDepositMessage(BASE_DEPOSIT_LOGS, 'optimism')).toBeUndefined();
    expect(opStackDepositMessage(BASE_DEPOSIT_LOGS, 'unichain')).toBeUndefined();
  });

  it('ignores a portal log from any other contract, and a receipt with two deposits', () => {
    const portalIndex = BASE_DEPOSIT_LOGS.findIndex(
      log => getAddress(log.address) === OP_STACK_DEPOSIT.base.portal
    );
    const forged = BASE_DEPOSIT_LOGS.map((log, i) =>
      i === portalIndex ? ({ ...log, address: '0x0000000000000000000000000000000000000bad' } as Log) : log
    );
    expect(opStackDepositMessage(forged, 'base')).toBeUndefined();
    expect(
      opStackDepositMessage([...BASE_DEPOSIT_LOGS, BASE_DEPOSIT_LOGS[portalIndex]], 'base')
    ).toBeUndefined();
    expect(opStackDepositMessage([], 'base')).toBeUndefined();
  });
});

describe('Arbitrum deposit (golden: mainnet gateway deposit 0x7bad421e…13d4)', () => {
  // The real deposit called outboundTransfer, which Sky's gateway runs as outboundTransferCustomRefund with refundTo = to.
  const real = decodeFunctionData({
    abi: skyL1TokenGatewayImplementationAbi,
    data: ARBITRUM_DEPOSIT_TX.input
  });
  const [l1Token, recipient, amount, maxGas, gasPriceBid, data] = real.args as readonly [
    Address,
    Address,
    bigint,
    bigint,
    bigint,
    Hex
  ];

  it('builds the same deposit fields, data encoding and value as the real deposit', () => {
    expect(real.functionName).toBe('outboundTransfer');
    expect(l1Token).toBe(SUSDS);
    const [maxSubmissionCost] = decodeAbiParameters([{ type: 'uint256' }, { type: 'bytes' }], data);
    expect(maxSubmissionCost + maxGas * gasPriceBid).toBe(ARBITRUM_DEPOSIT_TX.value);
    const call = arbitrumDepositCall({
      l1Token,
      recipient,
      refundTo: recipient,
      amount,
      quote: { maxSubmissionCost, maxGas, gasPriceBid, value: ARBITRUM_DEPOSIT_TX.value }
    });
    expect(call.address).toBe(ARBITRUM_DEPOSIT.l1Gateway);
    expect(call.value).toBe(ARBITRUM_DEPOSIT_TX.value);
    const [token, refundTo, to, value, gas, bid, extraData] = call.args;
    expect(refundTo).toBe(to);
    expect(
      encodeFunctionData({
        abi: call.abi,
        functionName: 'outboundTransfer',
        args: [token, to, value, gas, bid, extraData]
      })
    ).toBe(ARBITRUM_DEPOSIT_TX.input);
  });

  it('computes the ticket id ArbOS created', () => {
    expect(arbitrumRetryableTicket(ARBITRUM_DEPOSIT_LOGS)).toMatchObject({
      ticketId: '0xfb3d315976766e2cb2c21fcdc3d20dac98a4e9791889f282839a42f3cfb7903b',
      to: ARBITRUM_DEPOSIT.l2Gateway
    });
  });

  it('the ticket calls the L2 gateway with the outbound calldata the deposit encodes', () => {
    const ticket = arbitrumRetryableTicket(ARBITRUM_DEPOSIT_LOGS);
    expect(ticket?.data).toBe(
      arbitrumOutboundCalldata({ l1Token, from: ARBITRUM_DEPOSIT_TX.from, to: recipient, amount })
    );
  });

  it('ignores messages from another inbox or bridge, and a receipt with two tickets', () => {
    const move = (address: string, to: string) =>
      ARBITRUM_DEPOSIT_LOGS.map(log =>
        getAddress(log.address) === address ? ({ ...log, address: to } as Log) : log
      );
    expect(
      arbitrumRetryableTicket(move(ARBITRUM_DEPOSIT.inbox, '0x0000000000000000000000000000000000000bad'))
    ).toBeUndefined();
    expect(
      arbitrumRetryableTicket(move(ARBITRUM_DEPOSIT.bridge, '0x0000000000000000000000000000000000000bad'))
    ).toBeUndefined();
    expect(arbitrumRetryableTicket([...ARBITRUM_DEPOSIT_LOGS, ...ARBITRUM_DEPOSIT_LOGS])).toBeUndefined();
    expect(arbitrumRetryableTicket(BASE_DEPOSIT_LOGS)).toBeUndefined();
  });
});

describe('deposit builders', () => {
  it('build no deposit to, or refunding to, the zero address', () => {
    const quote = retryableQuote({ submissionFee: 1n, gasEstimate: 1n, l2GasPrice: 1n });
    const someone = ARBITRUM_DEPOSIT_TX.from;
    expect(() => opStackDepositCall({ network: 'base', recipient: zeroAddress, amount: 1n })).toThrow();
    expect(() =>
      arbitrumDepositCall({ recipient: zeroAddress, refundTo: someone, amount: 1n, quote })
    ).toThrow();
    expect(() =>
      arbitrumDepositCall({ recipient: someone, refundTo: zeroAddress, amount: 1n, quote })
    ).toThrow();
  });
});

describe('retryableQuote', () => {
  it('applies the 2.5x, 1.5x and 2x margins, rounding up, and sends the most the ticket can spend', () => {
    // The fork run: 324 bytes of calldata, 116,946 gas estimated, 0.01 gwei on Arbitrum.
    const quote = retryableQuote({
      submissionFee: 510_224_272_976n,
      gasEstimate: 116_946n,
      l2GasPrice: 10_000_000n
    });
    expect(quote).toEqual({
      maxSubmissionCost: 1_275_560_682_440n,
      maxGas: 175_419n,
      gasPriceBid: 20_000_000n,
      value: 1_275_560_682_440n + 175_419n * 20_000_000n
    });
    expect(retryableQuote({ submissionFee: 1n, gasEstimate: 1n, l2GasPrice: 1n })).toMatchObject({
      maxSubmissionCost: 3n,
      maxGas: 2n
    });
  });
});
