import { Banner, banners } from './banners';

/**
 * Get a banner by both ID and module (explicit version)
 */
export function getBannerByIdAndModule(id: string, module: string): Banner | undefined {
  return banners.find(banner => banner.id === id && banner.module === module);
}
