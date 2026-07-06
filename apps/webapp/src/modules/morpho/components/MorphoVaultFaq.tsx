import { getVaultsFaqItems } from '@/data/faqs/getVaultsFaqItems';
import { getTetherSavingsFaqItems } from '@/data/faqs/getTetherSavingsFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';
import { VaultProvider } from '@/hooks';

export function MorphoVaultFaq({ provider = 'morpho' }: { provider?: VaultProvider }) {
  // Spark/Tether vaults are Sky products, not Morpho — show their own FAQ instead of the Morpho one.
  const faqItems = provider === 'sky' ? getTetherSavingsFaqItems() : getVaultsFaqItems();

  return <FaqAccordion items={faqItems} />;
}
