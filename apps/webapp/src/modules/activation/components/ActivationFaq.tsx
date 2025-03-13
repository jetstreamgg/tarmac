import { getActivationFaqItems } from '../getActivationFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function ActivationFaq() {
  const faqItems = getActivationFaqItems();

  return <FaqAccordion items={faqItems} />;
}
