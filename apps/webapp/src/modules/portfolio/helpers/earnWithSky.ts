import type { EarnProductRow, EarnRate, EarnRiskProfileId } from '@/hooks';
import { Intent } from '@/lib/enums';
import { QueryParams } from '@/lib/constants';
import { EARN_OPPORTUNITIES_HASH, ROUTES, intentToPath } from '@/lib/routes';

export type EarnWithSkyProductId = 'savings' | 'vaults' | 'stake';

/** In-app destination of a card's CTA, plus any Earn-list deep-link extras. */
export type EarnWithSkyDestination = {
  path: string;
  search?: Partial<Record<QueryParams, string>>;
  hash?: string;
};

/**
 * One of the three fixed product groups of the Portfolio's "Earn with Sky"
 * section (Figma 2376:225231, APP-531): the live half of a card. The editorial
 * half (icon, title, blurb, CTA label) is keyed by `id` in EarnWithSkyCard.
 */
export type EarnWithSkyProduct = {
  id: EarnWithSkyProductId;
  rate: EarnRate;
  /** `rate` is the best of several products, so the badge reads "up to X%". */
  isBestOf: boolean;
  supplyTokens: string[];
  riskProfile: EarnRiskProfileId;
  to: EarnWithSkyDestination;
  isLoading: boolean;
};

/** The Stake module's live data, resolved by useEarnWithSkyProducts. */
export type StakeSummary = {
  /** Highest stake reward rate. */
  rate: EarnRate;
  isLoading: boolean;
  /** Geo-gated like the marketplace rows: an unavailable module gets no card. */
  isAvailable: boolean;
};

/**
 * Builds the section's cards from the (geo-visible) marketplace rows and the
 * Stake summary, in design order: sUSDS, Vaults, Stake SKY. A group with
 * nothing behind it — the savings row geo-hidden, no vault listed, Stake
 * restricted — is left out rather than rendered empty.
 */
export function buildEarnWithSkyProducts(rows: EarnProductRow[], stake: StakeSummary): EarnWithSkyProduct[] {
  const products: EarnWithSkyProduct[] = [];

  const savings = rows.find(row => row.kind === 'savings');
  if (savings) {
    products.push({
      id: 'savings',
      rate: savings.rate,
      isBestOf: false,
      supplyTokens: savings.supplyTokens,
      riskProfile: savings.riskProfile,
      to: { path: savings.detailPath },
      isLoading: savings.isLoading
    });
  }

  const vaults = rows.filter(row => row.kind === 'vault');
  if (vaults.length > 0) {
    // The badge advertises the best vault rate, and the risk pill describes
    // that same vault, so the two facts on the card never disagree.
    const best = vaults.reduce((top, row) => ((row.rate.value ?? -1) > (top.rate.value ?? -1) ? row : top));
    products.push({
      id: 'vaults',
      rate: best.rate,
      isBestOf: vaults.length > 1,
      supplyTokens: [...new Set(vaults.flatMap(row => row.supplyTokens))],
      riskProfile: best.riskProfile,
      // The Earn list pre-filtered to vaults, scrolled to the table (APP-487).
      to: {
        path: ROUTES.EARN,
        search: { [QueryParams.Product]: 'vault' },
        hash: EARN_OPPORTUNITIES_HASH
      },
      isLoading: vaults.some(row => row.isLoading)
    });
  }

  if (stake.isAvailable) {
    products.push({
      id: 'stake',
      rate: stake.rate,
      isBestOf: false,
      supplyTokens: ['SKY'],
      riskProfile: 'stake',
      to: { path: intentToPath(Intent.STAKE_INTENT) },
      isLoading: stake.isLoading
    });
  }

  return products;
}
