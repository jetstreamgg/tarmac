import { describe, expect, it } from 'vitest';
import { erc20Abi, type Call } from 'viem';
import { encodeCalls, exactMatch, isTailOf, tightensOnly } from './callIntent';

const TOKEN = '0x1111111111111111111111111111111111111111';
const SPENDER = '0x2222222222222222222222222222222222222222';

const approve = (amount: bigint) =>
  ({ to: TOKEN, abi: erc20Abi, functionName: 'approve', args: [SPENDER, amount] }) as Call;
const transfer = (amount: bigint) =>
  ({ to: TOKEN, abi: erc20Abi, functionName: 'transfer', args: [SPENDER, amount] }) as Call;

const encode = (calls: Call[]) => encodeCalls(calls)!;

describe('encodeCalls', () => {
  it('encodes abi calls and keeps raw data calls', () => {
    const [abiCall, rawCall] = encode([transfer(1n), { to: TOKEN, data: '0xdeadbeef', value: 5n } as Call]);
    expect(abiCall.data?.startsWith('0xa9059cbb')).toBe(true);
    expect(abiCall.value).toBe(0n);
    expect(rawCall).toMatchObject({ to: TOKEN, data: '0xdeadbeef', value: 5n });
  });

  it('normalises the target address case', () => {
    const [call] = encode([{ ...transfer(1n), to: TOKEN.toUpperCase().replace('0X', '0x') } as Call]);
    expect(call.to).toBe(TOKEN);
  });

  it('returns null when a call cannot be encoded', () => {
    expect(
      encodeCalls([
        { to: TOKEN, abi: erc20Abi, functionName: 'transfer', args: [SPENDER] } as unknown as Call
      ])
    ).toBeNull();
  });
});

describe('isTailOf', () => {
  const confirmed = encode([approve(100n), transfer(90n)]);

  it('accepts the same list', () => {
    expect(isTailOf(encode([approve(100n), transfer(90n)]), confirmed)).toBe(true);
  });

  it('accepts the list with the approve dropped off the front', () => {
    expect(isTailOf(encode([transfer(90n)]), confirmed)).toBe(true);
  });

  it('rejects an empty list once calls were confirmed', () => {
    expect(isTailOf([], confirmed)).toBe(false);
  });

  it('accepts an empty list when nothing was confirmed', () => {
    expect(isTailOf([], [])).toBe(true);
  });

  it('rejects a changed final call', () => {
    expect(isTailOf(encode([transfer(80n)]), confirmed)).toBe(false);
    expect(isTailOf(encode([approve(100n), transfer(80n)]), confirmed)).toBe(false);
  });

  it('rejects a changed earlier call', () => {
    expect(isTailOf(encode([approve(200n), transfer(90n)]), confirmed)).toBe(false);
  });

  it('rejects a longer list', () => {
    expect(isTailOf(encode([approve(100n), approve(100n), transfer(90n)]), confirmed)).toBe(false);
  });

  it('rejects a changed value', () => {
    const raw = { to: TOKEN, data: '0x' } as Call;
    expect(isTailOf(encode([{ ...raw, value: 2n } as Call]), encode([{ ...raw, value: 1n } as Call]))).toBe(
      false
    );
  });
});

// Stands in for a PSM-style swap: (assetIn, assetOut, amount, bound, receiver, referral).
const swapAbi = [
  {
    type: 'function',
    name: 'swapExactIn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assetIn', type: 'address' },
      { name: 'assetOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'referralCode', type: 'uint256' }
    ],
    outputs: [{ type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'swapExactOut',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assetIn', type: 'address' },
      { name: 'assetOut', type: 'address' },
      { name: 'amountOut', type: 'uint256' },
      { name: 'maxAmountIn', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'referralCode', type: 'uint256' }
    ],
    outputs: [{ type: 'uint256' }]
  }
] as const;
const PSM = '0x3333333333333333333333333333333333333333';
const RECEIVER = '0x4444444444444444444444444444444444444444';
const OTHER = '0x5555555555555555555555555555555555555555';
const swapIn = (amountIn: bigint, minOut: bigint, receiver: string = RECEIVER) =>
  ({
    to: PSM,
    abi: swapAbi,
    functionName: 'swapExactIn',
    args: [TOKEN, SPENDER, amountIn, minOut, receiver, 1n]
  }) as Call;
