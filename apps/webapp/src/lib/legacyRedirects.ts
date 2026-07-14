import { Intent, FixedIntent } from '@/lib/enums';
import { FixedIntentMapping, IntentMapping, QueryParams } from '@/lib/constants';
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
    [LegacyParams.ExpertModule]: expertModule,
    [LegacyParams.VaultModule]: vaultModule,
    [LegacyParams.Vault]: vault,
    [LegacyParams.FixedModule]: fixedModule,
    [LegacyParams.Market]: market,
    [LegacyParams.Reward]: reward,
    ...rest
  } = search;

  if (widget === undefined) return null;

  // convert_module is consumed but no longer routes anywhere: every legacy
  // convert module lands on the single E2 page.
  delete rest[LegacyParams.ConvertModule];

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
    // Standalone trade was folded into Convert before this migration; the E2
    // page-as-widget owns /convert outright (trade/upgrade surfaces are parked),
    // so both generations land on the page itself — no sub-path hop.
    case IntentMapping[Intent.TRADE_INTENT]:
      to = ROUTES.CONVERT;
      break;
    // Standalone upgrade only mapped into Convert on mainnet (parity with the
    // legacy rewrite); on other networks it was stripped, landing on Balances.
    case IntentMapping[Intent.UPGRADE_INTENT]: {
      const network = rest[QueryParams.Network];
      to = !network || normalizeUrlParam(network) === normalizeUrlParam('ethereum') ? ROUTES.CONVERT : '/';
      break;
    }
    case IntentMapping[Intent.CONVERT_INTENT]:
      to = ROUTES.CONVERT;
      break;
    // The historical ?widget= value stays 'expert' (frozen in old links) even
    // though the module now maps to 'stusds'; both generations land on the
    // flattened /earn/stusds via V2_REDIRECT_BY_MODULE.
    case 'expert':
      to = expertModule?.toLowerCase() === 'stusds' ? '/expert/stusds' : '/expert';
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

// Pre-flip module paths → target-IA destinations (plan §4.1). The modules kept
// their entity path params when they moved under /earn, so `subpath` carries
// recognised entity segments across; unrecognised ones drop to the overview.
// Convert needs no entry: its paths survived the flip unchanged.
type V2Redirect = { to: string; subpath?: (segments: string[]) => string[] };

const V2_REDIRECT_BY_MODULE: Record<string, V2Redirect> = {
  balances: { to: ROUTES.PORTFOLIO },
  savings: { to: ROUTES.EARN_SAVINGS },
  rewards: {
    to: ROUTES.EARN_REWARDS,
    subpath: ([reward]): string[] => (reward ? [reward] : [])
  },
  vaults: {
    to: ROUTES.EARN_VAULTS,
    subpath: ([provider, vault]): string[] =>
      // The vault detail route needs both segments; a bare provider has no target.
      provider && vault && providerForVaultModule(provider) ? [provider.toLowerCase(), vault] : []
  },
  // Market deep links keep their /earn/fixed/market/:address hop (that route
  // forwards to the slug page); the bare path chains through /earn/fixed,
  // whose index forwards to /earn (G6 — no overview screen, like rewards/D6).
  fixed: {
    to: ROUTES.EARN_FIXED,
    subpath: ([module, market]): string[] =>
      module?.toLowerCase() === FixedIntentMapping[FixedIntent.MARKET_INTENT] && market
        ? [module.toLowerCase(), market]
        : []
  },
  // Both the old overview (/expert) and the old detail (/expert/stusds) land
  // on the flattened product page — the Expert module has exactly one product.
  expert: { to: ROUTES.EARN_STUSDS }
};

/**
 * Translates pre-flip module paths into their target-IA equivalents. Returns
 * null when the path needs no redirect. Composes after legacySearchToLocation:
 * ?widget= URLs first rewrite to a pre-flip path, then this maps that path
 * forward. Entity values pass through verbatim — the target route's own
 * validation handles invalid ones.
 */
export function legacyPathToLocation(
  pathname: string,
  search: Record<string, string> = {}
): LegacyRedirect | null {
  const segments = pathname.split('/').filter(Boolean);
  const moduleKey = segments[0]?.toLowerCase();
  const redirect = moduleKey ? V2_REDIRECT_BY_MODULE[moduleKey] : undefined;
  if (!redirect) return null;

  const subpath = redirect.subpath?.(segments.slice(1)) ?? [];
  const to = [redirect.to, ...subpath].join('/');
  // input_amount/linked_action are retired in the new IA (plan §4.1).
  const preserved = Object.fromEntries(
    Object.entries(search).filter(([key]) => key !== 'input_amount' && key !== 'linked_action')
  );
  return { to, search: preserved };
}
