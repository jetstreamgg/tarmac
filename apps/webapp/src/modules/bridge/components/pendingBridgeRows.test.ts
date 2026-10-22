import { i18n } from '@lingui/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getAddress } from 'viem';
import { NO_VALUE } from '@/lib/constants';
import type { PendingBridge } from '../model/types';
import { chainId } from '@/utils/chainId';
import { getEtherscanLink } from '@/utils/getEtherscanLink';
import {
  bridgeTxHref,
  buildPendingBridgeRows,
  formatBridgeDate,
  formatTimeLeft,
  nextActionLabel,
  pendingBridgeNote,
  SKY_DISCORD_URL
} from './pendingBridgeRows';
import { REDEEM_URGENT_MINUTES } from '../model/pendingTransitions';

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const base: PendingBridge = {
  id: '0xabc',
  account: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
  amount: 10_000n * 10n ** 18n,
  token: 'USDS',
  from: 'ethereum',
  to: 'base',
  status: 'pending',
  routeKind: 'native',
  requiresClaim: false,
  startedAt: 0,
  etaAt: 3 * 60_000,
  txHash: '0xff9s000000000000000000000000000000000000000000000000000000dsa6',
  actions: []
};

describe('buildPendingBridgeRows', () => {
  it('pins the Figma labels and pairing', () => {
    const rows = buildPendingBridgeRows(base, 0, 1);
    expect(rows.map(row => row.map(cell => cell.label))).toEqual([
      ['Source', 'Destination'],
      ['Status', 'Estimated arrival'],
      ['Bridge type', 'Transaction']
    ]);
  });

  it('shows the arrival time while pending and Arrived once landed', () => {
    expect(buildPendingBridgeRows(base, 0, 1)[1][1]).toMatchObject({ value: '00:03 UTC' });
    expect(buildPendingBridgeRows({ ...base, status: 'ready' }, 0, 1)[1][1]).toMatchObject({
      value: 'Arrived'
    });
  });

  it('names the ready action and keeps an unfinished withdrawal out of Arrived', () => {
    const claim = buildPendingBridgeRows({ ...base, status: 'ready', nextAction: 'claim' }, 0, 1)[1];
    expect(claim.map(cell => 'value' in cell && cell.value)).toEqual(['Ready to claim', 'Ready']);
    const prove = buildPendingBridgeRows({ ...base, status: 'ready', nextAction: 'prove' }, 0, 1)[1];
    expect(prove.map(cell => 'value' in cell && cell.value)).toEqual(['Ready to prove', 'Ready']);
    expect(buildPendingBridgeRows({ ...base, status: 'failed' }, 0, 1)[1][1]).toMatchObject({
      value: NO_VALUE
    });
  });

  it('a deposit that needs a redeem or replay has no arrival time, and an expired one never arrives', () => {
    for (const nextAction of ['redeem', 'replay'] as const) {
      const row = buildPendingBridgeRows({ ...base, status: 'ready', nextAction }, 0, 1)[1];
      expect(row.map(cell => 'value' in cell && cell.value)).toEqual(['Action needed', NO_VALUE]);
    }
    const expired = buildPendingBridgeRows({ ...base, status: 'expired' }, 0, 1)[1];
    expect(expired.map(cell => 'value' in cell && cell.value)).toEqual(['Expired', NO_VALUE]);
    expect(nextActionLabel('redeem')).toBe('Redeem');
    expect(nextActionLabel('replay')).toBe('Replay');
  });

  it('shows a queued Safe transaction as awaiting signatures', () => {
    const queued = { ...base, txHash: undefined, safeTxHash: '0xsafe' };
    expect(buildPendingBridgeRows(queued, 0, 1)[2][1]).toMatchObject({
      label: 'Transaction',
      value: 'Awaiting signatures'
    });
  });

  it('links a queued Safe transaction to the Safe queue, only on chains the Safe app serves', () => {
    const queued = { ...base, from: 'base' as const, txHash: undefined, safeTxHash: '0x5afe' };
    const tx = buildPendingBridgeRows(queued, 0, 1)[2][1];
    expect(tx.kind === 'link' && tx.href).toBe(
      `https://app.safe.global/transactions/tx?safe=base:${getAddress(base.account)}&id=0x5afe`
    );
    const avalanche = buildPendingBridgeRows({ ...queued, from: 'avalanche' as const }, 0, 1)[2][1];
    expect('href' in avalanche && avalanche.href).toBeFalsy();
  });

  it('shows no arrival time before a queued Safe transaction executes', () => {
    const queued = { ...base, txHash: undefined, safeTxHash: '0xsafe' };
    expect(buildPendingBridgeRows(queued, 0, 1)[1][1]).toMatchObject({ value: NO_VALUE });
  });

  it('does not show a failed Safe bridge as awaiting signatures', () => {
    const failed = { ...base, txHash: undefined, safeTxHash: '0xsafe', status: 'failed' as const };
    expect(buildPendingBridgeRows(failed, 0, 1)[2][1]).toEqual({
      kind: 'text',
      label: 'Transaction',
      value: NO_VALUE
    });
  });

  it('ignores a clock older than the bridge start', () => {
    const late = { ...base, startedAt: 120_000, etaAt: 120_000 + 3 * 60_000 };
    expect(buildPendingBridgeRows(late, 0, 1)[1][1]).toMatchObject({ value: '00:05 UTC' });
  });

  it('says the bridge is taking longer than expected once past its ETA', () => {
    expect(buildPendingBridgeRows(base, base.etaAt, 1)[1][1]).toMatchObject({ value: '00:03 UTC' });
    expect(buildPendingBridgeRows(base, base.etaAt + 60_000, 1)[1][1]).toMatchObject({
      value: 'Taking longer than expected'
    });
  });

  it('shows the arrival as a UTC clock time, rounded up to the minute', () => {
    const now = Date.UTC(2026, 9, 25, 15, 26);
    const at = (etaAt: number) => buildPendingBridgeRows({ ...base, startedAt: now, etaAt }, now, 1)[1][1];
    expect(at(Date.UTC(2026, 9, 25, 15, 46))).toMatchObject({ value: '15:46 UTC' });
    expect(at(Date.UTC(2026, 9, 25, 15, 45, 10))).toMatchObject({ value: '15:46 UTC' });
  });

  it('dates an arrival that falls on a later UTC day', () => {
    const now = Date.UTC(2026, 9, 25, 15, 26);
    const eta = Date.UTC(2026, 9, 29, 15, 46);
    expect(buildPendingBridgeRows({ ...base, startedAt: now, etaAt: eta }, now, 1)[1][1]).toMatchObject({
      value: '29/10/26 15:46 UTC'
    });
  });

  it('truncates the hash like the comp and links the source explorer', () => {
    const tx = buildPendingBridgeRows(base, 0, 1)[2][1];
    expect(tx).toMatchObject({ value: '0xff9s...dsa6' });
    expect(tx.kind === 'link' && tx.href).toContain('etherscan.io/tx/');
  });
});

