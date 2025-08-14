import { RewardContract } from '@jetstreamgg/sky-hooks';
import { getRewardsFaqItems } from '@/data/faqs/getRewardsFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';
import { getRewardsCleFaqItems } from '@/data/faqs/getRewardsCleFaqItems';
import { getRewardsSpkFaqItems } from '@/data/faqs/getRewardsSpkFaqItems';

export function RewardsFaq({ rewardContract }: { rewardContract?: RewardContract }) {
  const faqItems =
    rewardContract?.rewardToken.symbol === 'CLE'
      ? getRewardsCleFaqItems()
      : rewardContract?.rewardToken.symbol === 'SPK'
        ? getRewardsSpkFaqItems()
        : getRewardsFaqItems();

  return <FaqAccordion items={faqItems} />;
}
