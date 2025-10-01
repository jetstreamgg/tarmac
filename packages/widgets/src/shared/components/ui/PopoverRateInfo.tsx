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

const getContent = (onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void) => {
  // Get tooltips from centralized system
  const rewardsRateTooltip = getTooltipById('rewards-rate');
  const rateTooltip = getTooltipById('rate');
  const borrowRateTooltip = getTooltipById('borrow-rate');
  const debtCeilingTooltip = getTooltipById('debt-ceiling');
  const psmTooltip = getTooltipById('psm');
  const borrowTooltip = getTooltipById('borrow');
  const delegateTooltip = getTooltipById('choose-your-delegate');
  const liquidationTooltip = getTooltipById('liquidation-price');
  const delayedUpgradeTooltip = getTooltipById('delayed-upgrade-penalty');
  const stakingRewardsRateSrrsTooltip = getTooltipById('staking-rewards-rates-srrs');
  const stUsdsRateTooltip = getTooltipById('stusds-rate');
  const availableLiquidityTooltip = getTooltipById('available-liquidity');
  const totalStakingEngineDebtTooltip = getTooltipById('total-staking-engine-debt');

  return {
    str: {
      title: rewardsRateTooltip?.title || '',
      description: (
        <Text variant="small" className="leading-5 text-white/80">
          {parseMarkdownLinks(rewardsRateTooltip?.tooltip, onExternalLinkClicked)}
        </Text>
      )
    },
    ssr: {
      title: rateTooltip?.title || '',
      description: (
        <Text variant="small" className="leading-5 text-white/80">
          {parseMarkdownLinks(rateTooltip?.tooltip, onExternalLinkClicked)}
        </Text>
      )
    },
    srr: {
      title: stakingRewardsRateSrrsTooltip?.title || '',
      description: (
        <Text variant="small" className="leading-5 text-white/80">
          {rateTooltip?.tooltip || ''}
        </Text>
      )
    },
    dtc: {
      title: debtCeilingTooltip?.title || '',
      description: (
        <Text className="leading-5 text-white/80" variant="small">
          {parseMarkdownLinks(debtCeilingTooltip?.tooltip, onExternalLinkClicked)}
        </Text>
      )
    },
    sbr: {
      title: borrowRateTooltip?.title || '',
      description: (
        <Text className="leading-5 text-white/80" variant="small">
          {parseMarkdownLinks(borrowRateTooltip?.tooltip, onExternalLinkClicked)}
        </Text>
      )
    },
    psm: {
      title: psmTooltip?.title || '',
      description: (
        <Text className="leading-5 text-white/80" variant="small">
          {parseMarkdownLinks(psmTooltip?.tooltip, onExternalLinkClicked)}
        </Text>
      )
    },
    stakingRewards: {
      title: 'Staking Rewards',
      description: (
        <Text className="leading-5 text-white/80" variant="small">
          Staking Rewards can be accessed when SKY is supplied to the Staking Engine of the decentralized,
          non-custodial Sky Protocol. Currently, all Staking Rewards take the form of USDS. Staking Reward
          rates are determined by Sky Ecosystem Governance through the process of decentralized onchain
          voting.
        </Text>
      )
    },
    borrow: {
      title: borrowTooltip?.title || '',
      description: (
        <Text className="leading-5 text-white/80" variant="small">
          {parseMarkdownLinks(borrowTooltip?.tooltip, onExternalLinkClicked)}
        </Text>
      )
    },
    delegate: {
      title: delegateTooltip?.title || '',
      description: (
        <Text className="leading-5 text-white/80" variant="small">
          {parseMarkdownLinks(delegateTooltip?.tooltip, onExternalLinkClicked)}
        </Text>
      )
    },
    liquidation: {
      title: liquidationTooltip?.title || '',

      description: (
        <Text className="leading-5 text-white/80" variant="small">
          {parseMarkdownLinks(liquidationTooltip?.tooltip, onExternalLinkClicked)}
        </Text>
      )
    },
    stusds: {
      title: stUsdsRateTooltip?.title || '',
      description: (
        <Text className="leading-5 text-white/80" variant="small">
          {parseMarkdownLinks(stUsdsRateTooltip?.tooltip, onExternalLinkClicked)}
        </Text>
      )
    },
    stusdsLiquidity: {
      title: availableLiquidityTooltip?.title || '',
      description: (
        <Text className="leading-5 text-white/80" variant="small">
          {parseMarkdownLinks(availableLiquidityTooltip?.tooltip, onExternalLinkClicked)}
        </Text>
      )
    },
    totalStakingDebt: {
      title: totalStakingEngineDebtTooltip?.title || '',
      description: (
        <Text className="leading-5 text-white/80" variant="small">
          {parseMarkdownLinks(totalStakingEngineDebtTooltip?.tooltip, onExternalLinkClicked)}
        </Text>
      )
    },
    delayedUpgradePenalty: {
      title: delayedUpgradeTooltip?.title || '',
      description: (
        <Text className="leading-5 text-white/80" variant="small">
          {parseMarkdownLinks(delayedUpgradeTooltip?.tooltip, onExternalLinkClicked)}
        </Text>
      )
    }
  };
};

// Export the valid tooltip types as a runtime constant
export const POPOVER_TOOLTIP_TYPES = [
  'str',
  'ssr',
  'sbr',
  'srr',
  'dtc',
  'psm',
  'stakingRewards',
  'borrow',
  'delegate',
  'liquidation',
  'stusds',
  'stusdsLiquidity',
  'totalStakingDebt',
  'delayedUpgradePenalty'
] as const;

// Derive the type from the constant
export type PopoverTooltipType = (typeof POPOVER_TOOLTIP_TYPES)[number];

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
        <PopoverClose onClick={e => e.stopPropagation()} className="absolute right-4 top-4 z-10">
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
