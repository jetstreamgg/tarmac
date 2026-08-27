/** PT-sUSDS market slug — sole live Pendle market in PENDLE_MARKETS. */
export const PT_SUSDS_SLUG = 'pt-susds';

/** Legacy address route forwards to the slug above. */
export const PT_SUSDS_MARKET_ADDRESS = '0x9c560ebaf78e596cbcc27411d633a74d628dd7dc';

export const pendleMarketPath = (slug: string) => `/earn/fixed/${slug}`;

export const pendleLegacyMarketPath = (marketAddress: string) => `/earn/fixed/market/${marketAddress}`;

/** Modal titles use the PT naming convention. */
export const PT_SUSDS_MODAL_NAME = 'PT-sUSDS';
