import { getStUSDSFaqItems } from '../getStUSDSFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function StUSDSFaq() {
  const faqItems = getStUSDSFaqItems();

  return <FaqAccordion items={faqItems} />;
}
