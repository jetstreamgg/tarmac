/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARBITRUM_DEPOSIT, OP_STACK_DEPOSIT } from '../adapters/nativeDeposit/contracts';
import type { BridgeNetworkId } from '../model/networks';
import { useNativeWithdrawalGate } from './useNativeWithdrawalGate';

type Read = { address: string; functionName: string; args?: readonly unknown[] };

const mocks = vi.hoisted(() => ({
  status: 'success' as 'success' | 'pending' | 'error',
  isOpen: 1n,
  maxWithdraws: 1_000n,
  // A refetch failed after a good read: TanStack keeps the data and reports the error.
  refetchFailed: false,
  reads: [] as Read[]
}));

vi.mock('wagmi', () => ({
  useReadContract: (read: Read & { query?: { enabled?: boolean } }) => {
    if (read.query?.enabled === false) return { status: 'pending', data: undefined };
    mocks.reads.push(read);
    if (mocks.status !== 'success') return { status: mocks.status, data: undefined };
    return {
      status: mocks.refetchFailed ? 'error' : 'success',
      data: read.functionName === 'isOpen' ? mocks.isOpen : mocks.maxWithdraws
    };
  }
}));

const render = (from: BridgeNetworkId, to: BridgeNetworkId = 'ethereum', chainId: number | null = 10) =>
  renderHook(() => useNativeWithdrawalGate({ from, to, chainId: chainId ?? undefined })).result.current;

describe('useNativeWithdrawalGate', () => {
  beforeEach(() => {
    mocks.status = 'success';
    mocks.isOpen = 1n;
    mocks.maxWithdraws = 1_000n;
    mocks.refetchFailed = false;
    mocks.reads = [];
  });

  it('reads the switch and the limit of L2 USDS on the L2 bridge the withdrawal calls', () => {
    expect(render('optimism')).toEqual({ isOpen: true, maxAmount: 1_000n });
    expect(mocks.reads.slice(-2)).toMatchObject([
      { address: OP_STACK_DEPOSIT.optimism.l2TokenBridge, functionName: 'isOpen' },
      {
        address: OP_STACK_DEPOSIT.optimism.l2TokenBridge,
        functionName: 'maxWithdraws',
        args: [OP_STACK_DEPOSIT.optimism.l2Usds]
      }
    ]);
    render('arbitrum');
    expect(mocks.reads.slice(-2)).toMatchObject([
      { address: ARBITRUM_DEPOSIT.l2Gateway },
      { address: ARBITRUM_DEPOSIT.l2Gateway, args: [ARBITRUM_DEPOSIT.l2Usds] }
    ]);
  });

  it('is closed for any switch value but exactly 1', () => {
    mocks.isOpen = 0n;
    expect(render('base')).toMatchObject({ isOpen: false });
    mocks.isOpen = 2n;
    expect(render('base')).toMatchObject({ isOpen: false });
  });

  it('blocks while loading, on an error and before the chain is known', () => {
    mocks.status = 'pending';
    expect(render('unichain')).toBe('loading');
    mocks.status = 'error';
    expect(render('unichain')).toBe('error');
    mocks.status = 'success';
    expect(render('unichain', 'ethereum', null)).toBe('loading');
  });

  it('keeps the last good read when a refetch fails, so a picked SkyLink route stays put', () => {
    mocks.refetchFailed = true;
    expect(render('base')).toEqual({ isOpen: true, maxAmount: 1_000n });
  });

  it('reads nothing for a deposit, a LayerZero pair or a pair not to Ethereum', () => {
    expect(render('ethereum', 'base')).toBeUndefined();
    expect(render('avalanche')).toBeUndefined();
    expect(render('base', 'arbitrum')).toBeUndefined();
    expect(mocks.reads).toEqual([]);
  });
});
