import { mainnet } from 'wagmi/chains';
import { stUsdsAddress, sUsdsAddress } from '../../generated';

/**
 * vaults.fyi via the Sky proxy. The upstream (https://api.vaults.fyi) is
 * key-gated (x-api-key) and per-request billed; the key lives ONLY in the
 * proxy-worker as a secret and must never ship client-side. Optional-chained
 * env like the sibling constants: plain-Node tsx scripts never define
 * `import.meta.env`.
 */
export const VAULTS_FYI_API_URL = `${import.meta.env?.VITE_PROXY_ORIGIN || 'https://staging-proxy.sky.money'}/vaultsfyi`;

/** vaults.fyi vaultId for sUSDS = the mainnet token address (lowercased on the wire). */
export const SUSDS_VAULT_ID_MAINNET = sUsdsAddress[mainnet.id];

/** vaults.fyi vaultId for stUSDS, same convention (listed 2026-08-20). */
export const STUSDS_VAULT_ID_MAINNET = stUsdsAddress[mainnet.id];

/**
 * APP-450 stUSDS earnings entry. vaults.fyi listed stUSDS on 2026-08-20, but
 * the returns endpoints still answer 404 "Vault indexed data not yet
 * supported" (probed live same day) — their holder indexing lags the listing.
 * While this flag is off the protocol entry renders with both figures
 * `notAvailable('stusds-not-listed')` (announced gap, not an error); flip it
 * once the returns endpoints serve data.
 */
export const EARNINGS_STUSDS_ENABLED = import.meta.env?.VITE_EARNINGS_STUSDS_ENABLED === 'true';
