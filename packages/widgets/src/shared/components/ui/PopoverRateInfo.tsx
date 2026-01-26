import {
  Popover,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverTrigger
} from '@widgets/components/ui/popover';
import { Close } from '../icons/Close';
import { Info } from '../icons/Info';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { getTooltipById } from '@widgets/data/tooltips';
import { parseMarkdownLinks } from '@widgets/shared/utils/parseMarkdownLinks';
import { cn } from '@widgets/lib/utils';

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
  morpho: 'morpho-rate',
  stusdsLiquidity: 'available-liquidity',
  morphoLiquidity: 'morpho-liquidity',
  totalStakingDebt: 'total-staking-engine-debt',
  delayedUpgradePenalty: 'delayed-upgrade-penalty',
  remainingCapacity: 'remaining-capacity',
  withdrawalLiquidity: 'withdrawal-liquidity',
  maximumCapacity: 'maximum-capacity'
} as const;

// Helper to create tooltip content with consistent styling
const createTooltipContent = (
  tooltipId: string,
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void
) => {
  const tooltip = getTooltipById(tooltipId);
  return {
    title: tooltip?.title || '',
    description: (
      <Text variant="small" className="leading-5 text-white/80">
        {parseMarkdownLinks(tooltip?.tooltip, onExternalLinkClicked)}
      </Text>
    )
  };
};

const getContent = (onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void) => {
  return Object.entries(TOOLTIP_ID_MAP).reduce(
    (acc, [key, tooltipId]) => {
      acc[key as keyof typeof TOOLTIP_ID_MAP] = createTooltipContent(tooltipId, onExternalLinkClicked);
      return acc;
    },
    {} as Record<keyof typeof TOOLTIP_ID_MAP, { title: string; description: React.ReactElement }>
  );
};

// Export the valid tooltip types as a runtime constant derived from the map
export const POPOVER_TOOLTIP_TYPES = Object.keys(TOOLTIP_ID_MAP) as (keyof typeof TOOLTIP_ID_MAP)[];

// Derive the type from the map
export type PopoverTooltipType = keyof typeof TOOLTIP_ID_MAP;

export const PopoverRateInfo = ({
  type,
  onExternalLinkClicked,
  iconClassName,
  width = 16,
  height = 15,
  popoverClassName
}: {
  type: PopoverTooltipType;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  iconClassName?: string;
  width?: number;
  height?: number;
  popoverClassName?: string;
}) => {
  const content = getContent(onExternalLinkClicked);

  if (!(type in content)) return null;

  return (
    <Popover>
      <PopoverTrigger asChild onClick={e => e.stopPropagation()} className="z-10">
        <span className="inline-flex cursor-pointer items-center">
          <Info className={iconClassName} width={width} height={height} />
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        className={cn('bg-containerDark w-80 rounded-xl backdrop-blur-[50px]', popoverClassName)}
      >
        <Heading variant="small" className="text-[16px] leading-6">
          {content[type].title}
        </Heading>
        <PopoverClose onClick={e => e.stopPropagation()} className="absolute top-4 right-4 z-10">
          <Close className="h-5 w-5 cursor-pointer text-white" />
        </PopoverClose>
        <div
          className="scrollbar-thin mt-2 max-h-[calc(var(--radix-popover-content-available-height)-64px)] overflow-y-auto"
          // The `onWheel` and `onTouchMove` stopPropagation handlers allow to scroll through the popover
          // content when rendered on top of another focus capturing elements, like modals.
          onWheel={e => {
            e.stopPropagation();
          }}
          onTouchMove={e => {
            e.stopPropagation();
          }}
        >
          {content[type].description}
        </div>
        <PopoverArrow />
      </PopoverContent>
    </Popover>
  );
};
