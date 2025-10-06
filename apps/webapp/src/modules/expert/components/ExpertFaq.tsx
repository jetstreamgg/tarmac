import { getExpertModulesFaqsFaqItems } from '@/data/faqs/getExpertModulesFaqsFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function ExpertFaq() {
  const faqItems = getExpertModulesFaqsFaqItems();

  return <FaqAccordion items={faqItems} />;
}
