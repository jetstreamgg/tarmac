import {
  Popover,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverTrigger
} from '@/widgets/components/ui/popover';
import { Close } from '../icons/Close';
import { Info } from '../icons/Info';
import { Heading, Text } from '@/widgets/shared/components/ui/Typography';
import { getTooltipById } from '@/widgets/data/tooltips';
import { parseMarkdownLinks } from '@/widgets/shared/utils/parseMarkdownLinks';
import { cn } from '@/widgets/lib/utils';

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
  sky: 'susdt-vault-rate',
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

type TooltipContent = {
  title: string;
  description: React.ReactElement;
};

type TooltipOverride = {
  title?: string;
  description?: string;
};

// Helper to create tooltip content with consistent styling
const createTooltipContent = (tooltipId: string): TooltipContent => {
  const tooltip = getTooltipById(tooltipId);
  return {
    title: tooltip?.title || '',
    description: (
      <Text variant="small" className="light:text-textSecondary leading-5 text-white/80">
        {parseMarkdownLinks(tooltip?.tooltip)}
      </Text>
    )
  };
};

const getContent = () => {
  return Object.entries(TOOLTIP_ID_MAP).reduce(
    (acc, [key, tooltipId]) => {
      acc[key as keyof typeof TOOLTIP_ID_MAP] = createTooltipContent(tooltipId);
      return acc;
    },
    {} as Record<keyof typeof TOOLTIP_ID_MAP, TooltipContent>
  );
};

// Export the valid tooltip types as a runtime constant derived from the map
export const POPOVER_TOOLTIP_TYPES = Object.keys(TOOLTIP_ID_MAP) as (keyof typeof TOOLTIP_ID_MAP)[];

// Derive the type from the map
export type PopoverTooltipType = keyof typeof TOOLTIP_ID_MAP;

// Accepts short keys ("ssr") or full ids ("sky-savings-rate").
export function resolvePopoverTooltipKey(raw: string): PopoverTooltipType | undefined {
  if (raw in TOOLTIP_ID_MAP) return raw as PopoverTooltipType;
  return Object.entries(TOOLTIP_ID_MAP).find(([, fullId]) => fullId === raw)?.[0] as
    PopoverTooltipType | undefined;
}

export const PopoverRateInfo = ({
  type,
  tooltipOverride,
  iconClassName,
  width = 16,
  height = 15,
  popoverClassName,
  trigger
}: {
  type: PopoverTooltipType;
  tooltipOverride?: TooltipOverride;
  iconClassName?: string;
  width?: number;
  height?: number;
  popoverClassName?: string;
  /**
   * Custom trigger rendered in place of the info glyph (e.g. a whole rate
   * badge). Must be a single element that accepts a ref and click handler.
   */
  trigger?: React.ReactElement;
}) => {
  const content = getContent();

  if (!(type in content)) return null;

  const defaultContent = content[type];
  const resolvedTitle = tooltipOverride?.title ?? defaultContent.title;
  const resolvedDescription = tooltipOverride?.description ? (
    <Text variant="small" className="light:text-textSecondary leading-5 text-white/80">
      {parseMarkdownLinks(tooltipOverride.description)}
    </Text>
  ) : (
    defaultContent.description
  );

  return (
    <Popover>
      <PopoverTrigger asChild onClick={e => e.stopPropagation()} className="z-10">
        {trigger ?? (
          <span className="inline-flex cursor-pointer items-center">
            <Info className={iconClassName} width={width} height={height} />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        className={cn('bg-containerDark w-80 rounded-xl backdrop-blur-[50px]', popoverClassName)}
      >
        <Heading variant="small" className="text-[16px] leading-6">
          {resolvedTitle}
        </Heading>
        <PopoverClose onClick={e => e.stopPropagation()} className="absolute top-4 right-4 z-10">
          <Close className="text-text h-5 w-5 cursor-pointer" />
        </PopoverClose>
        <div
          className="mt-2 max-h-[calc(var(--radix-popover-content-available-height)-64px)] overflow-y-auto"
          // The `onWheel` and `onTouchMove` stopPropagation handlers allow to scroll through the popover
          // content when rendered on top of another focus capturing elements, like modals.
          onWheel={e => {
            e.stopPropagation();
          }}
          onTouchMove={e => {
            e.stopPropagation();
          }}
        >
          {resolvedDescription}
        </div>
        <PopoverArrow />
      </PopoverContent>
    </Popover>
  );
};
