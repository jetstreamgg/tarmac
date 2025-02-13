import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { getTokenDecimals, sUsdsAddress, TOKENS, useOverallSkyData } from '@jetstreamgg/hooks';
import { formatBigInt, formatDecimalPercentage } from '@jetstreamgg/utils';
import { TokenInput } from '@/shared/components/ui/token/TokenInput';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionOverview } from '@/shared/components/ui/transaction/TransactionOverview';
import { useContext, useMemo } from 'react';
import { WidgetContext } from '@/context/WidgetContext';
import { SavingsFlow } from '../lib/constants';
import { SavingsStatsCard } from './SavingsStatsCard';
import { useAccount, useChainId } from 'wagmi';
import { motion } from 'framer-motion';
import { positionAnimations } from '@/shared/animation/presets';
import { MotionVStack } from '@/shared/components/ui/layout/MotionVStack';
import { formatUnits } from 'viem';

type SupplyWithdrawProps = {
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

export const SupplyWithdraw = ({
  address,
  nstBalance,
  savingsBalance,
  savingsTvl,
  isSavingsDataLoading,
  onChange,
  amount,
  error,
  onToggle,
  onSetMax,
  tabIndex,
  enabled = true,
  onExternalLinkClicked
}: SupplyWithdrawProps) => {
  const inputToken = TOKENS.usds;
  const chainId = useChainId();
  const contractAddress = sUsdsAddress[chainId as keyof typeof sUsdsAddress];

  const { data: overallSkyData } = useOverallSkyData();

  const stats = {
    savingsTvl: savingsTvl || 0n,
    savingsBalance: savingsBalance || 0n,
    skySavingsRatecRate: overallSkyData?.skySavingsRatecRate
      ? formatDecimalPercentage(parseFloat(overallSkyData.skySavingsRatecRate))
      : '0%'
  };

  const { widgetState } = useContext(WidgetContext);
  const { isConnected } = useAccount();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);

  const finalBalance =
    widgetState.flow === SavingsFlow.SUPPLY ? (nstBalance || 0n) - amount : (nstBalance || 0n) + amount;
  const finalSavingsBalance =
    widgetState.flow === SavingsFlow.SUPPLY
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

        <SavingsStatsCard
          isLoading={isSavingsDataLoading}
          stats={stats}
          address={contractAddress}
          isConnectedAndEnabled={isConnectedAndEnabled}
          onExternalLinkClicked={onExternalLinkClicked}
        />
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
              enabled={isConnectedAndEnabled}
            />
          </motion.div>
        </TabsContent>
      </Tabs>
      {!!amount && !error && (
        <TransactionOverview
          title={t`Transaction overview`}
          isFetching={false}
          fetchingMessage={t`Fetching transaction details`}
          transactionData={[
            {
              label: tabIndex === 0 ? t`You will supply` : t`You will withdraw`,
              value: `${formatBigInt(amount, {
                maxDecimals: 2
              })} ${inputToken?.symbol}`
            },
            ...(address
              ? [
                  ...(widgetState.flow === SavingsFlow.SUPPLY
                    ? [
                        {
                          label: t`Rate`,
                          value: stats.skySavingsRatecRate
                        }
                      ]
                    : []),
                  {
                    label: t`Your wallet ${inputToken?.symbol} balance will be`,
                    value: `${formatBigInt(finalBalance, { maxDecimals: 2 })} ${inputToken?.symbol}`
                  },
                  {
                    label: t`Your Savings ${inputToken?.symbol} balance will be`,
                    value: `${formatBigInt(finalSavingsBalance, { maxDecimals: 2 })} ${inputToken?.symbol}`
                  }
                ]
              : [])
          ]}
        />
      )}
    </MotionVStack>
  );
};
