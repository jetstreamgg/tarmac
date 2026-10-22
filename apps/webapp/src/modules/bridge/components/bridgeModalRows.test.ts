import { i18n } from '@lingui/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseEther } from 'viem';
import { NO_VALUE } from '@/lib/constants';
import { resolveBridgeRoute } from '../model/resolveRoute';
import type { BridgeNetworkId } from '../model/networks';
import type { BridgeRoute } from '../model/types';
import { bridgeFootnote } from './BridgeReviewContent';
import { buildBridgeModalRows, formatEta, formatMaxEthFee } from './bridgeModalRows';

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const routeFor = (from: BridgeNetworkId, to: BridgeNetworkId): BridgeRoute => {
  const result = resolveBridgeRoute({ from, to, amount: 1n, facts: {} });
  if (result.status !== 'ok') throw new Error(result.reason);
  return result.route;
};

describe('buildBridgeModalRows', () => {
  it('pins the Figma grid: three rows of two cells', () => {
    const rows = buildBridgeModalRows({ route: routeFor('base', 'ethereum'), networkFee: '$0.10' });
    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Bridge type', 'Bridge rate'],
      ['Estimated arrival', 'Slippage'],
      ['Bridge fee', 'Network fee']
    ]);
  });

  // A continued swap bridges its USDC (Figma 91): the rate reads USDC to USDS.
  it('rates the token the bridge sends against the USDS it delivers', () => {
    const [[, rate]] = buildBridgeModalRows({
      route: routeFor('base', 'ethereum'),
      networkFee: '',
      fromToken: 'USDC'
    });
    expect(rate).toMatchObject({ token: 'USDC', left: '1.00', right: '1.00', rightToken: 'USDS' });
    const [[, usds]] = buildBridgeModalRows({ route: routeFor('base', 'ethereum'), networkFee: '' });
    expect(usds).toMatchObject({ token: 'USDS', rightToken: 'USDS' });
  });

  it('names the route and its arrival time', () => {
    const [[type], [eta]] = buildBridgeModalRows({ route: routeFor('ethereum', 'base'), networkFee: '' });
    expect(type).toMatchObject({ value: 'Native' });
    expect(eta).toMatchObject({ value: '~3 min' });
  });

  it("draws Circle's logo before CCTP only (Figma 3830:67688)", () => {
    const [[cctp]] = buildBridgeModalRows({ route: routeFor('base', 'ethereum'), networkFee: '' });
    expect(cctp).toMatchObject({ value: 'CCTP', logo: 'cctp' });
    const [[native]] = buildBridgeModalRows({ route: routeFor('ethereum', 'base'), networkFee: '' });
    expect(native).not.toHaveProperty('logo');
  });

  it('shows no bridge fee until the route quotes one', () => {
    const [, , [fee]] = buildBridgeModalRows({ route: routeFor('ethereum', 'avalanche'), networkFee: '' });
    expect(fee).toMatchObject({ value: NO_VALUE });
  });

  it("shows a deposit's ETH fee as its most, with no exponent for tiny amounts", () => {
    const route = routeFor('ethereum', 'arbitrum');
    const [, , [fee]] = buildBridgeModalRows({
      route,
      networkFee: '',
      bridgeFee: formatMaxEthFee(4_784_940_682_440n)
    });
    expect(fee).toMatchObject({ value: 'Up to 0.0000048 ETH' });
    expect(formatMaxEthFee(480_000_000_000n)).toBe('Up to 0.00000048 ETH');
    expect(formatMaxEthFee(12_345_000_000_000_000n)).toBe('Up to 0.013 ETH');
  });
});

// The ticket's ETH is a ceiling: the copy must never show less than the deposit sends.
describe('formatMaxEthFee never shows less than the maximum', () => {
  const shownWei = (copy: string): bigint => {
    const match = copy.match(/^Up to ([\d.,]+) ETH$/);
    if (!match) throw new Error(`unexpected copy: ${copy}`);
    return parseEther(match[1].replace(/,/g, ''));
  };

  it.each([4_440_000_000_000n, 4_449_999_999_999n, 12_449_000_000_000_000n, 1_049_000_000_000_000n])(
    '%s wei',
    wei => {
      const copy = formatMaxEthFee(wei);
      expect(shownWei(copy), copy).toBeGreaterThanOrEqual(wei);
    }
  );
});

describe('formatEta', () => {
  it('switches to hours past 60 minutes', () => {
    expect(formatEta(20)).toBe('~20 min');
    expect(formatEta(60)).toBe('~1 hr');
    expect(formatEta(90)).toBe('~1 hr 30 min');
  });

  it('switches to days for multi-day withdrawals', () => {
    expect(formatEta(7 * 24 * 60)).toBe('~7 days');
    expect(formatEta(Math.round(6.4 * 24 * 60))).toBe('~6.4 days');
  });
});

describe('arrival copy in the singular and plural', () => {
  const DAY = 24 * 60;
  afterEach(() => vi.restoreAllMocks());

  it('says one day and many days', () => {
    expect(formatEta(DAY)).toBe('~1 day');
    expect(formatEta(2 * DAY)).toBe('~2 days');
  });

  it('the review footnote says one minute, many minutes, one day and many days', () => {
    const route = routeFor('base', 'ethereum');
    const eta = (etaMinutes: number) => bridgeFootnote({ ...route, etaMinutes });
    expect(eta(1)).toContain('approximately 1 minute.');
    expect(eta(20)).toContain('approximately 20 minutes.');
    expect(eta(DAY)).toContain('approximately 1 day.');
    expect(eta(7 * DAY)).toContain('approximately 7 days.');
  });

  it('the review footnote uses the grid units: hours past an hour', () => {
    const route = routeFor('base', 'ethereum');
    const eta = (etaMinutes: number) => bridgeFootnote({ ...route, etaMinutes });
    expect(formatEta(60)).toBe('~1 hr');
    expect(eta(60)).toContain('approximately 1 hour.');
    expect(formatEta(90)).toBe('~1 hr 30 min');
    expect(eta(90)).toContain('approximately 1 hour 30 minutes.');
    expect(eta(121)).toContain('approximately 2 hours 1 minute.');
  });

  it('reads the grid labels from the active catalog at call time', () => {
    vi.spyOn(i18n, '_').mockImplementation(
      ((descriptor: { message?: string }) => `<${descriptor.message}>`) as never
    );
    const rows = buildBridgeModalRows({ route: routeFor('ethereum', 'base'), networkFee: '' });
    expect(
      rows
        .flat()
        .map(cell => cell.label)
        .slice(0, 5)
    ).toEqual(
      ['Bridge type', 'Bridge rate', 'Estimated arrival', 'Slippage', 'Bridge fee'].map(l => `<${l}>`)
    );
    expect(rows[0][0]).toMatchObject({ value: '<Native>' });
  });
});
