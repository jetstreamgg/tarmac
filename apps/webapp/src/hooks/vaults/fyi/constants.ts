import { mainnet } from 'wagmi/chains';
import { sUsdsAddress } from '../../generated';

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

/**
 * APP-450 savings earnings (sUSDS via vaults.fyi). Default OFF until the
 * proxy-worker /vaultsfyi route and API key exist — flipping this without the
 * route just yields fetch errors and dashes.
 */
export const EARNINGS_SAVINGS_ENABLED = import.meta.env?.VITE_EARNINGS_SAVINGS_ENABLED === 'true';

/**
 * APP-450 stUSDS earnings entry. vaults.fyi does not list stUSDS yet; while
 * this flag is off the protocol entry still renders with both figures
 * `notAvailable('stusds-not-listed')` (announced gap, not an error).
 */
export const EARNINGS_STUSDS_ENABLED = import.meta.env?.VITE_EARNINGS_STUSDS_ENABLED === 'true';
