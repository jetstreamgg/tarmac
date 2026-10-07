import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { resolveBridgeRoute, toRouteFact } from './resolveRoute';
import type { BridgeNetworkId } from './networks';

const usds = (value: string) => parseUnits(value, 18);
const L2S = ['base', 'arbitrum', 'optimism', 'unichain'] as const;

const resolve = (
  from: BridgeNetworkId,
  to: BridgeNetworkId,
  amount = usds('1000'),
  facts: Parameters<typeof resolveBridgeRoute>[0]['facts'] = {}
) => resolveBridgeRoute({ from, to, amount, facts });

const okRoute = (result: ReturnType<typeof resolveBridgeRoute>) => {
  if (result.status !== 'ok') throw new Error(`expected a route, got ${result.reason}`);
  return result.route;
};

describe('resolveBridgeRoute: pairs', () => {
  it('Ethereum to an L2 uses the native deposit: source-side only, no claim', () => {
    for (const to of L2S) {
      const route = okRoute(resolve('ethereum', to));
      expect(route.kind).toBe('native');
      expect(route.steps).toEqual([
        { network: 'ethereum', action: 'approve' },
        { network: 'ethereum', action: 'send' }
      ]);
      expect(route.requiresClaim).toBe(false);
      expect(route.fallbackReason).toBeUndefined();
    }
  });

  it('uses the measured deposit times per L2', () => {
    expect(okRoute(resolve('ethereum', 'optimism')).etaMinutes).toBe(1);
    expect(okRoute(resolve('ethereum', 'unichain')).etaMinutes).toBe(1);
    expect(okRoute(resolve('ethereum', 'base')).etaMinutes).toBe(3);
    expect(okRoute(resolve('ethereum', 'arbitrum')).etaMinutes).toBe(7);
  });

  it('an L2 to Ethereum uses CCTP with a claim on Ethereum', () => {
    for (const from of L2S) {
      const route = okRoute(resolve(from, 'ethereum'));
      expect(route.kind).toBe('cctp');
      expect(route.steps).toEqual([
        { network: from, action: 'approve' },
        { network: from, action: 'send' },
        { network: 'ethereum', action: 'claim' }
      ]);
      expect(route.requiresClaim).toBe(true);
      expect(route.etaMinutes).toBe(20);
    }
  });

  it('Ethereum to and from Avalanche and Solana uses LayerZero, no claim', () => {
    for (const [from, to] of [
      ['ethereum', 'avalanche'],
      ['avalanche', 'ethereum'],
      ['ethereum', 'solana'],
      ['solana', 'ethereum']
    ] as const) {
      const route = okRoute(resolve(from, to));
      expect(route.kind).toBe('layerzero');
      expect(route.requiresClaim).toBe(false);
      expect(route.steps.every(step => step.network === from)).toBe(true);
    }
  });

  it('a Solana source has no ERC-20 approve', () => {
    expect(okRoute(resolve('solana', 'ethereum')).steps).toEqual([{ network: 'solana', action: 'send' }]);
    expect(okRoute(resolve('ethereum', 'solana')).steps[0]).toEqual({
      network: 'ethereum',
      action: 'approve'
    });
  });

  it('LayerZero has no fee until the route quotes it; native and CCTP are free', () => {
    expect(okRoute(resolve('ethereum', 'avalanche')).bridgeFeeUsd).toBeUndefined();
    expect(
      okRoute(resolve('ethereum', 'avalanche', usds('1'), { layerzero: { bridgeFeeUsd: 0.42 } })).bridgeFeeUsd
    ).toBe(0.42);
    expect(okRoute(resolve('ethereum', 'base')).bridgeFeeUsd).toBe(0);
    expect(okRoute(resolve('base', 'ethereum')).bridgeFeeUsd).toBe(0);
  });

  it('every route is 1:1 with no slippage (PSMs swap at a fixed price)', () => {
    for (const route of [
      resolve('ethereum', 'base'),
      resolve('base', 'ethereum'),
      resolve('ethereum', 'solana')
    ]) {
      expect(okRoute(route).rate).toBe('1:1');
      expect(okRoute(route).slippage).toBe(0);
    }
  });

  it('blocks L2 to L2, L2 to Avalanche/Solana and same-network pairs', () => {
    expect(resolve('base', 'arbitrum')).toEqual({ status: 'blocked', reason: 'pair-not-allowed' });
    expect(resolve('base', 'solana')).toEqual({ status: 'blocked', reason: 'pair-not-allowed' });
    expect(resolve('avalanche', 'solana')).toEqual({ status: 'blocked', reason: 'pair-not-allowed' });
    expect(resolve('ethereum', 'ethereum')).toEqual({ status: 'blocked', reason: 'pair-not-allowed' });
  });
});

