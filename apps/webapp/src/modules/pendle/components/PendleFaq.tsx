import { getFixedYieldFaqItems } from '@/data/faqs/getFixedYieldFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function PendleFaq() {
  const faqItems = getFixedYieldFaqItems();

  return <FaqAccordion items={faqItems} />;
}
