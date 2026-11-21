import { i18n } from '@lingui/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PendingBridge } from '../model/types';
import { buildPendingBridgeRows, formatBridgeDate } from './pendingBridgeRows';

// Tokyo is UTC+9 all year, so a UTC clock and the user's clock never agree.
beforeAll(() => {
  vi.stubEnv('TZ', 'Asia/Tokyo');
  return i18n.loadAndActivate({ locale: 'en', messages: {} });
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const bridge: PendingBridge = {
  id: '0xabc',
  account: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
  amount: 10n ** 18n,
  token: 'USDS',
  from: 'ethereum',
  to: 'base',
  status: 'pending',
  routeKind: 'native',
  requiresClaim: false,
  txHash: '0x' + 'ab'.repeat(32),
  startedAt: 0,
  etaAt: 0,
  actions: []
};

const arrival = (now: number, etaAt: number) =>
  buildPendingBridgeRows({ ...bridge, startedAt: now, etaAt }, now, 1)[1][1];

describe('bridge times read in the user time zone', () => {
  it('dates the card in local time, with no UTC tag', () => {
    expect(formatBridgeDate(Date.UTC(2026, 9, 25, 15, 26))).toBe('26/10/26 00:26');
  });

  it('shows a same-day arrival as a local clock time, rounded up to the minute', () => {
    const now = Date.UTC(2026, 9, 25, 1, 0);
    expect(arrival(now, Date.UTC(2026, 9, 25, 1, 45, 10))).toMatchObject({ value: '10:46' });
  });

  it('dates an arrival that falls on the next local day, though the same UTC day', () => {
    const now = Date.UTC(2026, 9, 25, 14, 0);
    expect(arrival(now, Date.UTC(2026, 9, 25, 15, 46))).toMatchObject({ value: '26/10/26 00:46' });
  });

  it('shows only the clock for an arrival on the same local day, though the next UTC day', () => {
    const now = Date.UTC(2026, 9, 25, 16, 0);
    expect(arrival(now, Date.UTC(2026, 9, 26, 1, 0))).toMatchObject({ value: '10:00' });
  });
});
