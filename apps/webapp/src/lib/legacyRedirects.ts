import { Intent, ConvertIntent, ExpertIntent, FixedIntent } from '@/lib/enums';
import {
  ConvertIntentMapping,
  ExpertIntentMapping,
  FixedIntentMapping,
  IntentMapping,
  QueryParams
} from '@/lib/constants';
import { providerForVaultModule } from '@/lib/vaults/vaultProviderMapping';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { ROUTES } from '@/lib/routes';

// Param names of the retired query-param navigation scheme. Kept as local
// literals: they are intentionally absent from QueryParams.
const LegacyParams = {
  Widget: 'widget',
  ConvertModule: 'convert_module',
  ExpertModule: 'expert_module',
  VaultModule: 'vault_module',
  Vault: 'vault',
  FixedModule: 'fixed_module',
  Market: 'market',
  Reward: 'reward'
} as const;

export type LegacyRedirect = { to: string; search: Record<string, string> };

const CONVERT_MODULE_VALUES = Object.values(ConvertIntentMapping);

/**
 * Translates pre-path-navigation URLs (?widget=...&convert_module=... etc.)
 * into their path equivalents so external deep links and bookmarks keep
 * working. Returns null when the search params carry no legacy navigation
 * state. Entity values (reward contract, vault, market) are passed through
 * verbatim — the target route's own validation handles invalid ones.
 */
export function legacySearchToLocation(search: Record<string, string>): LegacyRedirect | null {
  const {
    [LegacyParams.Widget]: widget,
    [LegacyParams.ConvertModule]: convertModule,
    [LegacyParams.ExpertModule]: expertModule,
    [LegacyParams.VaultModule]: vaultModule,
    [LegacyParams.Vault]: vault,
    [LegacyParams.FixedModule]: fixedModule,
    [LegacyParams.Market]: market,
    [LegacyParams.Reward]: reward,
    ...rest
  } = search;

  if (widget === undefined) return null;

  let to: string;
  switch (widget.toLowerCase()) {
    case IntentMapping[Intent.SAVINGS_INTENT]:
      to = '/savings';
      break;
    case IntentMapping[Intent.STAKE_INTENT]:
      to = '/stake';
      break;
    case IntentMapping[Intent.REWARDS_INTENT]:
      to = reward ? `/rewards/${reward}` : '/rewards';
      break;
    // Standalone trade was folded into Convert before this migration.
    case IntentMapping[Intent.TRADE_INTENT]:
      to = `/convert/${ConvertIntentMapping[ConvertIntent.TRADE_INTENT]}`;
      break;
    // Standalone upgrade only maps into Convert on mainnet (parity with the
    // legacy rewrite); on other networks it was stripped, landing on Balances.
    case IntentMapping[Intent.UPGRADE_INTENT]: {
      const network = rest[QueryParams.Network];
      to =
        !network || normalizeUrlParam(network) === normalizeUrlParam('ethereum')
          ? `/convert/${ConvertIntentMapping[ConvertIntent.UPGRADE_INTENT]}`
          : '/';
      break;
    }
    case IntentMapping[Intent.CONVERT_INTENT]: {
      const module = convertModule?.toLowerCase();
      to = module && CONVERT_MODULE_VALUES.includes(module) ? `/convert/${module}` : '/convert';
      break;
    }
    case IntentMapping[Intent.EXPERT_INTENT]:
      to =
        expertModule?.toLowerCase() === ExpertIntentMapping[ExpertIntent.STUSDS_INTENT]
          ? `/expert/${ExpertIntentMapping[ExpertIntent.STUSDS_INTENT]}`
          : '/expert';
      break;
    case IntentMapping[Intent.VAULTS_INTENT]: {
      const provider = vaultModule ? providerForVaultModule(vaultModule) : undefined;
      to = provider && vault ? `/vaults/${provider}/${vault}` : '/vaults';
      break;
    }
    case IntentMapping[Intent.FIXED_INTENT]:
      to =
        fixedModule?.toLowerCase() === FixedIntentMapping[FixedIntent.MARKET_INTENT] && market
          ? `/fixed/market/${market}`
          : '/fixed';
      break;
    // balances and unknown widget values both land on the default module,
    // matching the legacy validator that stripped unrecognised widgets.
    default:
      to = '/';
      break;
  }

  return { to, search: rest };
}

// Current-generation module paths → target-IA destinations (plan §4.1).
// DORMANT: unit-tested but registered nowhere until the IA flips (Track B).
// `params` lifts entity path segments back into query-param sub-state.
type V2Redirect = { to: string; params?: (segments: string[]) => Record<string, string> };

const V2_REDIRECT_BY_MODULE: Record<string, V2Redirect> = {
  balances: { to: ROUTES.PORTFOLIO },
  savings: { to: ROUTES.EARN_SAVINGS },
  rewards: {
    to: ROUTES.EARN_REWARDS,
    params: ([reward]): Record<string, string> => (reward ? { [LegacyParams.Reward]: reward } : {})
  },
  vaults: {
    to: ROUTES.EARN_VAULTS,
    params: ([provider, vault]): Record<string, string> =>
      provider && providerForVaultModule(provider)
        ? {
            [LegacyParams.VaultModule]: provider.toLowerCase(),
            ...(vault && { [LegacyParams.Vault]: vault })
          }
        : {}
  },
  fixed: {
    to: ROUTES.EARN_FIXED,
    params: ([module, market]): Record<string, string> =>
      module?.toLowerCase() === FixedIntentMapping[FixedIntent.MARKET_INTENT] && market
        ? { [LegacyParams.FixedModule]: module.toLowerCase(), [LegacyParams.Market]: market }
        : {}
  },
  expert: {
    to: ROUTES.EARN_EXPERT,
    params: ([module]): Record<string, string> =>
      module?.toLowerCase() === ExpertIntentMapping[ExpertIntent.STUSDS_INTENT]
        ? { [LegacyParams.ExpertModule]: module.toLowerCase() }
        : {}
  },
  convert: {
    to: ROUTES.CONVERT,
    params: ([module]): Record<string, string> =>
      module && CONVERT_MODULE_VALUES.includes(module.toLowerCase())
        ? { [LegacyParams.ConvertModule]: module.toLowerCase() }
        : {}
  }
};

/**
 * Translates current module paths into their target-IA equivalents once the
 * IA flips. Returns null when the path needs no redirect. Composes after
 * legacySearchToLocation: ?widget= URLs first rewrite to a current path,
 * then this maps that path forward. Entity values pass through verbatim —
 * the target route's own validation handles invalid ones.
 */
export function legacyPathToLocation(
  pathname: string,
  search: Record<string, string> = {}
): LegacyRedirect | null {
  const segments = pathname.split('/').filter(Boolean);
  const moduleKey = segments[0]?.toLowerCase();
  const redirect = moduleKey ? V2_REDIRECT_BY_MODULE[moduleKey] : undefined;
  if (!redirect) return null;
  // Already at its destination with no sub-state to lift: nothing to do.
  if (segments.length === 1 && `/${moduleKey}` === redirect.to) return null;

  // input_amount/linked_action are retired in the new IA (plan §4.1); path-derived
  // sub-state wins over any stale incoming param.
  const preserved = Object.fromEntries(
    Object.entries(search).filter(([key]) => key !== 'input_amount' && key !== 'linked_action')
  );
  return { to: redirect.to, search: { ...preserved, ...(redirect.params?.(segments.slice(1)) ?? {}) } };
}
