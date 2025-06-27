import { RewardContract } from '@jetstreamgg/sky-hooks';
import { getRewardsFaqItems } from '../lib/getRewardsFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';
import { getRewardsCleFaqItems } from '../lib/getRewardsCleFaqItems';
import { useChainId } from 'wagmi';
import { getRewardsSpkFaqItems } from '../lib/getRewardsSpkFaqItems';

export function RewardsFaq({ rewardContract }: { rewardContract?: RewardContract }) {
  const chainId = useChainId();
  const isRestricted = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const faqItems =
    rewardContract?.rewardToken.symbol === 'CLE'
      ? getRewardsCleFaqItems(chainId).filter(({ type }) => !isRestricted || type !== 'restricted')
      : rewardContract?.rewardToken.symbol === 'SPK'
        ? getRewardsSpkFaqItems().filter(({ type }) => !isRestricted || type !== 'restricted')
        : getRewardsFaqItems(chainId).filter(({ type }) => !isRestricted || type !== 'restricted');

  return <FaqAccordion items={faqItems} />;
}
