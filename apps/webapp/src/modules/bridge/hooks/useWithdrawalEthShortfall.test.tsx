/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingBridge } from '../model/types';
import { useWithdrawalEthShortfall } from './useWithdrawalEthShortfall';

const mocks = vi.hoisted(() => ({
  balance: undefined as bigint | undefined,
  feePerGas: undefined as bigint | undefined,
  balanceArgs: [] as { chainId: number; isNative?: boolean; enabled?: boolean }[],
  feeArgs: [] as [number, boolean | undefined][]
}));

vi.mock('@/hooks', () => ({
  useTokenBalance: (args: { chainId: number; isNative?: boolean; enabled?: boolean }) => {
    mocks.balanceArgs.push(args);
    return { data: args.enabled && mocks.balance !== undefined ? { value: mocks.balance } : undefined };
  },
  useFeePerGas: (chainId: number, enabled?: boolean) => {
    mocks.feeArgs.push([chainId, enabled]);
    return { data: enabled ? mocks.feePerGas : undefined };
  }
}));

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const READY: PendingBridge = {
  id: '0xw',
  account: ACCOUNT,
  amount: 10n ** 18n,
  token: 'USDS',
  from: 'optimism',
  to: 'ethereum',
  status: 'ready',
  nextAction: 'prove',
  routeKind: 'native',
  requiresClaim: true,
  startedAt: 0,
  etaAt: 0,
  txHash: '0xff',
  actions: []
};
const shortfall = (bridge: PendingBridge, ...account: [string | undefined] | []) =>
  renderHook(() => useWithdrawalEthShortfall(bridge, account.length ? account[0] : ACCOUNT, 1)).result
    .current;

describe('useWithdrawalEthShortfall', () => {
  beforeEach(() => {
    mocks.balance = undefined;
    mocks.feePerGas = undefined;
    mocks.balanceArgs.length = 0;
    mocks.feeArgs.length = 0;
  });

  it("is the ready step's ETH cost on Ethereum when the wallet can't pay it", () => {
    mocks.feePerGas = 10n;
    mocks.balance = 450_000n * 10n - 1n;
    expect(shortfall(READY)).toBe(4_500_000n);
    expect(shortfall({ ...READY, nextAction: 'finalize' })).toBeUndefined();
    expect(shortfall({ ...READY, from: 'arbitrum', nextAction: 'finalize' })).toBeUndefined();
    mocks.balance = 0n;
    expect(shortfall({ ...READY, from: 'arbitrum', nextAction: 'finalize' })).toBe(2_500_000n);
  });

  it("reads the wallet's ETH and the fee on the family's Ethereum", () => {
    shortfall(READY);
    expect(mocks.balanceArgs.at(-1)).toMatchObject({ chainId: 1, isNative: true, enabled: true });
    expect(mocks.feeArgs.at(-1)).toEqual([1, true]);
  });

  it('is nothing while the balance or the fee is unread', () => {
    mocks.feePerGas = 10n;
    expect(shortfall(READY)).toBeUndefined();
    mocks.feePerGas = undefined;
    mocks.balance = 0n;
    expect(shortfall(READY)).toBeUndefined();
  });

  it('reads nothing for a bridge with no withdrawal step to send, or with no wallet', () => {
    mocks.feePerGas = 10n;
    mocks.balance = 0n;
    for (const bridge of [
      { ...READY, status: 'pending' as const },
      { ...READY, nextAction: 'replay' as const },
      { ...READY, routeKind: 'cctp' as const, nextAction: 'claim' as const },
      { ...READY, from: 'ethereum' as const, to: 'base' as const }
    ])
      expect(shortfall(bridge)).toBeUndefined();
    expect(shortfall(READY, undefined)).toBeUndefined();
    expect(mocks.balanceArgs.every(args => !args.enabled)).toBe(true);
    expect(mocks.feeArgs.every(([, enabled]) => !enabled)).toBe(true);
  });
});
