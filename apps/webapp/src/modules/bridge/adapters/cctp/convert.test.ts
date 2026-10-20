import { describe, expect, it } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex
} from 'viem';
import {
  applyProgress,
  createPendingBridge,
  recordAction,
  recordActionSent
} from '../../model/pendingTransitions';
import { resolveBridgeRoute } from '../../model/resolveRoute';
import type { PendingBridge } from '../../model/types';
import { L1_USDC, L1_USDS } from './contracts';
import { cctpConvertOffer, claimSoldForUsds, confirmedClaimTxHash } from './convert';

const NOW = 1_800_000_000_000;
const ACCOUNT = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const OTHER = '0x1111111111111111111111111111111111111111';
const USDC = (amount: string) => parseUnits(amount, 6);

const transfer = (token: Address, from: Address, to: Address, value: bigint) => ({
  address: token,
  topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from, to } }) as [Hex, ...Hex[]],
  data: encodeAbiParameters([{ type: 'uint256' }], [value])
});

const bridge = ({ recipient }: { recipient?: string } = {}) => {
  const result = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: 1n,
    facts: { cctp: { isOpen: true } }
  });
  if (result.status !== 'ok') throw new Error(result.reason);
  return createPendingBridge({
    account: ACCOUNT,
    amount: parseUnits('100', 18),
    from: 'base',
    to: 'ethereum',
    recipient,
    route: result.route,
    txHash: '0xsource',
    now: NOW
  });
};
const claimed = (base = bridge()): PendingBridge =>
  recordAction(applyProgress(base, { kind: 'ready', nextAction: 'claim' }, NOW), {
    action: 'claim',
    txHash: '0xclaim',
    at: NOW
  });

describe('claimSoldForUsds', () => {
  it('a claim that sold its USDC minted USDS to the recipient', () => {
    const logs = [
      transfer(L1_USDC, zeroAddress, ACCOUNT, USDC('100')),
      transfer(L1_USDS, zeroAddress, ACCOUNT, parseUnits('100', 18))
    ];
    expect(claimSoldForUsds(logs, ACCOUNT)).toBe(true);
    expect(claimSoldForUsds(logs, ACCOUNT.toLowerCase())).toBe(true);
  });

  it('a receive alone minted only USDC', () => {
    expect(claimSoldForUsds([transfer(L1_USDC, zeroAddress, ACCOUNT, USDC('100'))], ACCOUNT)).toBe(false);
  });

  it('USDS minted to someone else, or moved rather than minted, is no sale to the recipient', () => {
    expect(claimSoldForUsds([transfer(L1_USDS, zeroAddress, OTHER, 1n)], ACCOUNT)).toBe(false);
    expect(claimSoldForUsds([transfer(L1_USDS, OTHER, ACCOUNT, 1n)], ACCOUNT)).toBe(false);
  });

  it('another token minted to the recipient is no sale', () => {
    expect(claimSoldForUsds([transfer(OTHER, zeroAddress, ACCOUNT, 1n)], ACCOUNT)).toBe(false);
  });
});

describe('confirmedClaimTxHash', () => {
  it('is the hash the claim was confirmed with', () => {
    expect(confirmedClaimTxHash(claimed())).toBe('0xclaim');
  });

  it('none while the claim is only sent, or when someone else claimed it', () => {
    const sent = recordActionSent(applyProgress(bridge(), { kind: 'ready', nextAction: 'claim' }, NOW), {
      action: 'claim',
      txHash: '0xclaim',
      at: NOW
    });
    expect(confirmedClaimTxHash(sent)).toBeUndefined();
    expect(confirmedClaimTxHash(applyProgress(bridge(), { kind: 'arrived' }, NOW))).toBeUndefined();
  });
});

describe('cctpConvertOffer', () => {
  const offer = (change: Partial<Parameters<typeof cctpConvertOffer>[0]> = {}) =>
    cctpConvertOffer({
      bridge: claimed(),
      account: ACCOUNT,
      claimSold: false,
      usdcBalance: USDC('500'),
      ...change
    });

  it('offers the minted USDC to the recipient of a claim that kept it', () => {
    expect(offer()).toBe(USDC('100'));
    expect(offer({ account: ACCOUNT.toLowerCase() })).toBe(USDC('100'));
  });

  it('offers no more than the recipient still holds', () => {
    expect(offer({ usdcBalance: USDC('40') })).toBe(USDC('40'));
  });

  it('offers nothing once the recipient holds no USDC', () => {
    expect(offer({ usdcBalance: 0n })).toBeUndefined();
  });

  it('offers nothing when the claim sold it, or while that is unknown', () => {
    expect(offer({ claimSold: true })).toBeUndefined();
    expect(offer({ claimSold: undefined })).toBeUndefined();
    expect(offer({ usdcBalance: undefined })).toBeUndefined();
  });

  it('offers it only to the recipient', () => {
    expect(offer({ account: undefined })).toBeUndefined();
    expect(offer({ account: OTHER })).toBeUndefined();
    const toOther = claimed(bridge({ recipient: OTHER }));
    expect(offer({ bridge: toOther })).toBeUndefined();
    expect(offer({ bridge: toOther, account: OTHER })).toBe(USDC('100'));
  });

  // The claim's hash is what tells whether it sold, so a claim this app didn't record is never offered.
  it('offers nothing for a transfer someone else claimed', () => {
    expect(offer({ bridge: applyProgress(bridge(), { kind: 'arrived' }, NOW) })).toBeUndefined();
  });

  it('offers nothing before the claim, nor twice', () => {
    expect(
      offer({ bridge: applyProgress(bridge(), { kind: 'ready', nextAction: 'claim' }, NOW) })
    ).toBeUndefined();
    const sent = recordActionSent(claimed(), { action: 'convert', txHash: '0xsell', at: NOW });
    expect(offer({ bridge: sent })).toBeUndefined();
  });
});
