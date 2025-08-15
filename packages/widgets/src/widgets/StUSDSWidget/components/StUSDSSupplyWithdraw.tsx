import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { getTokenDecimals, TOKENS } from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatYsrAsApy } from '@jetstreamgg/sky-utils';
import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@widgets/components/ui/tabs';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { useContext, useMemo } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StUSDSFlow } from '../lib/constants';
import { StUSDSStatsCard } from './StUSDSStatsCard';
import { useAccount, useChainId } from 'wagmi';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { formatUnits } from 'viem';
import { Text } from '@widgets/shared/components/ui/Typography';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';

type StUSDSSupplyWithdrawProps = {
  address?: string;
  nstBalance?: bigint;
  userUsdsBalance?: bigint;
  withdrawableBalance?: bigint; // User's withdrawable USDS balance (for withdraw functionality)
  maxDeposit?: bigint; // Max USDS user can deposit
  totalAssets?: bigint;
  availableLiquidity?: bigint; // Available USDS in vault for withdrawals
  moduleRate?: bigint; // Current module rate
  isStUsdsDataLoading: boolean;
  onChange: (val: bigint, userTriggered?: boolean) => void;
  amount: bigint;
  error: boolean;
  onToggle: (number: 0 | 1) => void;
  onSetMax?: (val: boolean) => void;
  tabIndex: 0 | 1;
  enabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  remainingCapacity?: bigint;
};