describe('pending bridge copy', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads labels, statuses and actions from the active catalog at call time', () => {
    vi.spyOn(i18n, '_').mockImplementation(
      ((descriptor: { message?: string }) => `<${descriptor.message}>`) as never
    );
    const ready = buildPendingBridgeRows({ ...base, status: 'ready', nextAction: 'claim' }, 0, 1);
    const queued = buildPendingBridgeRows({ ...base, txHash: undefined, safeTxHash: '0xsafe' }, 0, 1);
    expect(ready.flat().map(cell => cell.label)).toEqual(
      ['Source', 'Destination', 'Status', 'Estimated arrival', 'Bridge type', 'Transaction'].map(
        l => `<${l}>`
      )
    );
    expect(ready[1].map(cell => 'value' in cell && cell.value)).toEqual(['<Ready to claim>', '<Ready>']);
    expect(buildPendingBridgeRows({ ...base, status: 'ready' }, 0, 1)[1][1]).toMatchObject({
      value: '<Arrived>'
    });
    expect(queued[1][0]).toMatchObject({ value: '<Pending>' });
    expect(queued[2].map(cell => 'value' in cell && cell.value)).toEqual([
      '<Native>',
      '<Awaiting signatures>'
    ]);
    expect(nextActionLabel('finalize')).toBe('<Finalize>');
  });
});

describe('formatBridgeDate', () => {
  it('formats as dd/MM/yy HH:mm UTC', () => {
    expect(formatBridgeDate(Date.UTC(2026, 9, 25, 15, 26))).toBe('25/10/26 15:26 UTC');
  });
});

describe('transaction links follow the app chain', () => {
  it('links an Ethereum-side tx to the explorer of the chain the app runs on', () => {
    const tx = buildPendingBridgeRows(base, 0, chainId.tenderly)[2][1];
    expect(tx.kind === 'link' && tx.href).toBe(getEtherscanLink(chainId.tenderly, base.txHash!, 'tx'));
    expect(bridgeTxHref('ethereum', base.txHash!, chainId.tenderly)).toBe(
      getEtherscanLink(chainId.tenderly, base.txHash!, 'tx')
    );
  });

  it('keeps L2 links on the L2 explorer', () => {
    expect(bridgeTxHref('base', '0xabc', chainId.tenderly)).toBe(
      getEtherscanLink(chainId.base, '0xabc', 'tx')
    );
  });
});

