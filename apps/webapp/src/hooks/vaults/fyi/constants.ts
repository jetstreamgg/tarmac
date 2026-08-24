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
