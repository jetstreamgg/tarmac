import { getOneToOneConversionFaqItems } from '@/data/faqs/getOneToOneConversionFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function PsmConversionFaq() {
  const faqItems = getOneToOneConversionFaqItems();

  return <FaqAccordion items={faqItems} />;
}
