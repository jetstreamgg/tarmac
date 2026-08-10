import { Intent } from '@/lib/enums';
import type { ModuleId } from './types';

/**
 * Intent → geo ModuleId, the one mapping between the app's module vocabulary
 * and the geo-config payload's. Partial on purpose: Balances and Convert have
 * no gated counterpart, so consumers read `undefined` as "always available".
 * The payload's `upgrade` module has no intent of its own here — upgrading is
 * reached through Convert, which is not gated.
 */
export const INTENT_TO_GEO_MODULE: Partial<Record<Intent, ModuleId>> = {
  [Intent.SAVINGS_INTENT]: 'savings',
  [Intent.REWARDS_INTENT]: 'rewards',
  [Intent.EXPERT_INTENT]: 'expert',
  [Intent.TRADE_INTENT]: 'trade',
  [Intent.STAKE_INTENT]: 'stake',
  [Intent.VAULTS_INTENT]: 'vaults',
  [Intent.FIXED_INTENT]: 'fixed'
};

/** The geo module that owns an intent, or undefined when it is not geo-gated. */
export function geoModuleForIntent(intent: Intent): ModuleId | undefined {
  return INTENT_TO_GEO_MODULE[intent];
}
