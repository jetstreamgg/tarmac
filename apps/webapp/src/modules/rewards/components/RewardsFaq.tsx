import { RewardContract } from '@jetstreamgg/sky-hooks';
import { getRewardsFaqItems } from '@/data/faqs/getRewardsFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';
import { getRewardsCleFaqItems } from '@/data/faqs/getRewardsCleFaqItems';
import { getRewardsSpkFaqItems } from '@/data/faqs/getRewardsSpkFaqItems';

export function RewardsFaq({ rewardContract }: { rewardContract?: RewardContract }) {
  const isRestricted = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const faqItems =
    rewardContract?.rewardToken.symbol === 'CLE'
      ? getRewardsCleFaqItems().filter(({ type }) => !isRestricted || type !== 'restricted')
      : rewardContract?.rewardToken.symbol === 'SPK'
        ? getRewardsSpkFaqItems().filter(({ type }) => !isRestricted || type !== 'restricted')
        : getRewardsFaqItems().filter(({ type }) => !isRestricted || type !== 'restricted');

  return <FaqAccordion items={faqItems} />;
}
