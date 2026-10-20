import { describe, expect, it } from 'vitest';
import {
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  zeroHash,
  type Call,
  type Hex
} from 'viem';
import { psm3L2Abi, usdsPsmWrapperAbi } from '@/hooks/generated';
import {
  CCTP_CONTRACTS,
  L1_USDC,
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_V2,
  USDS_PSM_WRAPPER,
  cctpL2Contracts,
  messageTransmitterV2Abi,
  tokenMessengerV2Abi
} from './contracts';
import { cctpBurnAmount, cctpBurnCalls, cctpClaimCalls, cctpConvertCalls } from './calls';
import {
  BASE_BURN_AMOUNT,
  BASE_BURN_ATTESTED,
  BASE_BURN_MINT_RECIPIENT,
  BASE_BURN_TX,
  ETHEREUM_RECEIVE_INPUT
} from './cctpFixtures';

const ACCOUNT = getAddress(BASE_BURN_TX.from);
const UNIT = 10n ** 12n;

type ContractCall = Call & { to: Hex; abi: never; functionName: string; args: readonly unknown[] };
const encode = (call: Call) => {
  const { abi, functionName, args } = call as ContractCall;
  return encodeFunctionData({ abi, functionName, args } as Parameters<typeof encodeFunctionData>[0]);
};

const burnCalls = (overrides: Partial<Parameters<typeof cctpBurnCalls>[0]> = {}) =>
  cctpBurnCalls({
    network: 'base',
    amount: BASE_BURN_AMOUNT * UNIT,
    account: ACCOUNT,
    mintRecipient: getAddress(BASE_BURN_MINT_RECIPIENT),
    usdsAllowance: 0n,
    usdcAllowance: 0n,
    ...overrides
  }) as ContractCall[];

describe('cctpBurnCalls (golden: Base burn 0x5bb3d46a…6b6a)', () => {
  it('burns with the same depositForBurn calldata as the real standard transfer', () => {
    const burn = burnCalls().at(-1)!;
    expect(burn.to).toBe(TOKEN_MESSENGER_V2);
    expect(encode(burn)).toBe(BASE_BURN_TX.input);
    const { args } = decodeFunctionData({ abi: tokenMessengerV2Abi, data: BASE_BURN_TX.input });
    // amount, Ethereum's domain, recipient, Base USDC, no destination caller, no fee, standard finality.
    expect(args).toEqual([
      BASE_BURN_AMOUNT,
      0,
      `0x${'0'.repeat(24)}${BASE_BURN_MINT_RECIPIENT.slice(2)}`,
      cctpL2Contracts('base').usdc,
      zeroHash,
      0n,
      2000
    ]);
  });

  it('swaps exactly the burned USDS on PSM3 to the sender, with no slippage', () => {
    const { psm3, usds, usdc } = cctpL2Contracts('base');
    const [approveUsds, swap, approveUsdc] = burnCalls();
    expect(approveUsds.to).toBe(usds);
    expect(decodeFunctionData({ abi: erc20Abi, data: encode(approveUsds) }).args).toEqual([
      psm3,
      BASE_BURN_AMOUNT * UNIT
    ]);
    expect(swap.to).toBe(psm3);
    expect(decodeFunctionData({ abi: psm3L2Abi, data: encode(swap) })).toEqual({
      functionName: 'swapExactIn',
      args: [usds, usdc, BASE_BURN_AMOUNT * UNIT, BASE_BURN_AMOUNT, ACCOUNT, 0n]
    });
    expect(approveUsdc.to).toBe(usdc);
    expect(decodeFunctionData({ abi: erc20Abi, data: encode(approveUsdc) }).args).toEqual([
      TOKEN_MESSENGER_V2,
      BASE_BURN_AMOUNT
    ]);
  });

  it('leaves the USDS below one USDC unit in the wallet', () => {
    const [, swap, , burn] = burnCalls({ amount: BASE_BURN_AMOUNT * UNIT + UNIT - 1n });
    expect(decodeFunctionData({ abi: psm3L2Abi, data: encode(swap) }).args[2]).toBe(BASE_BURN_AMOUNT * UNIT);
    expect(decodeFunctionData({ abi: tokenMessengerV2Abi, data: encode(burn) }).args[0]).toBe(
      BASE_BURN_AMOUNT
    );
    expect(cctpBurnAmount(UNIT - 1n)).toBe(0n);
  });

  it('skips each approve the allowance already covers', () => {
    const calls = burnCalls({ usdsAllowance: BASE_BURN_AMOUNT * UNIT, usdcAllowance: BASE_BURN_AMOUNT });
    expect(calls.map(call => call.functionName)).toEqual(['swapExactIn', 'depositForBurn']);
  });

  it.each(['optimism', 'unichain', 'arbitrum'] as const)('burns the %s USDC through its PSM3', network => {
    const { psm3, usdc } = cctpL2Contracts(network);
    const [, swap, , burn] = burnCalls({ network });
    expect(swap.to).toBe(psm3);
    expect(decodeFunctionData({ abi: tokenMessengerV2Abi, data: encode(burn) }).args[3]).toBe(usdc);
  });

  it('refuses a burn under one USDC unit', () => {
    expect(() => burnCalls({ amount: UNIT - 1n })).toThrow();
  });

  // The USDC the wallet already holds is the user's own: a new bridge never burns it.
  it('swaps the whole amount, whatever USDC the wallet already holds', () => {
    const { psm3, usds, usdc } = cctpL2Contracts('base');
    const calls = burnCalls({ usdcBalance: BASE_BURN_AMOUNT } as never);
    expect(calls.map(call => call.functionName)).toEqual([
      'approve',
      'swapExactIn',
      'approve',
      'depositForBurn'
    ]);
    expect(decodeFunctionData({ abi: psm3L2Abi, data: encode(calls[1]) }).args).toEqual([
      usds,
      usdc,
      BASE_BURN_AMOUNT * UNIT,
      BASE_BURN_AMOUNT,
      ACCOUNT,
      0n
    ]);
    expect(decodeFunctionData({ abi: erc20Abi, data: encode(calls[0]) }).args).toEqual([
      psm3,
      BASE_BURN_AMOUNT * UNIT
    ]);
  });

  // Continuing a bridge whose swap mined: only the USDC that swap returned is burned.
  it('burns the amount with no swap when continuing a swapped bridge', () => {
    const calls = burnCalls({ swap: false });
    expect(calls.map(call => call.functionName)).toEqual(['approve', 'depositForBurn']);
    expect(encode(calls[1])).toBe(BASE_BURN_TX.input);
    expect(
      burnCalls({ swap: false, usdcAllowance: BASE_BURN_AMOUNT }).map(call => call.functionName)
    ).toEqual(['depositForBurn']);
  });

  it('refuses to mint to a system address or a CCTP contract', () => {
    for (const mintRecipient of [
      '0x0000000000000000000000000000000000000000',
      '0x000000000000000000000000000000000000dEaD',
      ...CCTP_CONTRACTS
    ] as const) {
      expect(() => burnCalls({ mintRecipient })).toThrow();
    }
  });
});

