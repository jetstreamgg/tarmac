import type { Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import type { PendingBridge } from '../../model/types';
import { cctpClaimLink, pendingClaimLink, readCctpClaimLink } from './claimLink';

const HASH = `0x${'ab'.repeat(32)}` as Hex;
const params = (search: string) => new URLSearchParams(search);

describe('cctpClaimLink', () => {
  it("opens the Bridge tab with the burn's network and hash", () => {
    const link = new URL(cctpClaimLink('https://app.example', 'base', HASH));
    expect(link.origin + link.pathname).toBe('https://app.example/convert');
    expect(Object.fromEntries(link.searchParams)).toEqual({
      tab: 'bridge',
      claim_network: 'base',
      claim_tx: HASH
    });
  });
});

describe('readCctpClaimLink', () => {
  it('reads the network and the lower-case hash', () => {
    expect(
      readCctpClaimLink(params(`claim_network=arbitrum&claim_tx=${HASH.toUpperCase().replace('0X', '0x')}`))
    ).toEqual({ from: 'arbitrum', txHash: HASH });
  });

  it.each([
    ['no params', ''],
    ['no hash', 'claim_network=base'],
    ['no network', `claim_tx=${HASH}`],
    ['Ethereum as the source', `claim_network=ethereum&claim_tx=${HASH}`],
    ['a network CCTP does not bridge from here', `claim_network=avalanche&claim_tx=${HASH}`],
    ['an unknown network', `claim_network=nowhere&claim_tx=${HASH}`],
    ['a short hash', 'claim_network=base&claim_tx=0xabcd'],
    ['a hash that is not hex', `claim_network=base&claim_tx=0x${'zz'.repeat(32)}`]
  ])('reads nothing with %s', (_, search) => {
    expect(readCctpClaimLink(params(search))).toBeUndefined();
  });
});

describe('pendingClaimLink', () => {
  const BRIDGE: PendingBridge = {
    id: HASH,
    account: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
    amount: 1n,
    token: 'USDS',
    from: 'optimism',
    to: 'ethereum',
    status: 'pending',
    routeKind: 'cctp',
    requiresClaim: true,
    nextAction: 'claim',
    startedAt: 0,
    etaAt: 0,
    txHash: HASH,
    actions: []
  };

  it('links a CCTP bridge to Ethereum that still has to be claimed, pending or ready', () => {
    for (const status of ['pending', 'ready'] as const)
      expect(pendingClaimLink('https://app.example', { ...BRIDGE, status })).toBe(
        cctpClaimLink('https://app.example', 'optimism', HASH)
      );
  });

  it.each<[string, Partial<PendingBridge>]>([
    ['a native bridge', { routeKind: 'native', from: 'ethereum', to: 'base', nextAction: undefined }],
    ['a claimed bridge', { status: 'claimed', nextAction: 'convert', settledAt: 0 }],
    ['a bridge with nothing left to do', { nextAction: undefined }],
    ['a bridge claimed from another app', { status: 'arrived', settledAt: 0 }],
    ['a bridge with no hash yet', { txHash: undefined, bundleId: '0xbundle' }]
  ])('links nothing for %s', (_, change) => {
    expect(pendingClaimLink('https://app.example', { ...BRIDGE, ...change })).toBeUndefined();
  });
});
