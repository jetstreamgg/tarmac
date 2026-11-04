import { InfoTooltip } from '@/components/InfoTooltip';
import { getTooltipById } from '@/modules/ui/data/tooltips';
import { parseMarkdownLinks } from '@/modules/ui/lib/parseMarkdownLinks';

// Mapping of popover types to tooltip IDs
const TOOLTIP_ID_MAP = {
  str: 'rewards-rate',
  ssr: 'sky-savings-rate',
  srr: 'staking-rewards-rates-srrs',
  dtc: 'debt-ceiling',
  sbr: 'borrow-rate',
  psm: 'psm',
  stakingRewards: 'staking-rewards',
  borrow: 'borrow',
  delegate: 'choose-your-delegate',
  liquidation: 'liquidation-price',
  stusds: 'stusds-rate',
  morpho: 'vault-rate',
  vaultsAggregate: 'vault-rates',
  expert: 'stusds-rate',
  stusdsLiquidity: 'available-liquidity',
  morphoLiquidity: 'morpho-liquidity',
  totalStakingDebt: 'total-staking-engine-debt',
  delayedUpgradePenalty: 'delayed-upgrade-penalty',
  remainingCapacity: 'remaining-capacity',
  withdrawalLiquidity: 'withdrawal-liquidity',
  maximumCapacity: 'maximum-capacity',
  fixedYield: 'fixed-yield-rate',
  cappedOsmSkyPrice: 'capped-osm-sky-price',
  earnRates: 'earn-rates',
  earnRates30d: 'earn-rates-30d'
} as const;

type TooltipOverride = {
  title?: string;
  description?: string;
};

// Derive the type from the map
export type PopoverTooltipType = keyof typeof TOOLTIP_ID_MAP;

/** Full tooltip id behind a short key, for app-side readers of the same copy. */
export const resolveTooltipId = (type: PopoverTooltipType): string => TOOLTIP_ID_MAP[type];

// Accepts short keys ("ssr") or full ids ("sky-savings-rate").
export function resolvePopoverTooltipKey(raw: string): PopoverTooltipType | undefined {
  if (raw in TOOLTIP_ID_MAP) return raw as PopoverTooltipType;
  return Object.entries(TOOLTIP_ID_MAP).find(([, fullId]) => fullId === raw)?.[0] as
    PopoverTooltipType | undefined;
}

/**
 * The centralized explainer for a rate/term key, on the design-system Tooltip
 * (Default type: title over body) — hover on pointer devices, tap on touch.
 */
export const PopoverRateInfo = ({
  type,
  tooltipOverride,
  iconClassName,
  width = 16,
  trigger
}: {
  type: PopoverTooltipType;
  tooltipOverride?: TooltipOverride;
  iconClassName?: string;
  /** Glyph size in px. */
  width?: number;
  /**
   * Custom trigger rendered in place of the info glyph (e.g. a whole rate
   * badge). Must be a single focusable element that accepts a ref.
   */
  trigger?: React.ReactElement;
}) => {
  if (!(type in TOOLTIP_ID_MAP)) return null;

  const tooltip = getTooltipById(TOOLTIP_ID_MAP[type]);
  const title = tooltipOverride?.title ?? tooltip?.title ?? '';
  const description = tooltipOverride?.description ?? tooltip?.tooltip;
  // No copy, no empty tooltip: a custom trigger (e.g. the rate pill) still renders bare.
  if (!description) return trigger ?? null;

  return (
    <InfoTooltip
      title={title}
      content={parseMarkdownLinks(description)}
      iconSize={width}
      iconClassName={iconClassName}
      trigger={trigger}
    />
  );
};
