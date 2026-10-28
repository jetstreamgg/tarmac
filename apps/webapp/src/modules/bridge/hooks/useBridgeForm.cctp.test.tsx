/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BridgeRouteFacts } from '../model/resolveRoute';
import { useBridgeForm } from './useBridgeForm';

const mocks = vi.hoisted(() => ({
  appChainId: 8453,
  cctp: undefined as unknown,
  native: undefined as unknown,
  nativeArgs: [] as { from: string; to: string; chainId?: number }[],
  gateArgs: [] as { from: string; to: string; sourceChainId?: number; ethereumChainId?: number }[]
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ isConnected: true, address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' }),
  useChains: () => [1, 8453, 10, 42161, 130].map(id => ({ id })),
  useReadContract: () => ({ status: 'pending', data: undefined })
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useAppChainId: () => mocks.appChainId,
  useSafeWalletStatus: () => 'not-safe',
  useTokenBalance: () => ({ data: { value: 10n ** 18n }, isLoading: false, refetch: () => undefined })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ canSwitchChain: true, handleSwitchChain: () => undefined })
}));
vi.mock('./useSafeConfig', () => ({ useSafeConfig: () => ({ lookup: undefined, isChecking: false }) }));
vi.mock('./useAddressCode', () => ({
  useAddressCode: ({ address, chainId }: { address?: string; chainId?: number }) => ({
    code: address && chainId !== undefined ? 'none' : undefined,
    isChecking: false
  })
}));
vi.mock('./useCctpGate', () => ({
  useCctpGate: (args: (typeof mocks.gateArgs)[number]) => {
    mocks.gateArgs.push(args);
    return args.to === 'ethereum' && args.from !== 'ethereum' ? mocks.cctp : undefined;
  }
}));

vi.mock('./useNativeWithdrawalGate', () => ({
  useNativeWithdrawalGate: (args: (typeof mocks.nativeArgs)[number]) => {
    mocks.nativeArgs.push(args);
    return args.to === 'ethereum' && args.from !== 'ethereum' ? mocks.native : undefined;
  }
}));

type CctpFact = BridgeRouteFacts['cctp'];
const OPEN: CctpFact = { isOpen: true, maxAmount: 10n ** 30n, liquidity: 10n ** 30n };
const NATIVE_OPEN: BridgeRouteFacts['native'] = { isOpen: true, maxAmount: 10n ** 30n };

const typedOnL2 = () => {
  const { result } = renderHook(() => useBridgeForm());
  act(() => result.current.onInput('1'));
  return result;
};

