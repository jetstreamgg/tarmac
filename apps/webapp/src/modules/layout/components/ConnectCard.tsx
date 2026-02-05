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
import { useSearchParams } from 'react-router-dom';
import { useSendMessage } from '@/modules/chat/hooks/useSendMessage';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { Chat } from '@/modules/icons';
import { CHATBOT_ABOUT_CARD_ASK_ENABLED, QueryParams } from '@/lib/constants';
import { t } from '@lingui/core/macro';
import { useBreakpointIndex, BP } from '@/modules/ui/hooks/useBreakpointIndex';
import { useIsTouchDevice } from '@jetstreamgg/sky-utils';

// Type for banner configuration
type BannerConfig = {
  default: string;
  allL2s?: string;
};

export function ConnectCard({ intent, className }: { intent: Intent; className?: string }) {
  const connect = useCustomConnectModal();
  const chainId = useChainId();
  const [, setSearchParams] = useSearchParams();
  const { sendMessage } = useSendMessage();
  const { isLoading } = useChatContext();
  const { bpi } = useBreakpointIndex();
  const isTouch = useIsTouchDevice();
  const isTouchMobileOrTablet = isTouch && bpi < BP.lg;

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

  // Custom chat labels for intents where the banner title doesn't make a good question
  const chatLabelOverrides: Partial<Record<Intent, string>> = {
    [Intent.UPGRADE_INTENT]: 'the Upgrade module'
  };

  // Use custom label if available, otherwise use the banner heading (stripping "About " prefix to avoid duplication)
  const chatLabel = chatLabelOverrides[intent] || heading.replace(/^About /, '');

  const handleAskAboutModule = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Open chat pane via URL param
    setSearchParams(prevParams => {
      prevParams.set(QueryParams.Chat, 'true');
      return prevParams;
    });

    // Send question using the chat label
    setTimeout(() => {
      sendMessage(t`Tell me about ${chatLabel}`);
    }, 100);
  };

  return (
    <div className="group/connect">
      <GradientShapeCard
        colorLeft="radial-gradient(100% 177.78% at 100% 0%, #A273FF 0%, #4331E9 100%)"
        colorMiddle="radial-gradient(circle at 0% 100%, #FFCD6B 0%, #EB5EDF 150%)"
        colorRight="#2A197D"
        className={className}
      >
        {/* Chat icon - top right corner, always visible on touch, hover on desktop */}
        {CHATBOT_ABOUT_CARD_ASK_ENABLED && chatLabel && (
          <button
            type="button"
            onClick={handleAskAboutModule}
            disabled={isLoading}
            className={`absolute top-4 right-3 z-20 rounded-md p-1.5 transition-opacity hover:bg-white/10 disabled:cursor-not-allowed xl:right-6 ${
              isTouchMobileOrTablet
                ? 'opacity-100'
                : 'pointer-events-none opacity-0 group-hover/connect:pointer-events-auto group-hover/connect:opacity-100'
            }`}
            title={t`Ask about ${chatLabel}`}
          >
            <Chat className="text-textSecondary h-4 w-4" />
          </button>
        )}
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
    </div>
  );
}
