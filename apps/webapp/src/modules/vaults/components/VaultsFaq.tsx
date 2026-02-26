import { getVaultsFaqItems } from '@/data/faqs/getVaultsFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function VaultsFaq() {
  const faqItems = getVaultsFaqItems();

  return <FaqAccordion items={faqItems} />;
}
