import { describe, expect, it } from 'vitest';
import type { MerklClaimRaw, MerklUserRewardRaw } from '../../../hooks/morpho/merklEarnedClient';
import { attributedRewardTokenAddresses, computeMerklEarnings } from './computeMerklEarnings';
import baLabsHistoricFixture from './baLabsUsdsHistoric.golden.fixtures.json';
import claimsFixture from './merklClaims.golden.fixtures.json';
import rewardsFixture from './merklUserRewards.golden.fixtures.json';

const FLAGSHIP = '0xE15fcC81118895b67b6647BBd393182dF44E11E0';
const USDS = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';

// ---------------------------------------------------------------------------
// Golden ground truth (reference wallet, captured 2026-08-19). All wei values
// are exact fixture strings; the splits were hand-verified against the fixture
// breakdowns (reason contains the Flagship address / equals 'usds-flagship-ssr').
// ---------------------------------------------------------------------------
const TOTAL_WEI = 8456476888702806112973n; // rewards fixture: USDS reward.amount
const CLAIMED_WEI = 8446886856555209102563n; // rewards fixture: USDS reward.claimed
const FLAGSHIP_WEI = 8331051812176134465006n; // Σ breakdown.amount, vault-attributed
const SSR_WEI = 125425076526671647967n; // breakdown.amount, reason 'usds-flagship-ssr'

const GOLDEN_TOTAL_NATIVE = Number(TOTAL_WEI) / 1e18; // 8456.476889 USDS
const GOLDEN_CLAIMED_NATIVE = Number(CLAIMED_WEI) / 1e18;
const GOLDEN_UNCLAIMED_NATIVE = Number(TOTAL_WEI - CLAIMED_WEI) / 1e18; // ~9.59 USDS

// All 40 USDS claims in the fixture happened on 2026-08-14; BA Labs fixture
// prices that day at 0.9998. The unclaimed remainder is valued at the token's
// current price from the rewards fixture.
const PRICE_AT_CLAIM_DAY = 0.9998;
const CURRENT_PRICE = 0.9999585494238978;
const GOLDEN_TOTAL_USD = GOLDEN_CLAIMED_NATIVE * PRICE_AT_CLAIM_DAY + GOLDEN_UNCLAIMED_NATIVE * CURRENT_PRICE;

const goldenRewards = rewardsFixture[0].rewards as unknown as MerklUserRewardRaw[];
const goldenClaims = claimsFixture as unknown as MerklClaimRaw[];
const goldenPrices = new Map<string, Map<string, number>>([
  [USDS.toLowerCase(), new Map(baLabsHistoricFixture.results.map(({ date, price }) => [date, Number(price)]))]
]);

const goldenInput = {
  rewards: goldenRewards,
  claims: goldenClaims,
  historicPricesByToken: goldenPrices,
  // Lowercased on purpose: attribution must be case-insensitive.
  flagshipVaultAddress: FLAGSHIP.toLowerCase()
};

// Synthetic builders for edge-case tests ($ amounts chosen for visible arithmetic).
const wei = (value: number): string => (BigInt(Math.round(value * 100)) * 10n ** 16n).toString();

const reward = (overrides: Partial<MerklUserRewardRaw> = {}): MerklUserRewardRaw => ({
  root: '0xroot',
  recipient: '0xme',
  amount: wei(100),
  claimed: wei(60),
  pending: wei(5),
  token: {
    address: '0xAAA0000000000000000000000000000000000001',
    chainId: 1,
    symbol: 'TKA',
    decimals: 18,
    price: 2
  },
  breakdowns: [
    { reason: `ERC20_${FLAGSHIP}`, amount: wei(100), claimed: wei(60), pending: wei(5), campaignId: '0x1' }
  ],
  ...overrides
});

const claim = (overrides: Partial<MerklClaimRaw> = {}): MerklClaimRaw => ({
  id: '1-0x1',
  chainId: 1,
  timestamp: Date.UTC(2026, 7, 10) / 1000, // 2026-08-10 00:00 UTC
  token: '0xAAA0000000000000000000000000000000000001',
  reason: `ERC20_${FLAGSHIP}`,
  amount: wei(60),
  ...overrides
});

const pricesFor = (tokenAddress: string, days: Record<string, number>): Map<string, Map<string, number>> =>
  new Map([[tokenAddress.toLowerCase(), new Map(Object.entries(days))]]);