describe('cctpClaimCalls (golden: the Ethereum receive of the same burn)', () => {
  const recipient = getAddress(BASE_BURN_MINT_RECIPIENT);
  const claim = (usdcAllowance = 0n) =>
    cctpClaimCalls({ ...BASE_BURN_ATTESTED, account: recipient, usdcAllowance }) as ContractCall[];

  it('receives the attested message with the calldata the real receive carried', () => {
    const [receive] = claim();
    expect(receive.to).toBe(MESSAGE_TRANSMITTER_V2);
    const data = encode(receive);
    expect(decodeFunctionData({ abi: messageTransmitterV2Abi, data }).args).toEqual([
      BASE_BURN_ATTESTED.message,
      BASE_BURN_ATTESTED.attestation
    ]);
    expect(ETHEREUM_RECEIVE_INPUT.includes(data.slice(2))).toBe(true);
  });

  it('sells the whole mint for USDS to the recipient', () => {
    const [, approve, sell] = claim();
    expect(approve.to).toBe(L1_USDC);
    expect(decodeFunctionData({ abi: erc20Abi, data: encode(approve) }).args).toEqual([
      USDS_PSM_WRAPPER,
      BASE_BURN_AMOUNT
    ]);
    expect(sell.to).toBe(USDS_PSM_WRAPPER);
    expect(decodeFunctionData({ abi: usdsPsmWrapperAbi, data: encode(sell) })).toEqual({
      functionName: 'sellGem',
      args: [recipient, BASE_BURN_AMOUNT]
    });
    expect(claim(BASE_BURN_AMOUNT).map(call => call.functionName)).toEqual(['receiveMessage', 'sellGem']);
  });

  it('refuses a message minted to another account', () => {
    expect(() =>
      cctpClaimCalls({
        ...BASE_BURN_ATTESTED,
        account: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        usdcAllowance: 0n
      })
    ).toThrow();
  });
});

describe('cctpConvertCalls', () => {
  it('sells USDC already in the wallet for USDS to the same account', () => {
    const calls = cctpConvertCalls({ account: ACCOUNT, amount: 5n, usdcAllowance: 5n }) as ContractCall[];
    expect(calls.map(call => [call.to, call.functionName])).toEqual([[USDS_PSM_WRAPPER, 'sellGem']]);
    expect(decodeFunctionData({ abi: usdsPsmWrapperAbi, data: encode(calls[0]) }).args).toEqual([
      ACCOUNT,
      5n
    ]);
  });
});
