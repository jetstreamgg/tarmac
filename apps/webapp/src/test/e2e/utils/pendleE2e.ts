/** PT-sUSDS market slug — sole live Pendle market in PENDLE_MARKETS. */
export const PT_SUSDS_SLUG = 'pt-susds';

/** Legacy address route forwards to the slug above. */
export const PT_SUSDS_MARKET_ADDRESS = '0x9c560ebaf78e596cbcc27411d633a74d628dd7dc';

/** On-chain PT ERC-20 for PT-sUSDS (18 decimals). */
export const PT_SUSDS_PT_TOKEN = '0xdc169abe56461a2e0c034da431ac2a3ebf596094';

export const PT_SUSDS_YT_TOKEN = '0xc7b8551c6b286ce0b44952320e940bd3dee58a09';

export const PT_SUSDS_SY_TOKEN = '0xbe3d4ec488a0a042bb86f9176c24f8cd54018ba7';

/** Static expiry from PENDLE_MARKETS — Thu Nov 26 2026 00:00:00 UTC. */
export const PT_SUSDS_EXPIRY_SEC = 1_795_651_200;

export const pendleMarketPath = (slug: string) => `/earn/fixed/${slug}`;

export const pendleLegacyMarketPath = (marketAddress: string) => `/earn/fixed/market/${marketAddress}`;

/** Modal titles use the PT naming convention. */
export const PT_SUSDS_MODAL_NAME = 'PT-sUSDS';