export const StUSDSSupplyWithdraw = ({
  address,
  nstBalance,
  userUsdsBalance,
  withdrawableBalance,
  maxDeposit,
  totalAssets,
  availableLiquidity,
  moduleRate,
  isStUsdsDataLoading,
  onChange,
  amount,
  error,
  onToggle,
  onSetMax,
  tabIndex,
  enabled = true,
  onExternalLinkClicked,
  remainingCapacity
}: StUSDSSupplyWithdrawProps) => {
  const inputToken = TOKENS.usds;
  const chainId = useChainId();
  // Determine specific error message for supply
  const getSupplyErrorMessage = () => {
    if (!error || !amount) return undefined;

    // Check if exceeds wallet balance
    if (nstBalance !== undefined && amount > nstBalance) {
      return t`Insufficient funds. Your balance is ${formatBigInt(nstBalance, {
        unit: inputToken ? getTokenDecimals(inputToken, chainId) : 18,
        maxDecimals: 4
      })} ${inputToken?.symbol}.`;
    }

    // Check if exceeds max deposit
    if (maxDeposit !== undefined && amount > maxDeposit) {
      return t`Exceeds max deposit. Maximum allowed is ${formatUnits(
        maxDeposit,
        inputToken ? getTokenDecimals(inputToken, chainId) : 18
      )} ${inputToken?.symbol}.`;
    }

    return t`Insufficient funds`;
  };

  // Determine specific error message for withdraw
  const getWithdrawErrorMessage = () => {
    if (!error || !amount) return undefined;

    // Check if exceeds user's deposited balance in stUSDS
    if (userUsdsBalance !== undefined && amount > userUsdsBalance) {
      return t`Insufficient funds. Your balance is ${formatBigInt(userUsdsBalance, {
        unit: inputToken ? getTokenDecimals(inputToken, chainId) : 18,
        maxDecimals: 4
      })} ${inputToken?.symbol}.`;
    }

    // Check if exceeds max withdrawable (which is min of user balance and module liquidity)
    if (withdrawableBalance !== undefined && amount > withdrawableBalance) {
      // If withdrawableBalance < userUsdsBalance, it means module liquidity is the constraint
      if (userUsdsBalance !== undefined && withdrawableBalance < userUsdsBalance) {
        return t`Insufficient liquidity in module`;
      }
    }

    return t`Insufficient funds`;
  };

  // Check if user's balance exceeds available capacity/liquidity
  const userBalanceExceedsCapacity =
    remainingCapacity !== undefined &&
    nstBalance !== undefined &&
    remainingCapacity > 0n &&
    nstBalance > remainingCapacity;

  const userSuppliedExceedsLiquidity =
    availableLiquidity !== undefined &&
    userUsdsBalance !== undefined &&
    availableLiquidity > 0n &&
    userUsdsBalance > availableLiquidity;

  const { widgetState } = useContext(WidgetContext);
  const { isConnected } = useAccount();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);

  const finalBalance =
    widgetState.flow === StUSDSFlow.SUPPLY ? (nstBalance || 0n) - amount : (nstBalance || 0n) + amount;
  const finalStUsdsBalance =
    widgetState.flow === StUSDSFlow.SUPPLY
      ? (userUsdsBalance || 0n) + amount
      : (userUsdsBalance || 0n) - amount;

  return (
    <MotionVStack gap={0} className="w-full" variants={positionAnimations}>
      <Tabs value={tabIndex === 0 ? 'left' : 'right'}>
        <motion.div variants={positionAnimations}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger
              position="left"
              value="left"
              onClick={() => {
                onChange(0n, true);
                onToggle(0);
              }}
            >
              <Trans>Supply</Trans>
            </TabsTrigger>
            <TabsTrigger
              position="right"
              value="right"
              onClick={() => {
                onChange(0n, true);
                onToggle(1);
              }}
            >
              <Trans>Withdraw</Trans>
            </TabsTrigger>
          </TabsList>
        </motion.div>

        <motion.div variants={positionAnimations} className="mt-4">
          <StUSDSStatsCard
            isLoading={isStUsdsDataLoading}
            stats={{
              totalAssets: totalAssets || 0n,
              userUsdsBalance: userUsdsBalance || 0n,
              availableLiquidity: availableLiquidity,
              maxWithdraw: withdrawableBalance,
              maxDeposit: maxDeposit
            }}
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
              balance={
                address
                  ? nstBalance && maxDeposit
                    ? nstBalance < maxDeposit
                      ? nstBalance
                      : maxDeposit
                    : nstBalance
                  : undefined
              }
              onChange={(newValue, event) => {
                onChange(BigInt(newValue), !!event);
              }}
              value={amount}
              dataTestId="supply-input-stusds"
              error={getSupplyErrorMessage()}
              showPercentageButtons={isConnectedAndEnabled}
              enabled={isConnectedAndEnabled}
              disabled={remainingCapacity === 0n}
            />
            {!isStUsdsDataLoading && remainingCapacity === 0n ? (
              <div className="ml-3 mt-2 flex items-start text-amber-400">
                <PopoverRateInfo type="stusds" iconClassName="mt-1 shrink-0" />
                <Text variant="small" className="ml-2 flex gap-2">
                  Supply capacity reached. Deposits are temporarily unavailable.
                </Text>
              </div>
            ) : !isStUsdsDataLoading && userBalanceExceedsCapacity ? (
              <div className="ml-3 mt-2 flex items-start text-white">
                <PopoverRateInfo type="stusds" iconClassName="mt-1 shrink-0" />
                <Text variant="small" className="ml-2 flex gap-2">
                  You cannot supply your full balance due to current capacity limits.
                </Text>
              </div>
            ) : (
              <div className="mb-4" />
            )}
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
              balance={address ? withdrawableBalance : undefined}
              onChange={(newValue, event) => {
                onChange(BigInt(newValue), !!event);
              }}
              value={amount}
              error={getWithdrawErrorMessage()}
              onSetMax={onSetMax}
              dataTestId="withdraw-input-stusds"
              showPercentageButtons={isConnectedAndEnabled}
              enabled={isConnectedAndEnabled}
              disabled={availableLiquidity === 0n}
            />
            {!isStUsdsDataLoading && availableLiquidity === 0n ? (
              <div className="ml-3 mt-2 flex items-start text-amber-400">
                <PopoverRateInfo type="stusds" iconClassName="mt-1 shrink-0" />
                <Text variant="small" className="ml-2 flex gap-2">
                  Withdrawal liquidity exhausted. Withdrawals are temporarily unavailable.
                </Text>
              </div>
            ) : !isStUsdsDataLoading && userSuppliedExceedsLiquidity ? (
              <div className="ml-3 mt-2 flex items-start text-white">
                <PopoverRateInfo type="stusds" iconClassName="mt-1 shrink-0" />
                <Text variant="small" className="ml-2 flex gap-2">
                  You cannot withdraw your full balance due to current liquidity limits.
                </Text>
              </div>
            ) : (
              <div className="mb-4" />
            )}
          </motion.div>
        </TabsContent>
      </Tabs>
      {!!amount && !error && (
        <TransactionOverview
          title={t`Transaction overview`}
          isFetching={false}
          fetchingMessage={t`Fetching transaction details`}
          rateType="stusds"
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
              value: moduleRate !== undefined && moduleRate > 0n ? formatYsrAsApy(moduleRate) : '--'
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
                    label: t`Your supplied USDS balance`,
                    value:
                      userUsdsBalance !== undefined
                        ? [
                            formatBigInt(userUsdsBalance, { maxDecimals: 2, compact: true }),
                            formatBigInt(finalStUsdsBalance, { maxDecimals: 2, compact: true })
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
