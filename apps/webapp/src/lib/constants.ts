import { ConvertIntent, ExpertIntent, Intent, FixedIntent, VaultsIntent } from './enums';
import { vaultModuleForVaultsIntent } from './vaults/vaultProviderMapping';
import { msg } from '@lingui/core/macro';
import { MessageDescriptor } from '@lingui/core';

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
  /** Earn list supply-token filter, e.g. /earn?token=USDS. */
  Token = 'token'
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
  [Intent.EXPERT_INTENT]: 'expert',
  [Intent.VAULTS_INTENT]: 'vaults',
  [Intent.CONVERT_INTENT]: 'convert',
  [Intent.FIXED_INTENT]: 'fixed'
};

// Recently launched modules, surfaced with a "new" indicator in the nav and suggested actions.
export const NEW_INTENTS: Intent[] = [Intent.FIXED_INTENT];
export const isNewIntent = (intent: Intent): boolean => NEW_INTENTS.includes(intent);

export const ExpertIntentMapping: Record<ExpertIntent, string> = {
  [ExpertIntent.STUSDS_INTENT]: 'stusds'
};

export const VaultsIntentMapping: Record<VaultsIntent, string> = {
  [VaultsIntent.MORPHO_VAULT_INTENT]: vaultModuleForVaultsIntent(VaultsIntent.MORPHO_VAULT_INTENT),
  [VaultsIntent.SKY_VAULT_INTENT]: vaultModuleForVaultsIntent(VaultsIntent.SKY_VAULT_INTENT)
};

export const ConvertIntentMapping: Record<ConvertIntent, string> = {
  [ConvertIntent.PSM_INTENT]: 'psm',
  [ConvertIntent.UPGRADE_INTENT]: 'upgrade',
  [ConvertIntent.TRADE_INTENT]: 'trade'
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

export const EXPERT_WIDGET_OPTIONS: {
  id: ExpertIntent;
  name: string;
}[] = [
  {
    id: ExpertIntent.STUSDS_INTENT,
    name: 'stUSDS'
  }
];

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

export const REFERRAL_CODE: number = Number(import.meta.env.VITE_REFERRAL_CODE) || 0;

export const BATCH_TX_LEGAL_NOTICE_URL = '/batch-transactions-legal-notice';
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
