import { getStusdsFaqsFaqItems } from '@/data/faqs/getStusdsFaqsFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function StUSDSFaq() {
  const faqItems = getStusdsFaqsFaqItems();

  return <FaqAccordion items={faqItems} />;
}