describe('resolveBridgeRoute: CCTP fallback to the native withdrawal', () => {
  it('falls back when the PSM3 cannot swap the amount', () => {
    const route = okRoute(
      resolve('unichain', 'ethereum', usds('50000'), { cctp: { liquidity: usds('28700') } })
    );
    expect(route.kind).toBe('native');
    expect(route.fallbackReason).toBe('no-liquidity');
    expect(route.requiresClaim).toBe(true);
  });

  it('keeps CCTP when the liquidity covers the amount exactly', () => {
    expect(
      okRoute(resolve('base', 'ethereum', usds('1000'), { cctp: { liquidity: usds('1000') } })).kind
    ).toBe('cctp');
  });

  it('falls back when the amount is over the CCTP per-message limit', () => {
    const route = okRoute(
      resolve('base', 'ethereum', usds('2000000'), { cctp: { maxAmount: usds('1000000') } })
    );
    expect(route.kind).toBe('native');
    expect(route.fallbackReason).toBe('over-limit');
  });

  it('falls back when CCTP is paused', () => {
    expect(okRoute(resolve('base', 'ethereum', usds('1'), { cctp: { isOpen: false } })).fallbackReason).toBe(
      'closed'
    );
  });

  it('OP Stack withdrawals prove then finalize on Ethereum', () => {
    for (const from of ['base', 'optimism', 'unichain'] as const) {
      expect(okRoute(resolve(from, 'ethereum', usds('1'), { cctp: { isOpen: false } })).steps).toEqual([
        { network: from, action: 'approve' },
        { network: from, action: 'send' },
        { network: 'ethereum', action: 'prove' },
        { network: 'ethereum', action: 'finalize' }
      ]);
    }
  });

  it('Arbitrum withdrawals only finalize (outbox execute) on Ethereum', () => {
    expect(okRoute(resolve('arbitrum', 'ethereum', usds('1'), { cctp: { isOpen: false } })).steps).toEqual([
      { network: 'arbitrum', action: 'approve' },
      { network: 'arbitrum', action: 'send' },
      { network: 'ethereum', action: 'finalize' }
    ]);
  });

  it('uses the measured withdrawal times', () => {
    const closed = { cctp: { isOpen: false } };
    const days = (from: BridgeNetworkId) =>
      okRoute(resolve(from, 'ethereum', usds('1'), closed)).etaMinutes / 1440;
    expect(days('base')).toBe(5);
    expect(days('optimism')).toBe(7);
    expect(days('unichain')).toBe(7);
    expect(days('arbitrum')).toBeCloseTo(6.4, 1);
  });

  it('blocks when the native withdrawal is closed too', () => {
    expect(
      resolve('base', 'ethereum', usds('1'), { cctp: { isOpen: false }, native: { isOpen: false } })
    ).toEqual({
      status: 'blocked',
      reason: 'closed'
    });
  });

  it('a zero amount ignores limits and liquidity (the form shows the route before typing)', () => {
    expect(
      okRoute(resolve('unichain', 'ethereum', 0n, { cctp: { liquidity: 0n, maxAmount: 0n } })).kind
    ).toBe('cctp');
  });
});

describe('resolveBridgeRoute: single-route pairs', () => {
  it('blocks a closed native deposit', () => {
    expect(resolve('ethereum', 'base', usds('1'), { native: { isOpen: false } })).toEqual({
      status: 'blocked',
      reason: 'closed'
    });
  });

  it('blocks a LayerZero send over the rate limit', () => {
    expect(resolve('ethereum', 'avalanche', usds('10'), { layerzero: { maxAmount: usds('5') } })).toEqual({
      status: 'blocked',
      reason: 'over-limit'
    });
  });

  it('unknown facts do not block (each route ticket supplies its reads)', () => {
    expect(resolve('ethereum', 'base', usds('1'), {}).status).toBe('ok');
  });
});

describe('resolveBridgeRoute: facts still loading or failed never pass as open', () => {
  const unread = ['loading', 'error'] as const;
  const open = { isOpen: true };

  it('blocks every route while its facts load or after they fail', () => {
    for (const state of unread) {
      expect(resolve('ethereum', 'base', usds('1'), { native: state }).status).toBe('blocked');
      expect(resolve('ethereum', 'avalanche', usds('1'), { layerzero: state }).status).toBe('blocked');
      expect(resolve('solana', 'ethereum', usds('1'), { layerzero: state }).status).toBe('blocked');
      expect(resolve('base', 'ethereum', usds('1'), { cctp: state, native: open }).status).toBe('blocked');
    }
  });

  it('does not fall back to the native withdrawal before CCTP is known', () => {
    for (const state of unread) {
      expect(resolve('arbitrum', 'ethereum', usds('1'), { cctp: state, native: open })).toMatchObject({
        status: 'blocked'
      });
    }
  });

  it('blocks a CCTP fallback while the native facts are unread', () => {
    for (const state of unread) {
      expect(resolve('base', 'ethereum', usds('1'), { cctp: { isOpen: false }, native: state }).status).toBe(
        'blocked'
      );
    }
  });

  it('blocks with a zero amount too (the gate is unknown, not the amount)', () => {
    expect(resolve('ethereum', 'base', 0n, { native: 'loading' }).status).toBe('blocked');
  });
});

describe('toRouteFact', () => {
  it('reads a query as loading, error or its data', () => {
    expect(toRouteFact({ status: 'pending', data: undefined })).toBe('loading');
    expect(toRouteFact({ status: 'error', data: { isOpen: true } })).toBe('error');
    expect(toRouteFact({ status: 'success', data: { isOpen: false } })).toEqual({ isOpen: false });
  });

  it('a successful read with no data is an error, not an open route', () => {
    expect(toRouteFact({ status: 'success', data: undefined })).toBe('error');
  });
});
