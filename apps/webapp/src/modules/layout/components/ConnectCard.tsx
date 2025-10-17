import { Heading } from './Typography';
import { Button } from '@/components/ui/button';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { Trans } from '@lingui/react/macro';
import { GradientShapeCard } from '@/modules/ui/components/GradientShapeCard';
import { Intent } from '@/lib/enums';
import { useChainId } from 'wagmi';
import { getBannerById } from '@/data/banners/banners';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { base, arbitrum, optimism, unichain } from 'viem/chains';

// Type for banner configuration
type BannerConfig = {
  default: string;
  allL2s?: string;
};

export function ConnectCard({ intent, className }: { intent: Intent; className?: string }) {
  const connect = useCustomConnectModal();
  const chainId = useChainId();

  // Map intents to banner IDs - all intents have a default, some have additional variants
  const bannerIdMap: Record<Intent, BannerConfig> = {
    [Intent.BALANCES_INTENT]: { default: 'about-balances' },
    [Intent.REWARDS_INTENT]: { default: 'about-sky-token-rewards' },
    [Intent.SAVINGS_INTENT]: { default: 'about-the-sky-savings-rate' },
    [Intent.UPGRADE_INTENT]: { default: 'ready-to-upgrade-and-explore' },
    [Intent.TRADE_INTENT]: { allL2s: 'trade', default: 'about-trade' },
    [Intent.SEAL_INTENT]: { default: 'about-the-seal-engine' },
    [Intent.STAKE_INTENT]: { default: 'about-the-staking-engine' },
    [Intent.EXPERT_INTENT]: { default: 'about-expert-modules' }
  };

  // Helper function to get the appropriate banner based on context
  const getBannerForContext = (intentBannerMap: BannerConfig) => {
    // For objects with multiple banner IDs
    // Check for L2-specific banner first if on L2
    const supportedL2ChainIds = [base.id, arbitrum.id, optimism.id, unichain.id];
    if (
      intentBannerMap.allL2s &&
      chainId &&
      supportedL2ChainIds.includes(chainId as (typeof supportedL2ChainIds)[number])
    ) {
      const l2Banner = getBannerById(intentBannerMap.allL2s);
      if (l2Banner) return l2Banner;
    }

    // Fall back to default
    return intentBannerMap.default ? getBannerById(intentBannerMap.default) : null;
  };

  // Get banner content if available - bannerConfig is guaranteed to exist due to Record<Intent, BannerConfig>
  const bannerConfig = bannerIdMap[intent];
  const banner = getBannerForContext(bannerConfig);

  // Use banner title
  const heading = banner?.title || '';

  // Parse banner content - handles tooltips if present, otherwise returns plain text
  const contentText = banner?.description ? parseBannerContent(banner.description) : '';

  return (
    <GradientShapeCard
      colorLeft="radial-gradient(100% 177.78% at 100% 0%, #A273FF 0%, #4331E9 100%)"
      colorMiddle="radial-gradient(circle at 0% 100%, #FFCD6B 0%, #EB5EDF 150%)"
      colorRight="#2A197D"
      className={className}
    >
      <div className="w-[80%] space-y-2 self-start xl:w-2/3" data-testid="connect-wallet-card">
        <Heading className="mb-2">{heading}</Heading>
        {contentText}
      </div>
      <div className="mt-auto w-fit pt-3 xl:self-end xl:pt-0">
        <Button
          className="border-border"
          variant="outline"
          onClick={connect}
          data-testid="connect-wallet-card-button"
        >
          <Trans>Connect wallet</Trans>
        </Button>
      </div>
    </GradientShapeCard>
  );
}
