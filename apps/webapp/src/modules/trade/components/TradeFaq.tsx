import { useChainId } from 'wagmi';
import { getTradeFaqItems } from '@/data/faqs/getTradeFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function TradeFaq() {
  const chainId = useChainId();
  const faqItems = getTradeFaqItems(chainId);

  return <FaqAccordion items={faqItems} />;
}
