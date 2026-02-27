import {
  usePrices,
  useMorphoVaultsCombinedTvl,
  useMorphoVaultsCombinedUserData
} from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCard } from '@widgets/shared/components/ui/card/InteractiveStatsCard';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatUnits } from 'viem';
import { ModuleCardVariant } from './ModulesBalances';
import { RateLineWithArrow } from '@widgets/shared/components/ui/RateLineWithArrow';
import { InteractiveStatsCardAlt } from '@widgets/shared/components/ui/card/InteractiveStatsCardAlt';

export const VaultsBalanceCard = ({
  url,
  onExternalLinkClicked,
  variant = ModuleCardVariant.default
}: {
  url?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  variant?: ModuleCardVariant;
}) => {
  // Fetch combined user balance across all vaults
  const { totalUserAssets, isLoading: userDataLoading } = useMorphoVaultsCombinedUserData();

  // Fetch max rate across all vaults
  const { maxRate: morphoMaxRate, formattedMaxRate, isLoading: morphoRatesLoading } = useMorphoVaultsCombinedTvl();

  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const isBalanceLoading = userDataLoading;
  const isRateLoading = morphoRatesLoading;

  const vaultsIcon = <img src="/images/vaults_icon_large.svg" alt="Vaults" className="h-full w-full" />;

  return variant === ModuleCardVariant.default ? (
    <InteractiveStatsCard
      title={t`Supplied to Vaults`}
      icon={vaultsIcon}
      headerRightContent={
        isBalanceLoading || pricesLoading ? (
          <Skeleton className="w-32" />
        ) : totalUserAssets > 0n && !!pricesData?.USDS ? (
          <Text>
            $
            {formatNumber(
              parseFloat(formatUnits(totalUserAssets, 18)) * parseFloat(pricesData.USDS.price),
              {
                maxDecimals: 2
              }
            )}
          </Text>
        ) : (
          <Text>$0</Text>
        )
      }
      footer={
        isRateLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : morphoMaxRate > 0 ? (
          <RateLineWithArrow
            rateText={t`Rates up to: ${formattedMaxRate}`}
            popoverType="expert"
            onExternalLinkClicked={onExternalLinkClicked}
          />
        ) : (
          <></>
        )
      }
      footerRightContent={undefined}
      url={url}
    />
  ) : (
    <InteractiveStatsCardAlt
      title={t`Supplied to Vaults`}
      url={url}
      logoName="vaults"
      content={
        isBalanceLoading || pricesLoading ? (
          <Skeleton className="w-32" />
        ) : totalUserAssets > 0n && !!pricesData?.USDS ? (
          <Text>
            $
            {formatNumber(
              parseFloat(formatUnits(totalUserAssets, 18)) * parseFloat(pricesData.USDS.price),
              {
                maxDecimals: 2
              }
            )}
          </Text>
        ) : (
          <Text>$0</Text>
        )
      }
    />
  );
};
