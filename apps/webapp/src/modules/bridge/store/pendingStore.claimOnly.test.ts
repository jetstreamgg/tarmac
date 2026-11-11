import { afterEach, describe, expect, it } from 'vitest';
import { CCTP_CLAIM_ONLY, isCctpClaimOnly } from '../adapters/cctp/calls';
import { applyProgress, recordAction } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';
import { createPendingBridgeStore, pendingScopeKey } from './pendingStore';

const NOW = 1_800_000_000_000;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });

const claimOnly: PendingBridge = {
  id: '0xsource',
  account: ACCOUNT,
  amount: 123456789012345678901234n,
  token: 'USDS',
  from: 'base',
  to: 'ethereum',
  status: 'pending',
  routeKind: 'cctp',
  requiresClaim: true,
  nextAction: 'claim',
  startedAt: NOW,
  etaAt: NOW + 20 * 60_000,
  txHash: '0xsource',
  actions: [],
  routeData: { ...CCTP_CLAIM_ONLY }
};

describe('a claim-only bridge', () => {
  afterEach(() => localStorage.clear());

  it('stays claim-only through a reload, its attested message and its claim', () => {
    createPendingBridgeStore({ now: () => NOW }).upsert(SCOPE, claimOnly);
    const [reloaded] = createPendingBridgeStore({ now: () => NOW }).getSnapshot(SCOPE);
    const ready = applyProgress(
      reloaded,
      { kind: 'ready', nextAction: 'claim', routeData: { cctpMessage: '0x01', cctpAttestation: '0x02' } },
      NOW
    );
    expect(ready.routeData).toEqual({ ...CCTP_CLAIM_ONLY, cctpMessage: '0x01', cctpAttestation: '0x02' });
    const claimed = recordAction(ready, { action: 'claim', txHash: '0xclaim', at: NOW });
    expect(isCctpClaimOnly(claimed.routeData)).toBe(true);
  });

  it('is never read from a bridge the app swapped itself', () => {
    expect(isCctpClaimOnly(undefined)).toBe(false);
    expect(isCctpClaimOnly({ cctpMessage: '0x01', cctpAttestation: '0x02' })).toBe(false);
    expect(isCctpClaimOnly({ cctpClaimOnly: 'false' })).toBe(false);
  });
});
