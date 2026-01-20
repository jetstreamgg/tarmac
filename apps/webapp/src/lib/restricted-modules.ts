import React, { lazy, ComponentType } from 'react';
import { Intent } from './enums';

/**
 * Behavior when a module is blocked by geo-restriction
 * - 'hide': Remove the module from the navigation menu entirely
 * - 'disable': Show the module in the menu but grayed out and non-clickable
 */
export type BlockedModuleBehavior = 'hide' | 'disable';

/**
 * Configure how blocked modules appear in the UI
 */
export const BLOCKED_MODULE_BEHAVIOR: BlockedModuleBehavior = 'disable';

/**
 * Restriction group identifiers for geo-restrictions
 * These are internal identifiers used for configuration and dev simulation.
 * The actual country lists are configured in Cloudflare WAF rules.
 *
 * - 'securities': Countries with securities-related restrictions (e.g., US)
 * - 'mica': EU/EEA countries subject to MiCA compliance
 */
export type RestrictionGroup = 'securities' | 'mica';

/**
 * Module restriction configuration
 * Maps intents to the restriction groups where they are blocked.
 * A module can be blocked in multiple groups (e.g., ['securities', 'mica'])
 *
 * Note: This configuration is used for:
 * 1. Dev simulation mode (VITE_SIMULATE_REGION)
 * 2. Determining which modules to preload/check
 *
 * The actual blocking is enforced by Cloudflare WAF rules.
 */
export const MODULE_RESTRICTIONS: Partial<Record<Intent, RestrictionGroup[]>> = {
  [Intent.SAVINGS_INTENT]: ['securities'],
  [Intent.REWARDS_INTENT]: ['securities'],
  [Intent.EXPERT_INTENT]: ['securities'],
  [Intent.TRADE_INTENT]: ['mica']
};

/**
 * Chunk path mapping for restricted modules
 * Maps intents to their expected chunk path prefix
 */
export const RESTRICTED_CHUNK_PATHS: Partial<Record<Intent, string>> = {
  [Intent.SAVINGS_INTENT]: 'restricted/savings',
  [Intent.REWARDS_INTENT]: 'restricted/rewards',
  [Intent.EXPERT_INTENT]: 'restricted/expert',
  [Intent.TRADE_INTENT]: 'restricted/trade'
};

/**
 * Set of intents that have been detected as blocked (403 from WAF)
 */
const blockedModules = new Set<Intent>();

/**
 * Check if a module is blocked based on runtime detection
 */
export function isModuleBlocked(intent: Intent): boolean {
  return blockedModules.has(intent);
}

/**
 * Mark a module as blocked (called when chunk load fails with 403)
 */
export function markModuleBlocked(intent: Intent): void {
  blockedModules.add(intent);
}

/**
 * Clear a module's blocked status (for testing purposes)
 */
export function clearModuleBlocked(intent: Intent): void {
  blockedModules.delete(intent);
}

/**
 * Get all currently blocked intents
 */
export function getBlockedIntents(): Intent[] {
  return Array.from(blockedModules);
}

/**
 * Check if an intent is potentially restricted (has WAF rules)
 */
export function isRestrictedIntent(intent: Intent): boolean {
  return intent in MODULE_RESTRICTIONS;
}

/**
 * Custom error class for chunk blocking
 */
export class ChunkBlockedError extends Error {
  constructor(
    public readonly intent: Intent,
    message?: string
  ) {
    super(message || `Module chunk for ${intent} was blocked (403)`);
    this.name = 'ChunkBlockedError';
  }
}

/**
 * Creates a lazy-loaded component that detects 403 blocks from WAF
 *
 * When the chunk request returns 403 (blocked by Cloudflare WAF),
 * this wrapper catches the error, marks the module as blocked,
 * and returns a null component so the UI can hide the feature.
 *
 * @param intent - The intent associated with this module
 * @param importFn - Dynamic import function returning the module
 * @param exportName - Optional: the named export to use (if not using default export)
 */
export function createRestrictedLazy<P extends object>(
  intent: Intent,
  importFn: () => Promise<{ default: ComponentType<P> } | Record<string, ComponentType<P>>>,
  exportName?: string
): React.LazyExoticComponent<ComponentType<P>> {
  return lazy(async (): Promise<{ default: ComponentType<P> }> => {
    try {
      const module = await importFn();
      // Handle named exports
      if (exportName && exportName in module) {
        return { default: module[exportName as keyof typeof module] as ComponentType<P> };
      }
      // Handle default export
      if ('default' in module) {
        return { default: (module as { default: ComponentType<P> }).default };
      }
      // Fallback for modules that export the component directly
      const keys = Object.keys(module);
      if (keys.length === 1) {
        return { default: module[keys[0] as keyof typeof module] as ComponentType<P> };
      }
      throw new Error(`Could not resolve component export for ${intent}`);
    } catch (error) {
      // Check for 403 or network errors (chunk blocked by WAF)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const is403Blocked =
        errorMessage.includes('403') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('Loading chunk') ||
        errorMessage.includes('Importing a module script failed');

      if (is403Blocked) {
        markModuleBlocked(intent);
        // Return empty component - the navigation will hide this tab
        const NullComponent: ComponentType<P> = () => null;
        return { default: NullComponent };
      }

      // Re-throw other errors for the error boundary to catch
      throw error;
    }
  });
}

/**
 * Simulated region for development/testing
 * Set via VITE_SIMULATE_REGION environment variable
 */
const SIMULATED_REGION = import.meta.env.VITE_SIMULATE_REGION as RestrictionGroup | undefined;

/**
 * Check if we're in simulation mode (for dev testing)
 */
export function isSimulatingRegion(): boolean {
  return !!SIMULATED_REGION && import.meta.env.DEV;
}

/**
 * Get the simulated region (for dev testing)
 */
export function getSimulatedRegion(): RestrictionGroup | undefined {
  return SIMULATED_REGION;
}

/**
 * Check if a module should be simulated as blocked (dev mode only)
 */
export function shouldSimulateBlocked(intent: Intent): boolean {
  if (!isSimulatingRegion() || !SIMULATED_REGION) {
    return false;
  }
  const regions = MODULE_RESTRICTIONS[intent];
  return regions?.includes(SIMULATED_REGION) ?? false;
}
