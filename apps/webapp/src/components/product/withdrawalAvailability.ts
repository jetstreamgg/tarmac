import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import type { EarnRiskProfileId } from '@/hooks';

type WithdrawalFlow = 'supply' | 'withdraw';

/**
 * Withdrawal-availability wording per risk profile, from the APP-396 risk
 * sheet. Single source for the risk-details fact row (RiskTierDetails) and the
 * transaction modals' Withdrawal cell, so the surfaces cannot drift.
 *
 * `sheet` is the canonical product attribute. A flow override exists only where
 * the answer genuinely differs by flow (Pendle: the PT is locked until maturity,
 * but the withdraw review's market sell executes now) or on instant-exit
 * products, whose supply review uses the comps' friendlier future-looking
 * "Anytime" for the same fact.
 * 'vault-tether-savings' and 'stake' are PLACEHOLDER copy pending a product
 * assessment, like their RiskTierDetails entries.
 */
const WITHDRAWAL_AVAILABILITY: Record<
  EarnRiskProfileId,
  { sheet: MessageDescriptor } & Partial<Record<WithdrawalFlow, MessageDescriptor>>
> = {
  savings: { sheet: msg`Instant`, supply: msg`Anytime` },
  rewards: { sheet: msg`Instant`, supply: msg`Anytime` },
  'rewards-sky': { sheet: msg`Instant`, supply: msg`Anytime` },
  'rewards-spk': { sheet: msg`Instant`, supply: msg`Anytime` },
  'rewards-grove': { sheet: msg`Instant`, supply: msg`Anytime` },
  'rewards-cle': { sheet: msg`Instant`, supply: msg`Anytime` },
  'vault-flagship': { sheet: msg`Liquidity based` },
  'vault-usdt-savings': { sheet: msg`Liquidity based` },
  'vault-tether-savings': { sheet: msg`Instant`, supply: msg`Anytime` },
  'vault-risk-capital': { sheet: msg`Liquidity based` },
  fixed: { sheet: msg`At maturity or via market sell`, withdraw: msg`Instant` },
  stusds: { sheet: msg`Liquidity based` },
  stake: { sheet: msg`Instant` }
};

/**
 * The Withdrawal wording for a surface: pass the modal's `flow` for the review
 * grid cell, omit it for the risk-details fact row.
 */
export function withdrawalWording(profile: EarnRiskProfileId, flow?: WithdrawalFlow): MessageDescriptor {
  const entry = WITHDRAWAL_AVAILABILITY[profile];
  return (flow && entry[flow]) || entry.sheet;
}
