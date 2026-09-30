import { describe, expect, it } from 'vitest';
import { erc20Abi, type Call } from 'viem';
import { encodeCalls, isTailOf } from './callIntent';

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
    expect(rawCall).toEqual({ to: TOKEN, data: '0xdeadbeef', value: 5n });
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
