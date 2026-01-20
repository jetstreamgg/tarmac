/**
 * Lazy-loaded components for geo-restricted modules
 *
 * These components are separated into their own file so they can be:
 * 1. Preloaded by ModuleAvailabilityContext on app startup
 * 2. Used by WidgetPane for rendering
 *
 * This ensures that blocked modules are detected BEFORE the menu is shown.
 */

import { Intent } from './enums';
import { createRestrictedLazy } from './restricted-modules';
import type { SharedProps } from '@/modules/app/types/Widgets';

// Lazy load restricted modules - chunks will be blocked by Cloudflare WAF for restricted regions
export const LazyRewardsWidgetPane = createRestrictedLazy<SharedProps>(
  Intent.REWARDS_INTENT,
  () => import('@/modules/rewards/components/RewardsWidgetPane'),
  'RewardsWidgetPane'
);

export const LazySavingsWidgetPane = createRestrictedLazy<SharedProps>(
  Intent.SAVINGS_INTENT,
  () => import('@/modules/savings/components/SavingsWidgetPane'),
  'SavingsWidgetPane'
);

export const LazyExpertWidgetPane = createRestrictedLazy<SharedProps>(
  Intent.EXPERT_INTENT,
  () => import('@/modules/expert/components/ExpertWidgetPane'),
  'ExpertWidgetPane'
);

export const LazyTradeWidgetPane = createRestrictedLazy<SharedProps>(
  Intent.TRADE_INTENT,
  () => import('@/modules/trade/components/TradeWidgetPane'),
  'TradeWidgetPane'
);

/**
 * Map of Intent to lazy component for easy lookup
 */
export const RESTRICTED_LAZY_COMPONENTS = {
  [Intent.REWARDS_INTENT]: LazyRewardsWidgetPane,
  [Intent.SAVINGS_INTENT]: LazySavingsWidgetPane,
  [Intent.EXPERT_INTENT]: LazyExpertWidgetPane,
  [Intent.TRADE_INTENT]: LazyTradeWidgetPane
} as const;

import { markModuleBlocked, shouldSimulateBlocked, isSimulatingRegion } from './restricted-modules';

/**
 * Check if an error indicates a 403 block from WAF
 */
function is403Error(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('403') ||
    message.includes('failed to fetch') ||
    message.includes('loading chunk') ||
    message.includes('importing a module script failed') ||
    message.includes('dynamically imported module')
  );
}

/**
 * Attempt to preload a module and detect if it's blocked
 */
async function preloadModule(
  intent: Intent,
  importFn: () => Promise<unknown>
): Promise<{ intent: Intent; blocked: boolean }> {
  // In dev mode with simulation, check simulated blocking
  if (isSimulatingRegion() && shouldSimulateBlocked(intent)) {
    markModuleBlocked(intent);
    return { intent, blocked: true };
  }

  try {
    await importFn();
    return { intent, blocked: false };
  } catch (error) {
    if (is403Error(error)) {
      markModuleBlocked(intent);
      return { intent, blocked: true };
    }
    // Other errors (network issues, etc.) - don't mark as blocked
    console.error(`Error preloading module ${intent}:`, error);
    return { intent, blocked: false };
  }
}

/**
 * Preload all restricted modules by triggering their dynamic imports
 *
 * This function attempts to load each restricted module's chunk.
 * If the chunk is blocked by WAF (403), the module is marked as blocked.
 *
 * @returns Promise that resolves when all preloads have completed (or failed)
 */
export async function preloadRestrictedComponents(): Promise<void> {
  const preloadPromises = [
    preloadModule(Intent.REWARDS_INTENT, () => import('@/modules/rewards/components/RewardsWidgetPane')),
    preloadModule(Intent.SAVINGS_INTENT, () => import('@/modules/savings/components/SavingsWidgetPane')),
    preloadModule(Intent.EXPERT_INTENT, () => import('@/modules/expert/components/ExpertWidgetPane')),
    preloadModule(Intent.TRADE_INTENT, () => import('@/modules/trade/components/TradeWidgetPane'))
  ];

  await Promise.allSettled(preloadPromises);
}
