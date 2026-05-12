import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCard } from '@widgets/shared/components/ui/card/InteractiveStatsCard';
import { InteractiveStatsCardAlt } from '@widgets/shared/components/ui/card/InteractiveStatsCardAlt';
import { CardProps, ModuleCardVariant } from './ModulesBalances';

export const FixedYieldBalanceCard = ({
  url,
  loading,
  variant = ModuleCardVariant.default,
  hideZeroBalances = false
}: CardProps & { hideZeroBalances?: boolean }) => {
  const dummyBalance = '5.0000';
  const dummyRate = '7.25%';
  const dummyUsd = '$5.00';

  const fixedYieldIcon = (
    <img src="/images/pendle_icon_large.svg" alt="Fixed Yield" className="h-full w-full" />
  );

  return variant === ModuleCardVariant.default ? (
    <InteractiveStatsCard
      title={t`Supplied to Fixed Yield`}
      icon={fixedYieldIcon}
      headerRightContent={<Text>{dummyBalance}</Text>}
      footer={
        <Text variant="small" className="text-bullish">
          {t`Rate: ${dummyRate}`}
        </Text>
      }
      footerRightContent={
        <Text variant="small" className="text-textSecondary">
          {dummyUsd}
        </Text>
      }
      url={url}
    />
  ) : (
    <InteractiveStatsCardAlt
      title={t`Supplied to Fixed Yield`}
      icon={fixedYieldIcon}
      url={url}
      logoName="fixedYield"
      content={<Text>{dummyBalance} USDS</Text>}
    />
  );
};
