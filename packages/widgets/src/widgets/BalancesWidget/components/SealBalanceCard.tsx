import { usePrices } from '@jetstreamgg/sky-hooks';
import { formatUnits } from 'viem';
import { CardProps } from './ModulesBalances';
import { SealBalanceWarningCard } from './SealBalanceWarningCard';

export const SealBalanceCard = ({ url, loading, sealBalance }: CardProps) => {
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const totalSealedValue =
    sealBalance && pricesData?.MKR
      ? parseFloat(formatUnits(sealBalance, 18)) * parseFloat(pricesData.MKR.price)
      : 0;

  // only show if sealed value is greater than $10
  const shouldShowSealWarning = totalSealedValue > 10;

  if (totalSealedValue === 0) {
    return null;
  }

  return (
    shouldShowSealWarning && (
      <SealBalanceWarningCard
        isLoading={loading || pricesLoading}
        sealBalance={sealBalance}
        sealValue={totalSealedValue}
        url={url}
      />
    )
  );
};
