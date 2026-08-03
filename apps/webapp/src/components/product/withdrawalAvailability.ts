import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import type { EarnRiskProfileId } from '@/hooks';

/**
 * Withdrawal-availability wording per risk profile, from the APP-396 risk
 * sheet. Single source for the risk-details fact row (RiskTierDetails) and the
 * transaction modals' Withdrawal cell, so the two surfaces cannot drift.
 * 'vault-tether-savings' is PLACEHOLDER copy pending a product assessment,
 * like its RiskTierDetails entry.
 */
export const WITHDRAWAL_AVAILABILITY: Record<EarnRiskProfileId, MessageDescriptor> = {
  savings: msg`Instant`,
  rewards: msg`Instant`,
  'rewards-sky': msg`Instant`,
  'rewards-spk': msg`Instant`,
  'rewards-grove': msg`Instant`,
  'rewards-cle': msg`Instant`,
  'vault-flagship': msg`Liquidity based`,
  'vault-usdt-savings': msg`Liquidity based`,
  'vault-tether-savings': msg`Instant`,
  'vault-risk-capital': msg`Liquidity based`,
  fixed: msg`At maturity or via market sell`,
  stusds: msg`Liquidity based`
};
