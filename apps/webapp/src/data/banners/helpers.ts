import { Banner, banners } from './banners';

/**
 * Get a banner by both ID and module (explicit version)
 */
export function getBannerByIdAndModule(id: string, module: string): Banner | undefined {
  return banners.find(banner => banner.id === id && banner.module === module);
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
