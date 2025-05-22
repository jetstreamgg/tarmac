import { getStakeFaqItems } from '../getStakeFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function StakeFaq() {
  const faqItems = getStakeFaqItems();

  return <FaqAccordion items={faqItems} />;
}