describe('computeMerklEarnings', () => {
  describe('golden reference wallet fixture', () => {
    const result = computeMerklEarnings(goldenInput);

    it('fixture sanity: the hand-verified attribution split reconciles to the wei', () => {
      expect(FLAGSHIP_WEI + SSR_WEI).toBe(TOTAL_WEI);
      const usdsReward = goldenRewards.find(r => r.token.symbol === 'USDS')!;
      expect(BigInt(usdsReward.amount)).toBe(TOTAL_WEI);
      expect(BigInt(usdsReward.claimed)).toBe(CLAIMED_WEI);
    });

    it('total earned native reproduces the attributed reward amount exactly', () => {
      expect(result.totalEarned.status).toBe('ok');
      if (result.totalEarned.status !== 'ok') return;
      expect(result.totalEarned.value.native).toBeDefined();
      expect(result.totalEarned.value.native!.symbol).toBe('USDS');
      expect(result.totalEarned.value.native!.amount).toBe(GOLDEN_TOTAL_NATIVE);
    });

    it('total earned USD = Σ(claims × price at claim day) + unclaimed × current price', () => {
      if (result.totalEarned.status !== 'ok') throw new Error('expected ok');
      expect(result.totalEarned.value.usd).toBeCloseTo(GOLDEN_TOTAL_USD, 6);
    });

    it('the other 8 reward tokens (MORPHO, GHO, Aave…) do not leak into the figure', () => {
      if (result.totalEarned.status !== 'ok') throw new Error('expected ok');
      // A single-token figure: native set, no byToken — everything else was filtered out.
      expect(result.totalEarned.value.byToken).toBeUndefined();
      expect(result.totalEarned.value.native!.amount).toBeLessThan(8457);
    });

    it('earned this month is the announced Merkl gap', () => {
      expect(result.earnedThisMonth).toEqual({
        status: 'notAvailable',
        reason: 'merkl-monthly-unsupported'
      });
    });
  });

  describe('valuation', () => {
    it('values claims at claim-day price and the unclaimed remainder at current price', () => {
      // earned = 100 + 5 pending = 105; claimed 60 on a day priced 0.5; unclaimed 45 at current price 2.
      const result = computeMerklEarnings({
        rewards: [reward()],
        claims: [claim()],
        historicPricesByToken: pricesFor('0xAAA0000000000000000000000000000000000001', {
          '2026-08-10': 0.5
        }),
        flagshipVaultAddress: FLAGSHIP
      });

      if (result.totalEarned.status !== 'ok') throw new Error('expected ok');
      expect(result.totalEarned.value.native).toEqual({ amount: 105, symbol: 'TKA' });
      expect(result.totalEarned.value.usd).toBeCloseTo(60 * 0.5 + 45 * 2, 10);
    });

    it('uses the nearest previous day when the claim day itself has no price', () => {
      const result = computeMerklEarnings({
        rewards: [reward()],
        claims: [claim({ timestamp: Date.UTC(2026, 7, 12) / 1000 })], // 2026-08-12
        historicPricesByToken: pricesFor('0xAAA0000000000000000000000000000000000001', {
          '2026-08-09': 0.4,
          '2026-08-10': 0.5 // nearest ≤ 2026-08-12
        }),
        flagshipVaultAddress: FLAGSHIP
      });

      if (result.totalEarned.status !== 'ok') throw new Error('expected ok');
      expect(result.totalEarned.value.usd).toBeCloseTo(60 * 0.5 + 45 * 2, 10);
    });

    it('degrades to reconciliation-failed when no price at or before a claim day exists', () => {
      const result = computeMerklEarnings({
        rewards: [reward()],
        claims: [claim()],
        historicPricesByToken: pricesFor('0xAAA0000000000000000000000000000000000001', {
          '2026-08-11': 0.5 // only AFTER the claim day
        }),
        flagshipVaultAddress: FLAGSHIP
      });

      expect(result.totalEarned).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
    });

    it('degrades when the claim events do not add up to the claimed amount (missing rows)', () => {
      const result = computeMerklEarnings({
        rewards: [reward()], // claims say 60...
        claims: [claim({ amount: wei(40) })], // ...but only 40 shows up
        historicPricesByToken: pricesFor('0xAAA0000000000000000000000000000000000001', {
          '2026-08-10': 0.5
        }),
        flagshipVaultAddress: FLAGSHIP
      });

      expect(result.totalEarned).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
    });
  });

  describe('attribution', () => {
    it('ignores rewards whose breakdowns have nothing to do with the Flagship vault', () => {
      const foreign = reward({
        breakdowns: [
          {
            reason: 'ERC20_0xBBB0000000000000000000000000000000000002',
            amount: wei(100),
            claimed: wei(60),
            pending: wei(5),
            campaignId: '0x1'
          }
        ]
      });
      const result = computeMerklEarnings({
        rewards: [foreign],
        claims: [],
        historicPricesByToken: new Map(),
        flagshipVaultAddress: FLAGSHIP
      });

      expect(result.totalEarned).toEqual({ status: 'ok', value: { usd: 0 } });
      expect(result.earnedThisMonth).toEqual({ status: 'ok', value: { usd: 0 } });
    });

    it('attributes only the Flagship slice of a mixed reward token', () => {
      // 100 flagship + 900 elsewhere, nothing claimed: earned = 100, valued at current price 2.
      const mixed = reward({
        amount: wei(1000),
        claimed: wei(0),
        pending: wei(0),
        breakdowns: [
          {
            reason: `ERC20_${FLAGSHIP}`,
            amount: wei(100),
            claimed: wei(0),
            pending: wei(0),
            campaignId: '0x1'
          },
          {
            reason: 'ERC20_0xBBB0000000000000000000000000000000000002',
            amount: wei(900),
            claimed: wei(0),
            pending: wei(0),
            campaignId: '0x2'
          }
        ]
      });
      const result = computeMerklEarnings({
        rewards: [mixed],
        claims: [],
        historicPricesByToken: new Map(),
        flagshipVaultAddress: FLAGSHIP
      });

      if (result.totalEarned.status !== 'ok') throw new Error('expected ok');
      expect(result.totalEarned.value.native).toEqual({ amount: 100, symbol: 'TKA' });
      expect(result.totalEarned.value.usd).toBeCloseTo(100 * 2, 10);
    });

    it('matches the vault address case-insensitively inside composite reasons', () => {
      const composite = reward({
        claimed: wei(0),
        pending: wei(0),
        amount: wei(100),
        breakdowns: [
          {
            reason: `ERC20_${USDS}~123_MorphoVaultV2_ERC20_${FLAGSHIP.toUpperCase().replace('0X', '0x')}`,
            amount: wei(100),
            claimed: wei(0),
            pending: wei(0),
            campaignId: '0x1'
          }
        ]
      });
      const result = computeMerklEarnings({
        rewards: [composite],
        claims: [],
        historicPricesByToken: new Map(),
        flagshipVaultAddress: FLAGSHIP.toLowerCase()
      });

      if (result.totalEarned.status !== 'ok') throw new Error('expected ok');
      expect(result.totalEarned.value.native!.amount).toBe(100);
    });

    it('reports several attributed reward tokens as a byToken breakdown', () => {
      const tokenB = reward({
        token: {
          address: '0xCCC0000000000000000000000000000000000003',
          chainId: 1,
          symbol: 'TKB',
          decimals: 18,
          price: 10
        },
        amount: wei(7),
        claimed: wei(0),
        pending: wei(0),
        breakdowns: [
          { reason: `ERC20_${FLAGSHIP}`, amount: wei(7), claimed: wei(0), pending: wei(0), campaignId: '0x3' }
        ]
      });
      const tokenA = reward({
        claimed: wei(0),
        pending: wei(0),
        amount: wei(100),
        breakdowns: [
          {
            reason: `ERC20_${FLAGSHIP}`,
            amount: wei(100),
            claimed: wei(0),
            pending: wei(0),
            campaignId: '0x1'
          }
        ]
      });

      const result = computeMerklEarnings({
        rewards: [tokenA, tokenB],
        claims: [],
        historicPricesByToken: new Map(),
        flagshipVaultAddress: FLAGSHIP
      });

      if (result.totalEarned.status !== 'ok') throw new Error('expected ok');
      expect(result.totalEarned.value.native).toBeUndefined();
      expect(result.totalEarned.value.byToken).toEqual([
        { amount: 100, symbol: 'TKA' },
        { amount: 7, symbol: 'TKB' }
      ]);
      expect(result.totalEarned.value.usd).toBeCloseTo(100 * 2 + 7 * 10, 10);
    });
  });

  describe('empty states', () => {
    it('a wallet with no Merkl rewards at all earned zero (both figures ok, not gaps)', () => {
      const result = computeMerklEarnings({
        rewards: [],
        claims: [],
        historicPricesByToken: new Map(),
        flagshipVaultAddress: FLAGSHIP
      });

      expect(result.totalEarned).toEqual({ status: 'ok', value: { usd: 0 } });
      expect(result.earnedThisMonth).toEqual({ status: 'ok', value: { usd: 0 } });
    });
  });

  describe('attributedRewardTokenAddresses', () => {
    it('finds exactly the USDS reward token in the golden fixture (9 reward tokens, 1 attributed)', () => {
      // Ground truth: USDS mainnet token address; the other 8 fixture rewards
      // (MORPHO, GHO, aEthRLUSD, …) have no Flagship-attributed breakdown.
      expect(attributedRewardTokenAddresses(goldenRewards, FLAGSHIP)).toEqual([
        '0xdc035d45d973e3ec169d2276ddab16f1e407384f'
      ]);
    });

    it('counts airdrop-name attributions and dedupes per token', () => {
      const airdropOnly = reward({
        breakdowns: [
          {
            reason: 'usds-flagship-ssr',
            amount: wei(1),
            claimed: wei(0),
            pending: wei(0),
            campaignId: '0x2'
          },
          {
            reason: `ERC20_${FLAGSHIP}`,
            amount: wei(2),
            claimed: wei(0),
            pending: wei(0),
            campaignId: '0x3'
          }
        ]
      });
      expect(attributedRewardTokenAddresses([airdropOnly], FLAGSHIP)).toEqual([
        '0xaaa0000000000000000000000000000000000001'
      ]);
    });

    it('returns [] when no breakdown is attributed', () => {
      const other = reward({
        breakdowns: [
          {
            reason: 'ERC20_0xSomeOtherVault',
            amount: wei(1),
            claimed: wei(0),
            pending: wei(0),
            campaignId: '0x4'
          }
        ]
      });
      expect(attributedRewardTokenAddresses([other], FLAGSHIP)).toEqual([]);
    });
  });
});
