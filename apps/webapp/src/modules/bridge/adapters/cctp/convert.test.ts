import { describe, expect, it, vi } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  parseUnits,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  zeroAddress,
  type Address,
  type Hex
} from 'viem';
import {
  applyProgress,
  createPendingBridge,
  recordAction,
  recordActionSent,
  recordNextLeg
} from '../../model/pendingTransitions';
import { resolveBridgeRoute } from '../../model/resolveRoute';
import { SENT_ACTION_DROPPED_MS } from '../sentAction';
import type { PendingBridge } from '../../model/types';
import { L1_USDC, L1_USDS } from './contracts';
import {
  cctpConvertOffer,
  claimSoldForUsds,
  confirmedClaimTxHash,
  readCctpConvertOffer,
  type ConvertOfferReader
} from './convert';

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

// The offer read afresh when a claim's Try again hands over to the convert: the same rule as the card.
describe('readCctpConvertOffer', () => {
  const reader = ({
    receipts,
    usdc
  }: {
    receipts: Record<string, { status: 'success' | 'reverted'; logs: ReturnType<typeof transfer>[] }>;
    usdc: bigint;
  }): ConvertOfferReader => ({
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => receipts[hash]) as never,
    readContract: vi.fn(async ({ address, args }: { address: Address; args: readonly [Address] }) => {
      if (address !== L1_USDC || args[0] !== ACCOUNT) throw new Error('unexpected read');
      return usdc;
    }) as never
  });

  it('offers what the claim minted, capped by the USDC the account holds', async () => {
    const receipts = { '0xclaim': { status: 'success' as const, logs: [] } };
    await expect(
      readCctpConvertOffer({
        client: reader({ receipts, usdc: USDC('60') }),
        bridge: claimed(),
        account: ACCOUNT
      })
    ).resolves.toBe(USDC('60'));
    await expect(
      readCctpConvertOffer({
        client: reader({ receipts, usdc: USDC('250') }),
        bridge: claimed(),
        account: ACCOUNT
      })
    ).resolves.toBe(USDC('100'));
  });

  it('offers nothing when a transaction of the claim sold the USDC', async () => {
    const sold = recordAction(claimed(), { action: 'claim', txHash: '0xsale', at: NOW });
    const receipts = {
      '0xclaim': { status: 'success' as const, logs: [] },
      '0xsale': {
        status: 'success' as const,
        logs: [transfer(L1_USDS, zeroAddress, ACCOUNT, parseUnits('100', 18))]
      }
    };
    await expect(
      readCctpConvertOffer({
        client: reader({ receipts, usdc: USDC('500') }),
        bridge: sold,
        account: ACCOUNT
      })
    ).resolves.toBeUndefined();
  });

  it('offers nothing for a reverted claim, to another account, or with no USDC', async () => {
    const ok = { '0xclaim': { status: 'success' as const, logs: [] } };
    const reverted = { '0xclaim': { status: 'reverted' as const, logs: [] } };
    await expect(
      readCctpConvertOffer({
        client: reader({ receipts: reverted, usdc: USDC('100') }),
        bridge: claimed(),
        account: ACCOUNT
      })
    ).resolves.toBeUndefined();
    await expect(
      readCctpConvertOffer({
        client: reader({ receipts: ok, usdc: USDC('100') }),
        bridge: claimed(),
        account: OTHER
      })
    ).resolves.toBeUndefined();
    await expect(
      readCctpConvertOffer({
        client: reader({ receipts: ok, usdc: 0n }),
        bridge: claimed(),
        account: ACCOUNT
      })
    ).resolves.toBeUndefined();
  });

  it('fails when a read fails, so nothing is converted on a guess', async () => {
    const client: ConvertOfferReader = {
      getTransactionReceipt: vi.fn(async () => {
        throw new Error('rpc down');
      }) as never,
      readContract: vi.fn(async () => USDC('100')) as never
    };
    await expect(readCctpConvertOffer({ client, bridge: claimed(), account: ACCOUNT })).rejects.toThrow(
      'rpc down'
    );
  });
});

