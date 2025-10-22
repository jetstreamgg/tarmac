import React from 'react';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@widgets/components/ui/tabs';
import { Token, useOverallSkyData, getTokenDecimals, useSsrAssetsToShares } from '@jetstreamgg/sky-hooks';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { t } from '@lingui/core/macro';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { L2SavingsStatsCard } from './L2SavingsStatsCard';
import { formatBigInt, formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';

type Props = WidgetProps & {
  leftTabTitle: string;
  rightTabTitle: string;
  originAmount: bigint;
  originBalance: bigint;
  originToken: Token;
  originOptions?: Token[];
  convertedBalance?: {
    value: bigint;
    formatted: string;
  };
  tabIndex: 0 | 1;
  error?: boolean;
  onToggle: (number: 0 | 1) => void;
  onOriginInputChange: (val: bigint, userTriggered?: boolean) => void;
  onMenuItemChange?: (token: Token) => void;
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  setMaxWithdraw?: (val: boolean) => void;
};

export function L2SavingsSupplyWithdraw({
  leftTabTitle,
  rightTabTitle,
  originToken,
  originOptions,
  originAmount,
  originBalance,
  convertedBalance,
  tabIndex,
  error,
  onToggle,
  onOriginInputChange,
  onMenuItemChange,
  onExternalLinkClicked,
  setMaxWithdraw,
  isConnectedAndEnabled = true
}: Props): React.ReactElement {
  const { data: overallSkyData } = useOverallSkyData();
  const chainId = useChainId();
  const skySavingsRatecRate = overallSkyData?.skySavingsRatecRate
    ? formatDecimalPercentage(parseFloat(overallSkyData.skySavingsRatecRate))
    : '0%';

  const finalBalance =
    tabIndex === 0 ? (originBalance || 0n) - originAmount : (originBalance || 0n) + originAmount;
  const finalSavingsBalance =
    tabIndex === 0
      ? (convertedBalance?.value || 0n) + originAmount
      : (convertedBalance?.value || 0n) - originAmount;

  const sUsdsAmount = useSsrAssetsToShares(originAmount, originToken);

  return (
    <VStack className="w-full items-center justify-center">
      <Tabs value={tabIndex === 0 ? 'left' : 'right'} className="w-full">
        <motion.div variants={positionAnimations}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger
              position="left"
              data-testid="upgrade-toggle-left"
              value="left"
              onClick={() => onToggle(0)}
            >
              {leftTabTitle}
            </TabsTrigger>
            <TabsTrigger
              position="right"
              data-testid="upgrade-toggle-right"
              value="right"
              onClick={() => onToggle(1)}
            >
              {rightTabTitle}
            </TabsTrigger>
          </TabsList>
        </motion.div>

        <motion.div variants={positionAnimations}>
          <L2SavingsStatsCard
            isConnectedAndEnabled={isConnectedAndEnabled}
            onExternalLinkClicked={onExternalLinkClicked}
            convertedBalance={convertedBalance}
            originToken={originToken}
          />
        </motion.div>

        <VStack className="w-full" gap={0}>
          <TabsContent value="left">
            <motion.div className="flex w-full flex-col" variants={positionAnimations}>
              <TokenInput
                className="w-full"
                label={t`How much ${originToken?.symbol} would you like to supply?`}
                placeholder={t`Enter amount`}
                token={originToken}
                tokenList={originOptions || []}
                balance={originBalance}
                onChange={(val, event) => onOriginInputChange(BigInt(val), !!event)}
                onTokenSelected={token => {
                  onMenuItemChange?.(token as Token);
                }}
                value={originAmount}
                dataTestId="l2-savings-supply-input"
                error={error ? t`Insufficient funds` : undefined}
                showPercentageButtons={isConnectedAndEnabled}
                enabled={isConnectedAndEnabled}
              />
            </motion.div>
          </TabsContent>
          <TabsContent value="right">
            <motion.div className="flex w-full flex-col" variants={positionAnimations}>
              <TokenInput
                className="w-full"
                token={originToken}
                balance={convertedBalance?.value}
                onChange={(val, event) => onOriginInputChange(BigInt(val), !!event)}
                value={originAmount}
                dataTestId="l2-savings-withdraw-input"
                label={t`How much ${originToken?.symbol} would you like to withdraw?`}
                tokenList={originOptions || []}
                onTokenSelected={token => {
                  onMenuItemChange?.(token as Token);
                }}
                error={error ? t`Insufficient funds` : undefined}
                showPercentageButtons={isConnectedAndEnabled}
                enabled={isConnectedAndEnabled}
                onSetMax={setMaxWithdraw}
              />
            </motion.div>
          </TabsContent>
          {!!originAmount && !error && (
            <motion.div variants={positionAnimations}>
              <TransactionOverview
                title={t`Transaction overview`}
                isFetching={false}
                fetchingMessage={t`Fetching transaction details`}
                rateType="ssr"
                onExternalLinkClicked={onExternalLinkClicked}
                transactionData={[
                  {
                    label: tabIndex === 0 ? t`You will supply` : t`You will withdraw`,
                    value: `${formatBigInt(originAmount, {
                      maxDecimals: 2,
                      unit: getTokenDecimals(originToken, chainId),
                      compact: true
                    })} ${originToken?.symbol}`
                  },
                  ...(tabIndex === 0
                    ? [
                        {
                          label: t`You will receive`,
                          value:
                            sUsdsAmount.value > 0n ? (
                              `${formatBigInt(sUsdsAmount.value, {
                                maxDecimals: 2,
                                compact: true
                              })} sUSDS`
                            ) : (
                              <Skeleton className="bg-textSecondary h-4 w-16" />
                            )
                        }
                      ]
                    : []),
                  ...(tabIndex === 1
                    ? [
                        {
                          label: t`You will supply`,
                          value:
                            sUsdsAmount.value > 0n ? (
                              `${formatBigInt(sUsdsAmount.value, {
                                maxDecimals: 2,
                                compact: true
                              })} sUSDS`
                            ) : (
                              <Skeleton className="bg-textSecondary h-4 w-16" />
                            )
                        }
                      ]
                    : []),
                  {
                    label: t`Rate`,
                    value: skySavingsRatecRate
                  },
                  ...(isConnectedAndEnabled
                    ? [
                        {
                          label: t`Your wallet ${originToken?.symbol} balance`,
                          value:
                            originBalance !== undefined
                              ? [
                                  formatBigInt(originBalance, {
                                    maxDecimals: 2,
                                    unit: getTokenDecimals(originToken, chainId),
                                    compact: true
                                  }),
                                  formatBigInt(finalBalance, {
                                    maxDecimals: 2,
                                    unit: getTokenDecimals(originToken, chainId),
                                    compact: true
                                  })
                                ]
                              : '--'
                        },
                        {
                          label: t`Your Savings USDS balance`,
                          value:
                            convertedBalance?.value !== undefined
                              ? [
                                  formatBigInt(convertedBalance.value, {
                                    maxDecimals: 2,
                                    unit: getTokenDecimals(originToken, chainId),
                                    compact: true
                                  }),
                                  formatBigInt(finalSavingsBalance, {
                                    maxDecimals: 2,
                                    unit: getTokenDecimals(originToken, chainId),
                                    compact: true
                                  })
                                ]
                              : '--'
                        }
                      ]
                    : [])
                ]}
              />
            </motion.div>
          )}
        </VStack>
      </Tabs>
    </VStack>
  );
}
