/**
 * Pure cell builders for the vault transaction modals (Figma 859:38105 supply /
 * 859:38297 withdraw entries, 859:38553 review supply / 859:38234 review
 * withdrawal). Same grid contract as the savings builders: rows of shared
 * `ModalGridCell`s, asserted in `vaultModalRows.test.ts`. Vault-specific hints:
 * the Rate cells carry the morpho stars accent (only while the rate is
 * incentive-boosted) and the review Product cell draws the asset icon inside
 * the morpho-gradient ring.
 */

import type { ModalGridCell } from '@/components/product/ModalGridCells';
import { vaultRateInfo } from '@/components/product/RateInfo';
import type { VaultProvider } from '@/hooks';
import { estEarningsTrendCell, productCell, rateCell } from '@/components/product/ModalGridCells';
import {
  buildEarnEntryRows,
  buildEarnReviewRows,
  type EarnEntryRowInput,
  type EarnReviewRowInput
} from '@/components/product/earnModalRows';

/** One grid row: a full-width single cell, or a pair split by the vertical hairline. */
export type VaultModalGridRow = ModalGridCell[];

/** The rate inputs both vault grids share. */
type VaultRateInput = {
  /** Vault provider - picks the rate explainer (Morpho vs Spark/Tether copy). */
  provider?: VaultProvider;
  /** Net rate, formatted (e.g. "4.10%"). */
  rate: string;
  /** Append the morpho stars glyph to the rate (rewards-boosted, per the rate popover). */
  boostedRate: boolean;
};

const vaultRateCell = ({ provider, rate, boostedRate }: VaultRateInput) =>
  rateCell('Rate', rate, boostedRate ? 'morpho' : undefined, vaultRateInfo(provider));

/** Display strings for the vault supply/withdraw entry screens (Figma 859:38105 / 859:38297). */
type VaultEntryRowInput = EarnEntryRowInput &
  VaultRateInput & {
    /** The vault's underlying asset symbol for the 12px value icons (e.g. "USDC"). */
    assetSymbol: string;
  };

/**
 * Grid for the vault entry screens — one shape for both flows (Figma draws
 * supply 859:38105 and withdraw 859:38297 identically, only the delta
 * directions differ): [Rate | Network], [Supply | Est. earnings (1Y)], then
 * Network fee full-width.
 */
export function buildVaultEntryRows(input: VaultEntryRowInput): VaultModalGridRow[] {
  return buildEarnEntryRows(input, {
    rate: vaultRateCell(input),
    supplyToken: input.assetSymbol,
    earningsToken: input.assetSymbol
  });
}

/** Display strings for the vault review stages (Figma 859:38553 supply / 859:38234 withdrawal). */
type VaultReviewRowInput = EarnReviewRowInput &
  VaultRateInput & {
    /** Entered amount, formatted (the 12px asset icon carries the denomination). */
    amount: string;
    /** The vault's underlying asset symbol (e.g. "USDC"). */
    assetSymbol: string;
    /** 1Y projected earnings on the position after the action. */
    estEarnings: string;
    /** Vault display name (e.g. "USDC Risk Capital"). */
    product: string;
    /** Withdrawal availability — "Liquidity based" per the risk sheet (RiskTierDetails); diverges from the comp's "Anytime"/"Instant". */
    withdrawal: string;
  };

/**
 * Grid for the vault review stages: [You'll supply|receive | Est. earnings
 * (1Y)], [Product | Rate], [Withdrawal | Network], then Network fee full-width.
 * The Est. earnings cell draws the green trend glyph before and the asset icon
 * after the value; Product draws the asset icon in the morpho-gradient ring.
 */
export function buildVaultReviewRows(
  flow: 'supply' | 'withdraw',
  input: VaultReviewRowInput
): VaultModalGridRow[] {
  return buildEarnReviewRows(input, {
    leading: [
      {
        kind: 'single',
        label: flow === 'supply' ? "You'll supply" : "You'll receive",
        value: input.amount,
        token: input.assetSymbol
      },
      estEarningsTrendCell(input.estEarnings, input.assetSymbol)
    ],
    product: productCell(input.product, input.assetSymbol, 'morpho'),
    rate: vaultRateCell(input)
  });
}
