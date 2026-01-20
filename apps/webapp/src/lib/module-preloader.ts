import { Intent } from './enums';
import {
  MODULE_RESTRICTIONS,
  markModuleBlocked,
  isSimulatingRegion,
  shouldSimulateBlocked
} from './restricted-modules';

/**
 * Result of a module preload check
 */
export interface PreloadResult {
  intent: Intent;
  available: boolean;
  status?: number;
  error?: string;
}

/**
 * Chunk manifest for mapping intents to chunk paths
 * This will be populated after build via the manifest or dynamically discovered
 */
let chunkManifest: Record<Intent, string> | null = null;

/**
 * Set the chunk manifest (called during app initialization)
 * In production, this comes from the Vite manifest
 */
export function setChunkManifest(manifest: Record<Intent, string>): void {
  chunkManifest = manifest;
}

/**
 * Get the chunk URL for a restricted intent
 * Falls back to a predictable pattern if manifest is not available
 */
function getChunkUrl(intent: Intent): string | null {
  // Check manifest first
  if (chunkManifest?.[intent]) {
    return chunkManifest[intent];
  }

  // Fallback: scan for matching script tags or use predictable pattern
  // In production, chunks follow the pattern: /assets/restricted/{module}-{hash}.js
  const moduleMap: Partial<Record<Intent, string>> = {
    [Intent.SAVINGS_INTENT]: 'savings',
    [Intent.REWARDS_INTENT]: 'rewards',
    [Intent.EXPERT_INTENT]: 'expert',
    [Intent.TRADE_INTENT]: 'trade'
  };

  const moduleName = moduleMap[intent];
  if (!moduleName) {
    return null;
  }

  // Try to find the chunk from existing script tags
  const scripts = document.querySelectorAll('script[src*="restricted/"]');
  for (const script of scripts) {
    const src = (script as HTMLScriptElement).src;
    if (src.includes(`restricted/${moduleName}-`)) {
      return src;
    }
  }

  // If not found, we'll use HEAD request pattern matching
  // The actual chunk URL will be discovered during the preload attempt
  return `/assets/restricted/${moduleName}`;
}

/**
 * Preload a single module to check availability
 * Uses HEAD request to check if the chunk is accessible
 */
export async function preloadModule(intent: Intent): Promise<PreloadResult> {
  // Skip non-restricted modules
  if (!(intent in MODULE_RESTRICTIONS)) {
    return { intent, available: true };
  }

  // In dev mode with simulation, mock the response
  if (isSimulatingRegion()) {
    const blocked = shouldSimulateBlocked(intent);
    if (blocked) {
      markModuleBlocked(intent);
    }
    return {
      intent,
      available: !blocked,
      status: blocked ? 403 : 200
    };
  }

  const chunkUrl = getChunkUrl(intent);
  if (!chunkUrl) {
    // No chunk URL means module is not restricted
    return { intent, available: true };
  }

  try {
    // Use HEAD request to check availability without downloading
    const response = await fetch(chunkUrl, {
      method: 'HEAD',
      cache: 'no-store' // Don't use cached response, we need fresh geo check
    });

    if (response.status === 403) {
      markModuleBlocked(intent);
      return {
        intent,
        available: false,
        status: 403
      };
    }

    // Handle redirects or other non-200 responses
    if (!response.ok && response.status !== 404) {
      // 404 might mean chunk hasn't been loaded yet, not necessarily blocked
      return {
        intent,
        available: true,
        status: response.status
      };
    }

    return {
      intent,
      available: true,
      status: response.status
    };
  } catch (error) {
    // Network errors could indicate blocking (especially for chunk requests)
    const errorMessage = error instanceof Error ? error.message : String(error);

    // If fetch failed completely, might be CORS blocked (which WAF could cause)
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      markModuleBlocked(intent);
      return {
        intent,
        available: false,
        error: errorMessage
      };
    }

    // Other errors - assume available for now
    return {
      intent,
      available: true,
      error: errorMessage
    };
  }
}

/**
 * Preload all restricted modules in parallel
 * Returns a map of intent -> availability
 */
export async function preloadAllRestrictedModules(): Promise<Map<Intent, PreloadResult>> {
  const restrictedIntents = Object.keys(MODULE_RESTRICTIONS) as Intent[];

  const results = await Promise.all(restrictedIntents.map(intent => preloadModule(intent)));

  const resultMap = new Map<Intent, PreloadResult>();
  for (const result of results) {
    resultMap.set(result.intent, result);
  }

  return resultMap;
}

/**
 * Discover chunk URLs from the Vite manifest
 * This should be called during app initialization
 */
export async function discoverChunkManifest(): Promise<void> {
  try {
    // In production, Vite generates a manifest.json
    // Try to fetch it to get accurate chunk paths
    const response = await fetch('/.vite/manifest.json', { cache: 'force-cache' });
    if (response.ok) {
      const manifest = await response.json();
      const discovered: Record<string, string> = {};

      // Look for restricted module entries
      for (const [key, value] of Object.entries(manifest)) {
        const entry = value as { file?: string };
        if (entry.file?.includes('restricted/')) {
          if (key.includes('savings')) {
            discovered[Intent.SAVINGS_INTENT] = `/${entry.file}`;
          } else if (key.includes('rewards')) {
            discovered[Intent.REWARDS_INTENT] = `/${entry.file}`;
          } else if (key.includes('expert')) {
            discovered[Intent.EXPERT_INTENT] = `/${entry.file}`;
          } else if (key.includes('trade')) {
            discovered[Intent.TRADE_INTENT] = `/${entry.file}`;
          }
        }
      }

      if (Object.keys(discovered).length > 0) {
        setChunkManifest(discovered as Record<Intent, string>);
      }
    }
  } catch {
    // Manifest not available (dev mode or not generated)
    // Preloader will use fallback URL patterns
  }
}
