import { Intent, FixedIntent, VaultsIntent } from './enums';
import { vaultModuleForVaultsIntent } from './vaults/vaultProviderMapping';
import { msg } from '@lingui/core/macro';
import { MessageDescriptor } from '@lingui/core';

/** The placeholder every product surface shows for a value it cannot source. */
export const NO_VALUE = '–';

// Navigation state (module, submodule, entity selection) lives in the path;
// these are the params that remain query-driven.
export enum QueryParams {
  Locale = 'lang',
  UrnIndex = 'urn_index',
  SourceToken = 'source_token',
  TargetToken = 'target_token',
  Network = 'network',
  Flow = 'flow',
  StakeTab = 'stake_tab',
  Tab = 'tab',
  /**
   * The three URL-driven Earn Opportunities filters (APP-457). They live in the
   * search string rather than component state so history restores them — the
   * browser back button and the product page's "Back to products" both land on
   * an /earn entry that still carries them — while `retainOnNavigate` drops
   * them, which is what makes the navbar's Earn button a reset. The risk filter
   * is a saved preference and stays in localStorage.
   */
  /** Earn list supply-token filter, e.g. /earn?token=USDS. */
  Token = 'token',
  /** Earn list network filter, a chain slug: /earn?chain=ethereum. */
  Chain = 'chain',
  /** Earn list product-kind filter, e.g. /earn?product=savings. */
  Product = 'product',
  /**
   * Deep link to the Upgrade DAI/MKR modal, e.g. /?upgrade=mkr — consumed
   * (opened + stripped) by useUpgradeDeepLink on any module route.
   */
  Upgrade = 'upgrade'
}

export enum Environment {
  Production = 'production',
  Staging = 'staging',
  Development = 'development'
}

export const IntentMapping = {
  [Intent.BALANCES_INTENT]: 'balances',
  [Intent.UPGRADE_INTENT]: 'upgrade',
  [Intent.TRADE_INTENT]: 'trade',
  [Intent.SAVINGS_INTENT]: 'savings',
  [Intent.REWARDS_INTENT]: 'rewards',
  [Intent.STAKE_INTENT]: 'stake',
  [Intent.EXPERT_INTENT]: 'stusds',
  [Intent.VAULTS_INTENT]: 'vaults',
  [Intent.CONVERT_INTENT]: 'convert',
  [Intent.FIXED_INTENT]: 'fixed'
};

// Recently launched modules, surfaced with a "new" indicator in the nav and suggested actions.
export const NEW_INTENTS: Intent[] = [Intent.FIXED_INTENT];
export const isNewIntent = (intent: Intent): boolean => NEW_INTENTS.includes(intent);

export const VaultsIntentMapping: Record<VaultsIntent, string> = {
  [VaultsIntent.MORPHO_VAULT_INTENT]: vaultModuleForVaultsIntent(VaultsIntent.MORPHO_VAULT_INTENT),
  [VaultsIntent.SKY_VAULT_INTENT]: vaultModuleForVaultsIntent(VaultsIntent.SKY_VAULT_INTENT)
};

export const FixedIntentMapping: Record<FixedIntent, string> = {
  [FixedIntent.MARKET_INTENT]: 'market'
};

// Moved to a Lingui-free module so the engine layer can import them; re-exported
// here so existing import sites keep working.
export { CHAIN_WIDGET_MAP, COMING_SOON_MAP } from './chainAvailability';

export const intentTxt: Record<string, MessageDescriptor> = {
  psm: msg`1:1 conversion`,
  trade: msg`trade`,
  upgrade: msg`upgrade`,
  savings: msg`savings`,
  stusds: msg`stusds`,
  rewards: msg`rewards`,
  balances: msg`balances`,
  stake: msg`stake`,
  vaults: msg`vaults`,
  convert: msg`convert`,
  pendle: msg`pendle`
};

export function mapIntentToQueryParam(intent: Intent): string {
  return IntentMapping[intent] || '';
}

export function mapQueryParamToIntent(queryParam?: string | null): Intent {
  const intent = Object.keys(IntentMapping).find(
    key => IntentMapping[key as keyof typeof IntentMapping] === queryParam
  );
  return (intent as Intent) || Intent.BALANCES_INTENT;
}

export const REFRESH_DELAY = 1000;

export const ALLOWED_EXTERNAL_DOMAINS = [
  'sky.money',
  'app.sky.money',
  'docs.sky.money',
  'vote.sky.money',
  'upgrademkrtosky.skyeco.com',
  'jobs.ashbyhq.com',
  'immunefi.com'
];

export const IS_PRODUCTION_ENV = import.meta.env.VITE_ENV_NAME === Environment.Production;
export const IS_STAGING_ENV = import.meta.env.VITE_ENV_NAME === Environment.Staging;
export const IS_DEVELOPMENT_ENV = import.meta.env.VITE_ENV_NAME === Environment.Development;

// Feature flag for batch transactions
export const BATCH_TX_ENABLED = import.meta.env.VITE_BATCH_TX_ENABLED === 'true';

// Feature flag for the sUSDT (Tether Savings) vault. Off in production until
// launch; flip the Vercel env var to `true` to reveal it without a redeploy.
export const SUSDT_VAULT_ENABLED = import.meta.env.VITE_SUSDT_VAULT_ENABLED === 'true';

export const REFERRAL_CODE: number = Number(import.meta.env.VITE_REFERRAL_CODE) || 0;

// The bundled-transaction legal notice lives in the docs, not in the app: a
// standalone page the user was navigated *out of* a transaction flow to reach
// read as a dead end (APP-456 #3). TODO: repoint at the dedicated bundled-
// transactions docs page once it is published — until then this lands on the
// Terms of Use, which is the document the notice itself cited.
export const BATCH_TX_LEGAL_NOTICE_URL = 'https://docs.sky.money/legal-terms';
/** The "Learn more in the User Risk Documentation." target shared by every product About section. */
export const USER_RISKS_URL = 'https://docs.sky.money/user-risks';
export const BATCH_TX_SUPPORTED_WALLETS_URL = 'https://swiss-knife.xyz/7702beat';

// Deprecated Seal Engine (LockstakeEngine v1, MKR). The UI was removed; this address backs the
// static /seal-engine withdrawal guide. Mirrors the leftover `sealModuleAddress` in generated.ts,
// which is no longer in contracts.ts and will be dropped on the next codegen run.
export const SEAL_ENGINE_V1_ADDRESS = '0x2b16C07D5fD5cC701a0a871eae2aad6DA5fc8f12';

// LocalStorage keys
export const USER_SETTINGS_KEY = 'user-settings';
export const GOVERNANCE_MIGRATION_NOTIFICATION_KEY = 'governance-migration-notice-shown';
export const SPK_STAKING_NOTIFICATION_KEY = 'spk-staking-rewards-notice-shown';
export const USDS_SKY_REWARDS_NOTIFICATION_KEY = 'usds-sky-rewards-notice-shown';
export const SEAL_ENGINE_NOTIFICATION_KEY = 'seal-engine-position-notice-shown';

export const WALLET_ICONS = {
  metaMaskSDK: '/wallets/metamask.svg',
  baseAccount: '/wallets/baseAccount.svg',
  coinbaseWalletSDK: '/wallets/coinbaseWallet.svg',
  walletConnect: '/wallets/walletConnect.svg',
  safe: '/wallets/safe.svg',
  // Binance uses different IDs: 'wallet.binance.com' (our connector) vs 'com.binance.wallet' (EIP-6963 injected)
  'wallet.binance.com': '/wallets/binance.svg',
  'com.binance.wallet': '/wallets/binance.svg'
};
