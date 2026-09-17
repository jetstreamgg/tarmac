import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { erc20Abi, type Call } from 'viem';

const h = vi.hoisted(() => ({
  flowParams: null as null | { calls: Call[]; enabled: boolean },
  connected: true
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({
    address: h.connected ? '0x1111111111111111111111111111111111111111' : undefined,
    isConnected: h.connected
  })
}));

vi.mock('./useTransactionFlow', () => ({
  useTransactionFlow: (params: { calls: Call[]; enabled: boolean }) => {
    h.flowParams = params;
    return {
      error: null,
      isLoading: false,
      prepared: params.enabled,
      execute: () => undefined,
      reset: () => undefined
    };
  }
}));

import { useApproveThenAct, type ApproveThenActLeg } from './useApproveThenAct';

const TOKEN = '0x2222222222222222222222222222222222222222' as const;
const SPENDER = '0x3333333333333333333333333333333333333333' as const;
const ACTION: Call = { to: SPENDER, abi: [], functionName: 'act', args: [] } as unknown as Call;

const render = (legs: ApproveThenActLeg[]) =>
  renderHook(() => useApproveThenAct({ legs, chainId: 1, shouldUseBatch: false })).result.current;

describe('useApproveThenAct', () => {
  beforeEach(() => {
    h.flowParams = null;
    h.connected = true;
  });

  it('elides the approve when the allowance covers the amount', () => {
    const hook = render([
      { approve: { token: TOKEN, spender: SPENDER, amount: 10n, allowance: 10n }, calls: [ACTION] }
    ]);
    expect(hook.plan).toEqual([{ kind: 'action', leg: 0 }]);
    expect(h.flowParams?.calls).toEqual([ACTION]);
    expect(h.flowParams?.enabled).toBe(true);
  });

  it('prefixes the approve when the allowance is short', () => {
    const hook = render([
      { approve: { token: TOKEN, spender: SPENDER, amount: 10n, allowance: 5n }, calls: [ACTION] }
    ]);
    expect(hook.plan.map(p => p.kind)).toEqual(['approve', 'action']);
    expect(h.flowParams?.calls[0]).toMatchObject({
      to: TOKEN,
      abi: erc20Abi,
      functionName: 'approve',
      args: [SPENDER, 10n]
    });
    expect(h.flowParams?.enabled).toBe(true);
  });

  it('sends approve(0) first for a reset-first token with a stale nonzero allowance', () => {
    const hook = render([
      {
        approve: { token: TOKEN, spender: SPENDER, amount: 10n, allowance: 5n, resetFirst: true },
        calls: [ACTION]
      }
    ]);
    expect(hook.plan.map(p => p.kind)).toEqual(['reset', 'approve', 'action']);
    expect(h.flowParams?.calls[0]).toMatchObject({ functionName: 'approve', args: [SPENDER, 0n] });
  });

  it('stays disabled while an allowance is unresolved, planning the approve pessimistically', () => {
    const hook = render([
      { approve: { token: TOKEN, spender: SPENDER, amount: 10n, allowance: undefined }, calls: [ACTION] }
    ]);
    expect(hook.plan.map(p => p.kind)).toEqual(['approve', 'action']);
    expect(h.flowParams?.enabled).toBe(false);
    expect(hook.prepared).toBe(false);
  });

  it('stays disabled when the token or spender has no address on this chain', () => {
    // An off-chain launch (e.g. the upgrade modal opened on an L2) must not send the action alone.
    const noToken = render([
      { approve: { token: undefined, spender: SPENDER, amount: 10n, allowance: 0n }, calls: [ACTION] }
    ]);
    expect(h.flowParams?.enabled).toBe(false);
    expect(noToken.plan).toEqual([{ kind: 'action', leg: 0 }]);

    render([{ approve: { token: TOKEN, spender: undefined, amount: 10n, allowance: 0n }, calls: [ACTION] }]);
    expect(h.flowParams?.enabled).toBe(false);
  });

  it('runs an action-only leg without any allowance gate', () => {
    const hook = render([{ calls: [ACTION] }]);
    expect(hook.plan).toEqual([{ kind: 'action', leg: 0 }]);
    expect(h.flowParams?.enabled).toBe(true);
  });

  it('stays disabled with no calls or no wallet', () => {
    render([{ calls: [] }]);
    expect(h.flowParams?.enabled).toBe(false);

    h.connected = false;
    render([{ calls: [ACTION] }]);
    expect(h.flowParams?.enabled).toBe(false);
  });

  it('surfaces the allowance read error on the hook', () => {
    const err = new Error('rpc');
    const hook = render([
      {
        approve: { token: TOKEN, spender: SPENDER, amount: 10n, allowance: undefined, allowanceError: err },
        calls: [ACTION]
      }
    ]);
    expect(hook.error).toBe(err);
  });
});
