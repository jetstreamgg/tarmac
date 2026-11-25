import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import {
  bridgeRouteOptions,
  cctpWithdrawalRoute,
  nativeWithdrawalRoute,
  resolveBridgeRoute,
  type BridgeRouteFacts
} from './resolveRoute';

const ONE = parseUnits('1', 18);
const OPEN = { isOpen: true };
const BOTH_OPEN: BridgeRouteFacts = { cctp: OPEN, native: OPEN };

describe('resolveBridgeRoute: the route the user picks', () => {
  it('sends by the native withdrawal when the user picks it and both are open', () => {
    const result = resolveBridgeRoute({
      from: 'base',
      to: 'ethereum',
      amount: ONE,
      facts: BOTH_OPEN,
      preferred: 'native'
    });
    expect(result).toEqual({ status: 'ok', route: nativeWithdrawalRoute('base') });
  });

  it('keeps CCTP when the user picks it, or picks nothing', () => {
    for (const preferred of ['cctp', undefined] as const) {
      const result = resolveBridgeRoute({
        from: 'base',
        to: 'ethereum',
        amount: ONE,
        facts: BOTH_OPEN,
        preferred
      });
      expect(result).toEqual({ status: 'ok', route: cctpWithdrawalRoute('base') });
    }
  });

  it("sends by the native withdrawal while CCTP's reads are unread, once the user picks it", () => {
    const result = resolveBridgeRoute({
      from: 'optimism',
      to: 'ethereum',
      amount: ONE,
      facts: { cctp: 'loading', native: OPEN },
      preferred: 'native'
    });
    expect(result).toEqual({ status: 'ok', route: nativeWithdrawalRoute('optimism') });
  });

  it('falls back to the default when the picked route is unavailable', () => {
    const nativeClosed = resolveBridgeRoute({
      from: 'base',
      to: 'ethereum',
      amount: ONE,
      facts: { cctp: OPEN, native: { isOpen: false } },
      preferred: 'native'
    });
    expect(nativeClosed).toEqual({ status: 'ok', route: cctpWithdrawalRoute('base') });
    const cctpClosed = resolveBridgeRoute({
      from: 'base',
      to: 'ethereum',
      amount: ONE,
      facts: { cctp: { isOpen: false }, native: OPEN },
      preferred: 'cctp'
    });
    expect(cctpClosed).toEqual({ status: 'ok', route: nativeWithdrawalRoute('base', 'closed') });
  });

  it('ignores a pick on a pair with a single route', () => {
    const result = resolveBridgeRoute({
      from: 'ethereum',
      to: 'base',
      amount: ONE,
      facts: { native: OPEN },
      preferred: 'cctp'
    });
    expect(result.status === 'ok' && result.route.kind).toBe('native');
  });
});

describe('bridgeRouteOptions', () => {
  it('lists CCTP then the native withdrawal from an L2, both available', () => {
    expect(bridgeRouteOptions({ from: 'arbitrum', to: 'ethereum', amount: ONE, facts: BOTH_OPEN })).toEqual([
      { route: cctpWithdrawalRoute('arbitrum') },
      { route: nativeWithdrawalRoute('arbitrum') }
    ]);
  });

  it.each([
    ['closed', { isOpen: false }],
    ['over-limit', { isOpen: true, maxAmount: 1n }],
    ['no-liquidity', { isOpen: true, liquidity: 1n }]
  ] as const)('says CCTP is unavailable when it is %s', (reason, cctp) => {
    const [option] = bridgeRouteOptions({
      from: 'base',
      to: 'ethereum',
      amount: ONE,
      facts: { cctp, native: OPEN }
    })!;
    expect(option).toEqual({ route: cctpWithdrawalRoute('base'), unavailable: reason });
  });

  it('says why the native withdrawal is unavailable, unread reads included', () => {
    const reason = (native: BridgeRouteFacts['native']) =>
      bridgeRouteOptions({ from: 'base', to: 'ethereum', amount: ONE, facts: { cctp: OPEN, native } })![1]
        .unavailable;
    expect(reason({ isOpen: false })).toBe('closed');
    expect(reason({ isOpen: true, maxAmount: 1n })).toBe('over-limit');
    expect(reason('loading')).toBe('facts-loading');
    expect(reason('error')).toBe('facts-error');
  });

  it('offers no choice on a pair with a single route', () => {
    expect(
      bridgeRouteOptions({ from: 'ethereum', to: 'base', amount: ONE, facts: { native: OPEN } })
    ).toBeUndefined();
    expect(
      bridgeRouteOptions({ from: 'base', to: 'optimism', amount: ONE, facts: BOTH_OPEN })
    ).toBeUndefined();
  });
});
