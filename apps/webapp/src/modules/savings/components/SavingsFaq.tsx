import { useAccount, useChainId } from 'wagmi';
import { getSavingsFaqItems } from '../getSavingsFaqItems';
import { FaqAccordion } from '@/modules/ui/components/FaqAccordion';

export function SavingsFaq() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const faqItems = getSavingsFaqItems(chainId, isConnected);

  return <FaqAccordion items={faqItems} />;
}
