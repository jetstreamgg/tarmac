import { mainnet } from 'wagmi/chains';
import { TENDERLY_CHAIN_ID } from '../../constants';
import { TOKENS } from '../../tokens/tokens.constants';
import { VaultConfig } from '../types';

/**
 * Tether Savings (sUSDT) `SparkVault` — the only Spark contract the webapp touches.
 * Verified ERC-4626 proxy; upgrade authority = Sky governance Pause Proxy (APP-266,
 * address pre-cleared). Underlying asset is USDT (6 decimals). Same address on
 * mainnet and the Tenderly fork.
 */
export const SPARK_USDT_VAULT_ADDRESS = '0x74cb54e082411cfCAEADb00a0765625B10410DAa' as const;

/**
 * Host for the Savings Data API. We read it from our own edge-cached proxy
 * (`api.sky.money` in prod, `staging-api.sky.money` in staging/dev), which
 * returns Spark's public Savings payload verbatim, so everything downstream
 * still depends on the normalized shape, not the URL or the origin.
 *
 * Reuses `VITE_AUTH_URL`, the shared base for our sky.money API gateway
 * (api-workers serves auth, geo-config, terms, and these vault routes on the
 * same host), so there is no separate var to provision per environment. The
 * committed default targets staging; the prod build already sets this to
 * `https://api.sky.money`.
 */
export const SPARK_SAVINGS_API_HOST = import.meta.env?.VITE_AUTH_URL || 'https://staging-api.sky.money';

/**
 * Path identity for our vault: `sky / mainnet / usdt` (→ `sUSDT`, "Tether
 * Savings"). NOT `spark/.../usdt` — that is Spark's own `spUSDT` product. Our
 * proxy bakes protocol+chain in server-side, so the client now sends only the
 * `token` segment (`/vaults/savings/{token}`); protocol/chain are retained here
 * to document the vault's identity.
 */
export const SPARK_VAULT_IDENTITY = { protocol: 'sky', chain: 'mainnet', token: 'usdt' } as const;

/**
 * Spark vaults registered in the app. Today only Tether Savings (sUSDT).
 * Fed into the unified vault list alongside `MORPHO_VAULTS`.
 */
export const SPARK_VAULTS: VaultConfig[] = [
  {
    provider: 'sky',
    name: 'Tether Savings',
    symbol: 'sUSDT',
    vaultAddress: {
      [mainnet.id]: SPARK_USDT_VAULT_ADDRESS,
      [TENDERLY_CHAIN_ID]: SPARK_USDT_VAULT_ADDRESS
    },
    assetToken: TOKENS.usdt
  }
];
