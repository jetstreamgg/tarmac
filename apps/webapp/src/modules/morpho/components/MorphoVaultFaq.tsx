import { getMorphoVaultFaqItems } from '@/data/faqs/getMorphoVaultFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function MorphoVaultFaq() {
  const faqItems = getMorphoVaultFaqItems();

  return <FaqAccordion items={faqItems} />;
}