describe('useBridgeForm: an L2 to Ethereum bridge goes through the CCTP gate', () => {
  beforeEach(() => {
    Object.assign(mocks, { appChainId: 8453, cctp: OPEN, native: NATIVE_OPEN, nativeArgs: [], gateArgs: [] });
  });

  it('routes Base to Ethereum by CCTP once the gate reads open, reading it on Base and Ethereum', () => {
    const result = typedOnL2();
    expect(result.current.from).toBe('base');
    expect(mocks.gateArgs.at(-1)).toMatchObject({
      from: 'base',
      to: 'ethereum',
      sourceChainId: 8453,
      ethereumChainId: 1
    });
    expect(result.current.route?.kind).toBe('cctp');
    expect(result.current.blockedReason).toBeUndefined();
    expect(result.current.reviewBlocked).toBe(false);
  });

  it('blocks Review while the gate is loading', () => {
    mocks.cctp = 'loading';
    const result = typedOnL2();
    expect(result.current.route).toBeUndefined();
    expect(result.current.blockedReason).toBe('facts-loading');
    expect(result.current.reviewBlocked).toBe(true);
  });

  it("falls back to the native withdrawal when the gate can't be read", () => {
    mocks.cctp = 'error';
    const result = typedOnL2();
    expect(result.current.route).toMatchObject({ kind: 'native', fallbackReason: 'facts-error' });
    expect(result.current.blockedReason).toBeUndefined();
    expect(result.current.reviewBlocked).toBe(false);
  });

  it.each([
    ['closed', { isOpen: false }],
    ['over-limit', { isOpen: true, maxAmount: 1n }],
    ['no-liquidity', { isOpen: true, liquidity: 1n }]
  ])('falls back to the native withdrawal, read on Base, when CCTP is %s', (reason, gate) => {
    mocks.cctp = gate;
    const result = typedOnL2();
    expect(mocks.nativeArgs.at(-1)).toMatchObject({ from: 'base', to: 'ethereum', chainId: 8453 });
    expect(result.current.route).toMatchObject({ kind: 'native', fallbackReason: reason });
    expect(result.current.blockedReason).toBeUndefined();
    expect(result.current.reviewBlocked).toBe(false);
  });

  it.each([
    ['closed', { isOpen: false }, 'closed'],
    ['over its limit', { isOpen: true, maxAmount: 1n }, 'over-limit'],
    ['loading', 'loading', 'facts-loading'],
    ['unreadable', 'error', 'facts-error']
  ])('blocks Review when CCTP is closed and the native withdrawal is %s', (_, fact, reason) => {
    mocks.cctp = { isOpen: false };
    mocks.native = fact;
    const result = typedOnL2();
    expect(result.current.route).toBeUndefined();
    expect(result.current.blockedReason).toBe(reason);
    expect(result.current.reviewBlocked).toBe(true);
  });

  it('blocks an L2 source with no CCTP gate rather than reading CCTP as open', () => {
    mocks.cctp = undefined;
    const result = typedOnL2();
    expect(result.current.route).toBeUndefined();
    expect(result.current.reviewBlocked).toBe(true);
  });

  it('offers the flip between Ethereum and an L2 both ways', () => {
    expect(typedOnL2().current.canFlip).toBe(true);
    mocks.appChainId = 1;
    const fromEthereum = renderHook(() => useBridgeForm()).result;
    expect(fromEthereum.current.to).toBe('base');
    expect(fromEthereum.current.canFlip).toBe(true);
  });
});

describe('useBridgeForm: picking the route of an L2 to Ethereum bridge', () => {
  beforeEach(() => {
    Object.assign(mocks, { appChainId: 8453, cctp: OPEN, native: NATIVE_OPEN, nativeArgs: [], gateArgs: [] });
  });

  it('offers CCTP, preselected, and the native withdrawal', () => {
    const result = typedOnL2();
    expect(result.current.routeOptions?.map(option => [option.route.kind, option.unavailable])).toEqual([
      ['cctp', undefined],
      ['native', undefined]
    ]);
    expect(result.current.route?.kind).toBe('cctp');
  });

  it('sends by the native withdrawal once the user picks it, and back by CCTP', () => {
    const result = typedOnL2();
    act(() => result.current.pickRoute('native'));
    expect(result.current.route).toMatchObject({ kind: 'native' });
    expect(result.current.route?.fallbackReason).toBeUndefined();
    expect(result.current.reviewBlocked).toBe(false);
    act(() => result.current.pickRoute('cctp'));
    expect(result.current.route?.kind).toBe('cctp');
  });

  it('says why CCTP is unavailable and keeps the native withdrawal when CCTP is picked', () => {
    mocks.cctp = { isOpen: true, liquidity: 1n };
    const result = typedOnL2();
    expect(result.current.routeOptions?.[0].unavailable).toBe('no-liquidity');
    act(() => result.current.pickRoute('cctp'));
    expect(result.current.route).toMatchObject({ kind: 'native', fallbackReason: 'no-liquidity' });
  });

  it('forgets the pick once the source changes', () => {
    const { result, rerender } = renderHook(() => useBridgeForm());
    act(() => result.current.onInput('1'));
    act(() => result.current.pickRoute('native'));
    mocks.appChainId = 10;
    rerender();
    expect(result.current.from).toBe('optimism');
    expect(result.current.route?.kind).toBe('cctp');
  });

  it('offers no route choice from Ethereum', () => {
    mocks.appChainId = 1;
    const { result } = renderHook(() => useBridgeForm());
    expect(result.current.routeOptions).toBeUndefined();
  });
});
