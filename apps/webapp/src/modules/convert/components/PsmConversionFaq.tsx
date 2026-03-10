import { useChainId } from 'wagmi';
import { getPsmConversionFaqItems } from '@/data/faqs/getPsmConversionFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function PsmConversionFaq() {
  const chainId = useChainId();
  const faqItems = getPsmConversionFaqItems(chainId);

  return <FaqAccordion items={faqItems} />;
}
