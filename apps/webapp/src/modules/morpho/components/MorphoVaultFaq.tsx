import { getVaultsFaqItems } from '@/data/faqs/getVaultsFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function MorphoVaultFaq() {
  const faqItems = getVaultsFaqItems();

  return <FaqAccordion items={faqItems} />;
}
