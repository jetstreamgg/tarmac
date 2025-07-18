import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { getTokenDecimals, TOKENS } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@widgets/components/ui/tabs';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { useContext, useMemo } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StUSDSFlow } from '../lib/constants';
import { StUSDSStatsCard } from './StUSDSStatsCard';
import { useAccount, useChainId } from 'wagmi';
import { Card } from '@widgets/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { formatUnits } from 'viem';
import { Text } from '@widgets/shared/components/ui/Typography';

type StUSDSSupplyWithdrawProps = {
  address?: string;
  nstBalance?: bigint;
  savingsBalance?: bigint;
  savingsTvl?: bigint;
  isSavingsDataLoading: boolean;
  onChange: (val: bigint, userTriggered?: boolean) => void;
  amount: bigint;
  error: boolean;
  onToggle: (number: 0 | 1) => void;
  onSetMax?: (val: boolean) => void;
  tabIndex: 0 | 1;
  enabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const StUSDSSupplyWithdraw = ({
  address,
  nstBalance,
  savingsBalance,
  // savingsTvl, // Unused, will be replaced with stUSDS TVL data
  isSavingsDataLoading,
  onChange,
  amount,
  error,
  onToggle,
  onSetMax,
  tabIndex,
  enabled = true,
  onExternalLinkClicked
}: StUSDSSupplyWithdrawProps) => {
  const inputToken = TOKENS.usds;
  const chainId = useChainId();

  // TODO: Replace with real stUSDS data when hooks are available
  const mockUtilization = 87; // Mock 87% utilization
  const mockYieldMin = 5.2;
  const mockYieldMax = 6.7;
  const mockTvl = 1800000000n * 10n ** 18n; // 1.8B USDS

  const isHighUtilization = mockUtilization > 90;
  const isLiquidityConstrained = mockUtilization > 95;

  const { widgetState } = useContext(WidgetContext);
  const { isConnected } = useAccount();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);

  const finalBalance =
    widgetState.flow === StUSDSFlow.SUPPLY ? (nstBalance || 0n) - amount : (nstBalance || 0n) + amount;
  const finalSavingsBalance =
    widgetState.flow === StUSDSFlow.SUPPLY
      ? (savingsBalance || 0n) + amount
      : (savingsBalance || 0n) - amount;

  return (
    <MotionVStack gap={0} className="w-full" variants={positionAnimations}>
      <Tabs value={tabIndex === 0 ? 'left' : 'right'}>
        <motion.div variants={positionAnimations}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger position="left" value="left" onClick={() => onToggle(0)}>
              <Trans>Supply</Trans>
            </TabsTrigger>
            <TabsTrigger position="right" value="right" onClick={() => onToggle(1)}>
              <Trans>Withdraw</Trans>
            </TabsTrigger>
          </TabsList>
        </motion.div>

        <motion.div variants={positionAnimations} className="mt-4">
          <StUSDSStatsCard
            isLoading={isSavingsDataLoading}
            stats={{
              savingsTvl: mockTvl,
              savingsBalance: savingsBalance || 0n
            }}
            address={address}
            isConnectedAndEnabled={isConnectedAndEnabled}
            onExternalLinkClicked={onExternalLinkClicked}
          />
        </motion.div>
        <TabsContent value="left">
          <motion.div className="flex w-full flex-col" variants={positionAnimations}>
            <TokenInput
              className="w-full"
              label={t`How much USDS would you like to supply?`}
              placeholder={t`Enter amount`}
              token={inputToken}
              tokenList={[inputToken]}
              balance={address ? nstBalance : undefined}
              onChange={(newValue, event) => {
                onChange(BigInt(newValue), !!event);
              }}
              value={amount}
              dataTestId="supply-input-savings"
              error={error ? t`Insufficient funds` : undefined}
              showPercentageButtons={isConnectedAndEnabled}
              enabled={isConnectedAndEnabled}
            />
          </motion.div>
        </TabsContent>
        <TabsContent value="right">
          <motion.div className="flex w-full flex-col" variants={positionAnimations}>
            {isHighUtilization && (
              <Card
                className={`mb-4 border p-3 ${isLiquidityConstrained ? 'border-destructive bg-destructive/10' : 'border-warning bg-warning/10'}`}
              >
                <div className="flex items-start gap-2 text-orange-400">
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 ${isLiquidityConstrained ? 'text-destructive' : 'text-warning'}`}
                  />
                  <Text variant="small">
                    {isLiquidityConstrained
                      ? t`Liquidity is extremely limited. Withdrawals may be delayed or unavailable.`
                      : t`High utilization (${mockUtilization}%). Withdrawals may be delayed during periods of high demand.`}
                  </Text>
                </div>
              </Card>
            )}
            <TokenInput
              className="w-full"
              label={t`How much USDS would you like to withdraw?`}
              placeholder={t`Enter amount`}
              token={inputToken}
              tokenList={[inputToken]}
              balance={address ? savingsBalance : undefined}
              onChange={(newValue, event) => {
                onChange(BigInt(newValue), !!event);
              }}
              value={amount}
              error={
                error
                  ? t`Insufficient funds. Your balance is ${formatUnits(
                      savingsBalance || 0n,
                      inputToken ? getTokenDecimals(inputToken, chainId) : 18
                    )} ${inputToken?.symbol}.`
                  : undefined
              }
              onSetMax={onSetMax}
              dataTestId="withdraw-input-savings"
              showPercentageButtons={isConnectedAndEnabled}
              enabled={isConnectedAndEnabled && !isLiquidityConstrained}
            />
          </motion.div>
        </TabsContent>
      </Tabs>
      {!!amount && !error && (
        <TransactionOverview
          title={t`Transaction overview`}
          isFetching={false}
          fetchingMessage={t`Fetching transaction details`}
          rateType="ssr"
          onExternalLinkClicked={onExternalLinkClicked}
          transactionData={[
            {
              label: tabIndex === 0 ? t`You will supply` : t`You will withdraw`,
              value: `${formatBigInt(amount, {
                maxDecimals: 2,
                compact: true
              })} ${inputToken?.symbol}`
            },
            {
              label: t`Rate`,
              value: `${mockYieldMin}% – ${mockYieldMax}%`
            },
            ...(address
              ? [
                  {
                    label: t`Your wallet ${inputToken?.symbol} balance`,
                    value:
                      nstBalance !== undefined
                        ? [
                            formatBigInt(nstBalance, { maxDecimals: 2, compact: true }),
                            formatBigInt(finalBalance, { maxDecimals: 2, compact: true })
                          ]
                        : '--'
                  },
                  {
                    label: t`Your Savings USDS balance`,
                    value:
                      savingsBalance !== undefined
                        ? [
                            formatBigInt(savingsBalance, { maxDecimals: 2, compact: true }),
                            formatBigInt(finalSavingsBalance, { maxDecimals: 2, compact: true })
                          ]
                        : '--'
                  }
                ]
              : [])
          ]}
        />
      )}
    </MotionVStack>
  );
};