describe('pendingBridgeNote (Ethereum to Arbitrum)', () => {
  // The golden deposit: the portal resolves this Ethereum hash to ticket 0xfb3d…903b (checked live).
  const DEPOSIT_TX = '0x7bad421efd4f10f92c69e0563b76192b4302373996796e1a252ecce2458713d4';
  const RETRYABLES = `https://portal.arbitrum.io/build/retryables?chainId=42161&tx=${DEPOSIT_TX}`;
  const TIMEOUT_S = 1_760_000_000;
  const redeem: PendingBridge = {
    ...base,
    to: 'arbitrum',
    status: 'ready',
    nextAction: 'redeem',
    txHash: DEPOSIT_TX,
    routeData: { ticketId: `0x${'1'.repeat(64)}`, timeout: String(TIMEOUT_S) }
  };
  const at = (minutesBefore: number) => TIMEOUT_S * 1000 - minutesBefore * 60_000;

  it("gives the floored time left and the any-wallet link to Arbitrum's retryables tool", () => {
    expect(pendingBridgeNote(redeem, at(6 * 24 * 60 + 4 * 60) - 59_000)).toEqual({
      kind: 'redeem',
      minutesLeft: 6 * 24 * 60 + 4 * 60,
      urgent: false,
      retryablesHref: RETRYABLES
    });
  });

  it('escalates under 48 hours and says time is up once the timeout passed, without expiring the card', () => {
    expect(pendingBridgeNote(redeem, at(REDEEM_URGENT_MINUTES))).toMatchObject({ urgent: false });
    expect(pendingBridgeNote(redeem, at(REDEEM_URGENT_MINUTES - 1))).toMatchObject({ urgent: true });
    expect(pendingBridgeNote(redeem, at(-30))).toMatchObject({ minutesLeft: 0, urgent: true });
  });

  it.each([undefined, '', 'soon', '-1', '1.5', '1e9'])('shows no time left for a timeout of %o', timeout => {
    const note = pendingBridgeNote({ ...redeem, routeData: { ...redeem.routeData, timeout: timeout! } }, 0);
    expect(note).toEqual({
      kind: 'redeem',
      minutesLeft: undefined,
      urgent: false,
      retryablesHref: RETRYABLES
    });
  });

  it('links an expired deposit to the tool and to support', () => {
    expect(pendingBridgeNote({ ...redeem, status: 'expired', nextAction: undefined }, 0)).toEqual({
      kind: 'expired',
      retryablesHref: RETRYABLES,
      supportHref: SKY_DISCORD_URL
    });
  });

  it('is only for an Ethereum to Arbitrum deposit that needs a redeem or expired', () => {
    expect(pendingBridgeNote({ ...redeem, status: 'pending' }, 0)).toBeUndefined();
    expect(pendingBridgeNote({ ...redeem, status: 'arrived', nextAction: undefined }, 0)).toBeUndefined();
    expect(pendingBridgeNote({ ...redeem, to: 'base', nextAction: 'redeem' }, 0)).toBeUndefined();
    expect(pendingBridgeNote({ ...redeem, from: 'arbitrum', to: 'ethereum' }, 0)).toBeUndefined();
    expect(pendingBridgeNote({ ...redeem, routeKind: 'cctp' }, 0)).toBeUndefined();
  });

  it('builds no link without the Ethereum tx', () => {
    expect(pendingBridgeNote({ ...redeem, txHash: undefined }, 0)).toMatchObject({
      retryablesHref: undefined
    });
  });
});

describe('pendingBridgeNote (Ethereum to OP Stack)', () => {
  const replay: PendingBridge = { ...base, to: 'base', status: 'ready', nextAction: 'replay' };

  it.each(['base', 'optimism', 'unichain'] as const)('explains the replay a %s deposit needs', to => {
    expect(pendingBridgeNote({ ...replay, to }, 0)).toEqual({ kind: 'replay', network: to });
  });

  it('is only for a ready replay of a native deposit', () => {
    expect(pendingBridgeNote({ ...replay, status: 'pending', nextAction: undefined }, 0)).toBeUndefined();
    expect(pendingBridgeNote({ ...replay, status: 'arrived', nextAction: undefined }, 0)).toBeUndefined();
    expect(pendingBridgeNote({ ...replay, routeKind: 'cctp' }, 0)).toBeUndefined();
    expect(
      pendingBridgeNote({ ...replay, from: 'base', to: 'ethereum', nextAction: 'claim' }, 0)
    ).toBeUndefined();
  });
});

describe('formatTimeLeft', () => {
  it('floors to the two largest units', () => {
    expect(formatTimeLeft(6 * 24 * 60 + 4 * 60 + 59)).toBe('6 days 4 hours');
    expect(formatTimeLeft(24 * 60)).toBe('1 day');
    expect(formatTimeLeft(5 * 60 + 12)).toBe('5 hours 12 minutes');
    expect(formatTimeLeft(60)).toBe('1 hour');
    expect(formatTimeLeft(1)).toBe('1 minute');
  });
});

describe('buildPendingBridgeRows for a CCTP bridge still to claim', () => {
  // Attested and waiting for the recipient's claim: no USDS has landed on Ethereum yet.
  const readyToClaim: PendingBridge = {
    ...base,
    from: 'base',
    to: 'ethereum',
    status: 'ready',
    nextAction: 'claim',
    routeKind: 'cctp',
    requiresClaim: true,
    etaAt: 20 * 60_000
  };

  it('never reads Arrived before the claim', () => {
    const [, arrival] = buildPendingBridgeRows(readyToClaim, 30 * 60_000, 1)[1];
    expect(arrival).not.toMatchObject({ value: 'Arrived' });
  });
});