const swapOut = (amountOut: bigint, maxIn: bigint) =>
  ({
    to: PSM,
    abi: swapAbi,
    functionName: 'swapExactOut',
    args: [TOKEN, SPENDER, amountOut, maxIn, RECEIVER, 1n]
  }) as Call;

describe('tightensOnly', () => {
  const matches = tightensOnly({
    swapExactIn: { index: 3, kind: 'min' },
    swapExactOut: { index: 3, kind: 'max' }
  });

  it('accepts an unchanged call', () => {
    expect(matches(swapIn(1000n, 990n), swapIn(1000n, 990n))).toBe(true);
  });

  it('accepts a min-out that rose and refuses one that fell', () => {
    expect(matches(swapIn(1000n, 991n), swapIn(1000n, 990n))).toBe(true);
    expect(matches(swapIn(1000n, 989n), swapIn(1000n, 990n))).toBe(false);
  });

  it('accepts a max-in that fell and refuses one that rose', () => {
    expect(matches(swapOut(1000n, 899n), swapOut(1000n, 900n))).toBe(true);
    expect(matches(swapOut(1000n, 901n), swapOut(1000n, 900n))).toBe(false);
  });

  it('refuses any change outside the bound, even with a tighter bound', () => {
    expect(matches(swapIn(1001n, 991n), swapIn(1000n, 990n))).toBe(false);
    expect(matches(swapIn(1000n, 991n, OTHER), swapIn(1000n, 990n))).toBe(false);
    expect(matches({ ...swapIn(1000n, 991n), to: OTHER } as Call, swapIn(1000n, 990n))).toBe(false);
    expect(matches({ ...swapIn(1000n, 991n), value: 1n } as Call, swapIn(1000n, 990n))).toBe(false);
  });

  it('refuses a switch to another listed function', () => {
    expect(matches(swapOut(1000n, 990n), swapIn(1000n, 990n))).toBe(false);
  });

  it('compares unlisted calls byte for byte', () => {
    expect(matches(approve(100n), approve(100n))).toBe(true);
    expect(matches(approve(101n), approve(100n))).toBe(false);
  });

  it('refuses a raw-data call standing in for a listed one', () => {
    const [encoded] = encodeCalls([swapIn(1000n, 991n)])!;
    expect(matches({ to: PSM, data: encoded.data } as Call, swapIn(1000n, 990n))).toBe(false);
  });

  it('plugs into isTailOf without relaxing the tail rules', () => {
    const confirmed = encode([approve(1000n), swapIn(1000n, 990n)]);
    expect(isTailOf(encode([swapIn(1000n, 995n)]), confirmed, matches)).toBe(true);
    expect(isTailOf(encode([swapIn(1000n, 985n)]), confirmed, matches)).toBe(false);
    expect(isTailOf([], confirmed, matches)).toBe(false);
    expect(isTailOf(encode([approve(1000n), approve(1000n), swapIn(1000n, 990n)]), confirmed, matches)).toBe(
      false
    );
  });
});

describe('tightensOnly with a paired approve', () => {
  const matches = tightensOnly({
    swapExactOut: { index: 3, kind: 'max' },
    approve: { index: 1, kind: 'max' }
  });

  it('lets the approve amount shrink with the max-in, never grow or change spender', () => {
    const confirmed = encode([approve(900n), swapOut(1000n, 900n)]);
    expect(isTailOf(encode([approve(899n), swapOut(1000n, 899n)]), confirmed, matches)).toBe(true);
    expect(isTailOf(encode([approve(901n), swapOut(1000n, 901n)]), confirmed, matches)).toBe(false);
    const otherSpender = { ...approve(899n), args: [OTHER, 899n] } as Call;
    expect(isTailOf(encode([otherSpender, swapOut(1000n, 899n)]), confirmed, matches)).toBe(false);
  });
});

describe('exactMatch', () => {
  it('matches only identical calls and fails closed on an unencodable one', () => {
    expect(exactMatch(transfer(1n), transfer(1n))).toBe(true);
    expect(exactMatch(transfer(1n), transfer(2n))).toBe(false);
    const broken = { to: TOKEN, abi: erc20Abi, functionName: 'transfer', args: [SPENDER] } as unknown as Call;
    expect(exactMatch(broken, broken)).toBe(false);
  });
});
