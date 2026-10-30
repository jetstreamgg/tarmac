import { i18n } from '@lingui/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { NO_VALUE } from '@/lib/constants';
import { cctpWithdrawalRoute, nativeWithdrawalRoute } from '../model/resolveRoute';
import { buildRouteOptionCard, routeFallbackNotice } from './bridgeRouteOptions';

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const values = (card: ReturnType<typeof buildRouteOptionCard>) =>
  Object.fromEntries(card.rows.map(row => [row.label, row.value]));

describe('buildRouteOptionCard', () => {
  it('draws CCTP as the fastest route, claimed by hand on Ethereum', () => {
    const card = buildRouteOptionCard({
      option: { route: cctpWithdrawalRoute('base') },
      networkFee: '$0.02',
      approvals: 4
    });
    expect(card).toMatchObject({ kind: 'cctp', name: 'CCTP', logo: 'cctp', unavailable: false });
    expect(card.badge).toEqual({ text: 'Fastest', tone: 'accent' });
    expect(card.description).toBe(
      'Swapped 1:1 to USDC and sent to Ethereum with Circle CCTP. Claim it there in about 20 minutes, then convert it back to USDS.'
    );
    expect(values(card)).toEqual({
      'Arrives in': '~20 min',
      Claim: 'Manual',
      Approvals: '4',
      'Bridge fee': '$0.00',
      'Network fee': '$0.02'
    });
  });

  it("draws SkyLink with the network's days and its two Ethereum steps on the OP Stack", () => {
    const card = buildRouteOptionCard({
      option: { route: nativeWithdrawalRoute('optimism') },
      networkFee: '~$3.10',
      approvals: 4
    });
    expect(card).toMatchObject({ kind: 'native', name: 'SkyLink', logo: 'skylink', unavailable: false });
    expect(card.badge).toEqual({ text: 'Native', tone: 'muted' });
    expect(card.description).toBe(
      "Sky's native bridge, so your USDS stays USDS the whole way. Withdrawals to Ethereum take about 7 days and need two more transactions on Ethereum."
    );
    expect(values(card)).toMatchObject({ 'Arrives in': '~7 days', Claim: 'Manual', Approvals: '4' });
  });

  it('says an Arbitrum withdrawal needs one more transaction on Ethereum', () => {
    const card = buildRouteOptionCard({
      option: { route: nativeWithdrawalRoute('arbitrum') },
      networkFee: NO_VALUE,
      approvals: 3
    });
    expect(card.description).toContain('take about 6.5 days and need one more transaction on Ethereum.');
    expect(values(card)['Arrives in']).toBe('~6.5 days');
  });

  it('shows a dash for approvals and fees not read yet', () => {
    const card = buildRouteOptionCard({
      option: { route: nativeWithdrawalRoute('base') },
      networkFee: NO_VALUE,
      approvals: undefined
    });
    expect(values(card)).toMatchObject({ Approvals: NO_VALUE, 'Network fee': NO_VALUE });
  });

  it.each([
    ['no-liquidity', 'Insufficient liquidity'],
    ['closed', 'Unavailable'],
    ['over-limit', 'Above the limit'],
    ['facts-error', 'Unavailable'],
    ['facts-loading', 'Checking']
  ] as const)('greys an option that is %s and says why in its badge', (reason, text) => {
    const card = buildRouteOptionCard({
      option: { route: cctpWithdrawalRoute('base'), unavailable: reason },
      networkFee: NO_VALUE,
      approvals: undefined
    });
    expect(card.unavailable).toBe(true);
    expect(card.badge).toEqual({ text, tone: 'muted' });
  });
});

describe('routeFallbackNotice', () => {
  it("says CCTP couldn't be checked, without blaming CCTP", () => {
    expect(routeFallbackNotice(nativeWithdrawalRoute('base', 'facts-error'))).toEqual({
      title: 'CCTP route unavailable',
      description: "We couldn't check CCTP right now. We switched you to SkyLink, which takes about 5 days."
    });
  });

  it('says why CCTP is out and how long SkyLink takes, per reason', () => {
    expect(routeFallbackNotice(nativeWithdrawalRoute('base', 'no-liquidity'))).toEqual({
      title: 'CCTP route unavailable',
      description:
        'Not enough USDC liquidity on Base for CCTP. We switched you to SkyLink, which takes about 5 days. Confirm to continue or try again later.'
    });
    expect(routeFallbackNotice(nativeWithdrawalRoute('optimism', 'closed'))?.description).toBe(
      'CCTP is closed on OP Mainnet right now. We switched you to SkyLink, which takes about 7 days. Confirm to continue or try again later.'
    );
    expect(routeFallbackNotice(nativeWithdrawalRoute('arbitrum', 'over-limit'))?.description).toBe(
      "This amount is above CCTP's limit on Arbitrum One. We switched you to SkyLink, which takes about 6.5 days. Confirm to continue or try again later."
    );
  });

  it('says nothing when no route was replaced', () => {
    expect(routeFallbackNotice(nativeWithdrawalRoute('base'))).toBeUndefined();
    expect(routeFallbackNotice(cctpWithdrawalRoute('base'))).toBeUndefined();
  });
});
