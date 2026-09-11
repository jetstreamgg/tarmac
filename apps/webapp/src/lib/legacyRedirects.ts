import { Intent } from '@/lib/enums';
import { QueryParams } from '@/lib/constants';
import { providerForVaultModule } from '@/lib/vaults/vaultProviderMapping';
import { earnProductFilter, ROUTES } from '@/lib/routes';

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

/**
 * `?widget=` values, frozen at the spelling the pre-path app shipped.
 *
 * Deliberately string literals rather than reads of `IntentMapping`: these are
 * historical URLs that can never change, while the mapping tracks the app and
 * has already drifted once — Expert's value became 'stusds' in D7, which would
 * have silently broken `?widget=expert` had it been keyed off the mapping.
 */
const LegacyWidget = {
  Balances: 'balances',
  Savings: 'savings',
  Rewards: 'rewards',
  Stake: 'stake',
  Trade: 'trade',
  Upgrade: 'upgrade',
  Convert: 'convert',
  Expert: 'expert',
  Vaults: 'vaults',
  Fixed: 'fixed'
} as const;

/** The only `fixed_module` value the legacy scheme ever produced. */
const LEGACY_FIXED_MARKET_MODULE = 'market';

// Retired in the target IA: the widgets that consumed them are gone, so
// carrying them forward would only pollute the destination's search string.
const RETIRED_PARAMS = ['input_amount', 'linked_action'];

/**
 * Everything stripped from the destination's search string: the navigation
 * params this function consumes, plus the retired ones. `convert_module` and
 * `expert_module` are read only to be dropped — every value either of them
 * ever held now collapses into a single destination.
 */
const DROPPED_PARAMS = new Set<string>([...Object.values(LegacyParams), ...RETIRED_PARAMS]);

export type LegacyRedirect = { to: string; search: Record<string, string> };

/** The Earn marketplace, filtered to the family the legacy link asked for. */
function earnList(intent: Intent, search: Record<string, string>): LegacyRedirect {
  const product = earnProductFilter(intent);
  return {
    to: ROUTES.EARN,
    search: product ? { ...search, [QueryParams.Product]: product } : search
  };
}

/**
 * Translates pre-path-navigation URLs (?widget=...&vault_module=... etc.) into
 * their target-IA equivalents, so external deep links and bookmarks keep
 * working. Returns null when the search params carry no legacy navigation
 * state.
 *
 * This is the app's only compatibility layer, because it is the only URL scheme
 * that ever reached production: the intermediate path generations (/savings,
 * /vaults/:provider/:address, /earn/expert) shipped to prod for the first time
 * in their final form, so no link in the wild points at them.
 *
 * Entity values (reward contract, vault, market) pass through verbatim — the
 * target route's own validation handles unknown ones, and falls back to the
 * filtered marketplace the same way the bare widgets here do.
 */
export function legacySearchToLocation(search: Record<string, string>): LegacyRedirect | null {
  const widget = search[LegacyParams.Widget];
  if (widget === undefined) return null;

  const vaultModule = search[LegacyParams.VaultModule];
  const vault = search[LegacyParams.Vault];
  const fixedModule = search[LegacyParams.FixedModule];
  const market = search[LegacyParams.Market];
  const reward = search[LegacyParams.Reward];

  const rest = Object.fromEntries(Object.entries(search).filter(([key]) => !DROPPED_PARAMS.has(key)));

  switch (widget.toLowerCase()) {
    // The link named the balances module, so it goes straight to its
    // successor rather than through "/" — whose destination depends on a
    // cached per-browser hint and could land the visitor on Earn instead.
    case LegacyWidget.Balances:
      return { to: ROUTES.PORTFOLIO, search: rest };

    case LegacyWidget.Savings:
      return { to: ROUTES.EARN_SAVINGS, search: rest };

    case LegacyWidget.Stake:
      return { to: ROUTES.STAKE, search: rest };

    // Standalone trade and upgrade folded into Convert before this migration,
    // and every convert_module value (psm/trade/upgrade) collapsed into the E2
    // page-as-widget, which owns /convert outright. Upgrade's old mainnet-only
    // carve-out is gone with them: Convert is available on every supported
    // chain, so an L2 upgrade link lands on the page rather than the homepage.
    case LegacyWidget.Trade:
    case LegacyWidget.Upgrade:
    case LegacyWidget.Convert:
      return { to: ROUTES.CONVERT, search: rest };

    // The Expert module collapsed into its single product (D7), so its
    // overview and its only expert_module value share one destination.
    case LegacyWidget.Expert:
      return { to: ROUTES.EARN_STUSDS, search: rest };

    case LegacyWidget.Rewards:
      return reward
        ? { to: `${ROUTES.EARN_REWARDS}/${reward}`, search: rest }
        : earnList(Intent.REWARDS_INTENT, rest);

    case LegacyWidget.Vaults: {
      const provider = vaultModule ? providerForVaultModule(vaultModule) : undefined;
      return provider && vault
        ? { to: `${ROUTES.EARN_VAULTS}/${provider}/${vault}`, search: rest }
        : earnList(Intent.VAULTS_INTENT, rest);
    }

    // Address-based market links keep their /earn/fixed/market/:address hop —
    // that route resolves the address to the slug page details now live at.
    case LegacyWidget.Fixed:
      return fixedModule?.toLowerCase() === LEGACY_FIXED_MARKET_MODULE && market
        ? { to: `${ROUTES.EARN_FIXED}/market/${market}`, search: rest }
        : earnList(Intent.FIXED_INTENT, rest);

    // An unrecognised widget carries no intent worth honouring — the legacy
    // validator stripped it too. "/" picks the visitor's home from there.
    default:
      return { to: '/', search: rest };
  }
}
