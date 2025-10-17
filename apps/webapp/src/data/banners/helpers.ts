import { Banner, banners } from './banners';

/**
 * Get a banner by ID. If module is provided, searches for banner with both matching ID and module.
 * Otherwise, returns the first banner with matching ID.
 */
export function getBannerById(banners: Banner[], id: string, module?: string): Banner | undefined {
  if (module) {
    return banners.find(banner => banner.id === id && banner.module === module);
  }
  return banners.find(banner => banner.id === id);
}

/**
 * Get a banner by both ID and module (explicit version)
 */
export function getBannerByIdAndModule(id: string, module: string): Banner | undefined {
  return banners.find(banner => banner.id === id && banner.module === module);
}

/**
 * Get all banners for a specific module
 */
export function getBannersByModule(banners: Banner[], module: string): Banner[] {
  return banners.filter(banner => banner.module === module);
}

/**
 * Filter banners based on connection status using the display property
 * @param banners - Array of banners to filter
 * @param isConnected - Whether the user is connected
 * @returns Filtered banners that should be displayed
 */
export function filterBannersByConnectionStatus(banners: Banner[], isConnected: boolean): Banner[] {
  const displayValue = isConnected ? 'connected' : 'disconnected';

  return banners.filter(banner => {
    // If no display property is specified, show the banner regardless of connection status
    if (!banner.display || banner.display.length === 0) {
      return true;
    }

    // Check if the banner should be displayed based on connection status
    return banner.display.includes(displayValue);
  });
}
