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

/** One grid row: a full-width single cell, or a pair split by the vertical hairline. */
export type VaultModalGridRow = ModalGridCell[];

const singleOrDelta = (
  base: { label: string } & Partial<ModalGridCell>,
  before: string,
  after: string,
  hasAmount: boolean
): ModalGridCell =>
  hasAmount
    ? ({ ...base, kind: 'delta', before, after } as ModalGridCell)
    : ({ ...base, kind: 'single', value: before } as ModalGridCell);

/** Display strings for the vault supply/withdraw entry screens (Figma 859:38105 / 859:38297). */
export type VaultEntryRowInput = {
  /** Net rate, formatted (e.g. "4.10%"). */
  rate: string;
  /** Append the morpho stars glyph to the rate (rewards-boosted, per the rate popover). */
  boostedRate: boolean;
  /** Network the transaction runs on (e.g. "Ethereum"). */
  network: string;
  /** The vault's underlying asset symbol for the 12px value icons (e.g. "USDC"). */
  assetSymbol: string;
  /** Supplied position value before the action. */
  supplyBefore: string;
  /** Supplied position value after the action. */
  supplyAfter: string;
  /** 1Y projected earnings on the position before the action. */
  earningsBefore: string;
  /** 1Y projected earnings on the position after the action. */
  earningsAfter: string;
  /** When false the Supply / Est. earnings cells collapse to their `before` value (no delta drawn). */
  hasAmount: boolean;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
};

/**
 * Grid for the vault entry screens — one shape for both flows (Figma draws
 * supply 859:38105 and withdraw 859:38297 identically, only the delta
 * directions differ): [Rate | Network], [Supply | Est. earnings (1Y)], then
 * Network fee full-width.
 */
export function buildVaultEntryRows(input: VaultEntryRowInput): VaultModalGridRow[] {
  return [
    [
      {
        kind: 'single',
        label: 'Rate',
        value: input.rate,
        rateAccent: input.boostedRate ? 'morpho' : undefined
      },
      { kind: 'single', label: 'Network', value: input.network, network: true }
    ],
    [
      singleOrDelta(
        { label: 'Supply', token: input.assetSymbol },
        input.supplyBefore,
        input.supplyAfter,
        input.hasAmount
      ),
      singleOrDelta(
        { label: 'Est. earnings (1Y)', token: input.assetSymbol },
        input.earningsBefore,
        input.earningsAfter,
        input.hasAmount
      )
    ],
    [{ kind: 'single', label: 'Network fee', value: input.networkFee }]
  ];
}

/** Display strings for the vault review stages (Figma 859:38553 supply / 859:38234 withdrawal). */
export type VaultReviewRowInput = {
  /** Entered amount, formatted (the 12px asset icon carries the denomination). */
  amount: string;
  /** The vault's underlying asset symbol (e.g. "USDC"). */
  assetSymbol: string;
  /** 1Y projected earnings on the position after the action. */
  estEarnings: string;
  /** Vault display name (e.g. "USDC Risk Capital"). */
  product: string;
  /** Net rate, formatted. */
  rate: string;
  /** Append the morpho stars glyph to the rate. */
  boostedRate: boolean;
  /** Withdrawal availability — Figma: "Anytime" on supply, "Instant" on withdraw. */
  withdrawal: string;
  /** Network the transaction runs on. */
  network: string;
  /** Network fee, formatted — stubbed until a gas estimate is wired. */
  networkFee: string;
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
  return [
    [
      {
        kind: 'single',
        label: flow === 'supply' ? "You'll supply" : "You'll receive",
        value: input.amount,
        token: input.assetSymbol
      },
      {
        kind: 'single',
        label: 'Est. earnings (1Y)',
        value: input.estEarnings,
        trend: true,
        trailingToken: input.assetSymbol
      }
    ],
    [
      {
        kind: 'single',
        label: 'Product',
        value: input.product,
        token: input.assetSymbol,
        productIcon: 'morpho'
      },
      {
        kind: 'single',
        label: 'Rate',
        value: input.rate,
        rateAccent: input.boostedRate ? 'morpho' : undefined
      }
    ],
    [
      { kind: 'single', label: 'Withdrawal', value: input.withdrawal },
      { kind: 'single', label: 'Network', value: input.network, network: true }
    ],
    [{ kind: 'single', label: 'Network fee', value: input.networkFee }]
  ];
}