describe('readCctpConvertOffer, a sale the claim run sent after the claim mined', () => {
  const selling = () => recordNextLeg(claimed(), 'claim', '0xsale', NOW);
  const reader = (
    sale: { status: 'success' | 'reverted'; logs: ReturnType<typeof transfer>[] } | undefined
  ) =>
    ({
      getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
        if (hash === '0xclaim') return { status: 'success', logs: [] };
        if (hash === '0xsale' && sale) return sale;
        throw new Error('Transaction receipt could not be found.');
      }) as never,
      readContract: vi.fn(async () => USDC('500')) as never
    }) satisfies ConvertOfferReader;

  it('offers nothing while that sale is not mined', async () => {
    await expect(
      readCctpConvertOffer({ client: reader(undefined), bridge: selling(), account: ACCOUNT })
    ).rejects.toThrow();
  });

  it('offers nothing once that sale sold the USDC', async () => {
    const sold = {
      status: 'success' as const,
      logs: [transfer(L1_USDS, zeroAddress, ACCOUNT, parseUnits('100', 18))]
    };
    await expect(
      readCctpConvertOffer({ client: reader(sold), bridge: selling(), account: ACCOUNT })
    ).resolves.toBeUndefined();
  });

  it('offers the USDC when that sale reverted, as it sold nothing', async () => {
    await expect(
      readCctpConvertOffer({
        client: reader({ status: 'reverted', logs: [] }),
        bridge: selling(),
        account: ACCOUNT
      })
    ).resolves.toBe(USDC('100'));
  });
});

describe('readCctpConvertOffer, a sale the claim run sent that never mined', () => {
  const SENT = NOW + 60_000;
  const selling = () => recordNextLeg(claimed(), 'claim', '0xsale', SENT);
  const reader = ({ pending }: { pending: boolean }) =>
    ({
      getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
        if (hash === '0xclaim') return { status: 'success', logs: [] };
        throw new TransactionReceiptNotFoundError({ hash });
      }) as never,
      getTransaction: vi.fn(async ({ hash }: { hash: Hex }) => {
        if (pending) return { hash };
        throw new TransactionNotFoundError({ hash });
      }) as never,
      readContract: vi.fn(async () => USDC('500')) as never
    }) satisfies ConvertOfferReader;

  it('offers the USDC once the chain still doesn’t know it 15 minutes after it was sent', async () => {
    await expect(
      readCctpConvertOffer({
        client: reader({ pending: false }),
        bridge: selling(),
        account: ACCOUNT,
        now: SENT + SENT_ACTION_DROPPED_MS
      })
    ).resolves.toBe(USDC('100'));
  });

  it('offers nothing before then, as it may still mine', async () => {
    await expect(
      readCctpConvertOffer({
        client: reader({ pending: false }),
        bridge: selling(),
        account: ACCOUNT,
        now: SENT + SENT_ACTION_DROPPED_MS - 1
      })
    ).rejects.toThrow();
  });

  it('offers nothing while the chain holds it pending, however old', async () => {
    await expect(
      readCctpConvertOffer({
        client: reader({ pending: true }),
        bridge: selling(),
        account: ACCOUNT,
        now: SENT + 10 * SENT_ACTION_DROPPED_MS
      })
    ).rejects.toThrow();
  });

  it('times a sale stored before its send time was kept from its claim', async () => {
    const legacy = selling();
    delete legacy.actions[0].nextLegAt;
    const client = reader({ pending: false });
    await expect(
      readCctpConvertOffer({
        client,
        bridge: legacy,
        account: ACCOUNT,
        now: NOW + SENT_ACTION_DROPPED_MS - 1
      })
    ).rejects.toThrow();
    await expect(
      readCctpConvertOffer({ client, bridge: legacy, account: ACCOUNT, now: NOW + SENT_ACTION_DROPPED_MS })
    ).resolves.toBe(USDC('100'));
  });
});
