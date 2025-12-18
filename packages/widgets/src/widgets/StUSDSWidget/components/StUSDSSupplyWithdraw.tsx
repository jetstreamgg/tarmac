import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  getTokenDecimals,
  TOKENS,
  StUsdsProviderType,
  StUsdsProviderSelectionResult
} from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatStrAsApy } from '@jetstreamgg/sky-utils';
import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@widgets/components/ui/tabs';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { useContext, useMemo, useId } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StUSDSFlow } from '../lib/constants';
import { StUSDSStatsCard } from './StUSDSStatsCard';
import { ProviderIndicator } from './ProviderIndicator';
import { useConnection, useChainId } from 'wagmi';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { Checkbox } from '@widgets/components/ui/checkbox';
import { cn } from '@widgets/lib/utils';

type StUSDSSupplyWithdrawProps = {
  address?: string;
  nstBalance?: bigint;
  userUsdsBalance?: bigint; // User's USDS balance, or max amount they can withdraw based on stUSDS balance if using Curve
  userStUsdsBalance?: bigint;
  withdrawableBalance?: bigint; // User's withdrawable USDS balance (for withdraw functionality)
  totalAssets?: bigint;
  availableLiquidityBuffered?: bigint; // Available USDS in vault for withdrawals
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
  remainingCapacityBuffered?: bigint;
  disclaimerChecked?: boolean;
  onDisclaimerChange?: (checked: boolean) => void;
  // Provider selection data
  providerSelection?: StUsdsProviderSelectionResult;
};

export const StUSDSSupplyWithdraw = ({
  address,
  nstBalance,
  userUsdsBalance,
  userStUsdsBalance,
  withdrawableBalance,
  totalAssets,
  availableLiquidityBuffered,
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
  remainingCapacityBuffered,
  disclaimerChecked = false,
  onDisclaimerChange,
  providerSelection
}: StUSDSSupplyWithdrawProps) => {
  const inputToken = TOKENS.usds;
  const chainId = useChainId();

  // Provider selection helpers
  const isCurveSelected = providerSelection?.selectedProvider === StUsdsProviderType.CURVE;
  const allProvidersBlocked = providerSelection?.allProvidersBlocked ?? false;
  // Use isSelectionLoading (stable) instead of isLoading to prevent flicker during typing
  const isProviderLoading = providerSelection?.isSelectionLoading ?? false;

  // Determine if inputs should be disabled based on provider availability
  // Only disable if BOTH native and Curve are blocked
  const isSupplyDisabled = allProvidersBlocked && !isStUsdsDataLoading && !isProviderLoading;
  const isWithdrawDisabled = allProvidersBlocked && !isStUsdsDataLoading && !isProviderLoading;

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

    // Check if exceeds remaining capacity (only for native provider)
    if (!isCurveSelected && remainingCapacityBuffered !== undefined && amount > remainingCapacityBuffered) {
      return t`Exceeds remaining capacity.`;
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

    // Check if exceeds max withdrawable - only show liquidity message for native provider
    if (!isCurveSelected && withdrawableBalance !== undefined && amount > withdrawableBalance) {
      // If withdrawableBalance < userUsdsBalance, it means module liquidity is the constraint
      if (userUsdsBalance !== undefined && withdrawableBalance < userUsdsBalance) {
        return t`Insufficient liquidity in module`;
      }
    }

    return t`Insufficient funds`;
  };

  // Check if user's balance exceeds available capacity/liquidity
  const userBalanceExceedsCapacity =
    remainingCapacityBuffered !== undefined &&
    nstBalance !== undefined &&
    remainingCapacityBuffered > 0n &&
    nstBalance > remainingCapacityBuffered;

  const userSuppliedExceedsLiquidity =
    availableLiquidityBuffered !== undefined &&
    userUsdsBalance !== undefined &&
    availableLiquidityBuffered > 0n &&
    userUsdsBalance > availableLiquidityBuffered;

  const { widgetState } = useContext(WidgetContext);
  const { isConnected } = useConnection();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const disclaimerCheckboxId = useId();

  const finalBalance =
    widgetState.flow === StUSDSFlow.SUPPLY ? (nstBalance || 0n) - amount : (nstBalance || 0n) + amount;
  const finalStUsdsBalance =
    widgetState.flow === StUSDSFlow.SUPPLY
      ? (userUsdsBalance || 0n) + amount
      : (userUsdsBalance || 0n) - amount;

  const stUsdsAmount = {
    value: providerSelection?.selectedQuote?.stUsdsAmount || 0n
  };

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
              userStUsdsBalance: userStUsdsBalance,
              availableLiquidityBuffered: availableLiquidityBuffered
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
                address && nstBalance !== undefined
                  ? isCurveSelected
                    ? nstBalance // When using Curve, show full balance
                    : remainingCapacityBuffered !== undefined
                      ? nstBalance < remainingCapacityBuffered
                        ? nstBalance
                        : remainingCapacityBuffered
                      : nstBalance
                  : undefined
              }
              limitText={
                !isCurveSelected &&
                address &&
                nstBalance !== undefined &&
                remainingCapacityBuffered !== undefined &&
                nstBalance > remainingCapacityBuffered
                  ? `${formatBigInt(remainingCapacityBuffered, {
                      unit: inputToken ? getTokenDecimals(inputToken, chainId) : 18
                    })} ${inputToken?.symbol}`
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
              disabled={isSupplyDisabled}
              showGauge={true}
            />
            {/* Provider indicator - show when Curve is selected or when native is blocked */}
            {providerSelection && isCurveSelected && (
              <div className="mt-2 px-1">
                <ProviderIndicator
                  selectedProvider={providerSelection.selectedProvider}
                  selectionReason={providerSelection.selectionReason}
                  rateDifferencePercent={providerSelection.rateDifferencePercent}
                  flow={StUSDSFlow.SUPPLY}
                  isLoading={isProviderLoading}
                  nativeBlockedReason={providerSelection.nativeProvider?.state?.blockedReason}
                />
              </div>
            )}
            {isSupplyDisabled ? (
              <div className="mt-2 ml-3 flex items-start text-amber-400">
                <PopoverRateInfo type="remainingCapacity" iconClassName="mt-1 shrink-0" />
                <Text variant="small" className="mb-1 ml-2 flex gap-2">
                  Both native and Curve routes are unavailable. Deposits are temporarily unavailable.
                </Text>
              </div>
            ) : !isStUsdsDataLoading && !isCurveSelected && userBalanceExceedsCapacity ? (
              <div className="mt-2 ml-3 flex items-start text-white">
                <PopoverRateInfo type="remainingCapacity" iconClassName="mt-1 shrink-0" />
                <Text variant="small" className="mb-1 ml-2 flex gap-2">
                  You cannot supply your full balance due to current capacity limits.
                </Text>
              </div>
            ) : !isCurveSelected ? (
              <div className="mb-4" />
            ) : null}
            {tabIndex === 0 && onDisclaimerChange && nstBalance !== undefined && nstBalance > 0n && (
              <div className="flex items-center px-3 pt-1">
                <Checkbox
                  id={disclaimerCheckboxId}
                  checked={disclaimerChecked}
                  onCheckedChange={onDisclaimerChange}
                />
                <label htmlFor={disclaimerCheckboxId} className="ml-2">
                  <Text
                    variant="medium"
                    className={cn(
                      availableLiquidityBuffered === 0n ? 'text-amber-400' : 'text-textSecondary',
                      'cursor-pointer'
                    )}
                  >
                    {availableLiquidityBuffered === 0n
                      ? 'I understand that USDS deposited into the stUSDS module is used to fund borrowing against SKY, and that I will not be able to withdraw as long as the Available Liquidity is 0'
                      : 'I understand that USDS deposited into the stUSDS module is used to fund borrowing against SKY, and that I will not be able to withdraw if the Available Liquidity becomes exhausted'}
                  </Text>
                </label>
              </div>
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
              limitText={
                !isCurveSelected &&
                address &&
                userUsdsBalance !== undefined &&
                availableLiquidityBuffered !== undefined &&
                userUsdsBalance > availableLiquidityBuffered
                  ? `${formatBigInt(availableLiquidityBuffered, {
                      unit: inputToken ? getTokenDecimals(inputToken, chainId) : 18
                    })} ${inputToken?.symbol}`
                  : undefined
              }
              onChange={(newValue, event) => {
                onChange(BigInt(newValue), !!event);
              }}
              value={amount}
              error={getWithdrawErrorMessage()}
              onSetMax={onSetMax}
              dataTestId="withdraw-input-stusds"
              showPercentageButtons={isConnectedAndEnabled}
              enabled={isConnectedAndEnabled}
              disabled={isWithdrawDisabled}
              showGauge={true}
            />
            {/* Provider indicator - show when Curve is selected or when native is blocked */}
            {providerSelection && isCurveSelected && (
              <div className="mt-2 px-1">
                <ProviderIndicator
                  selectedProvider={providerSelection.selectedProvider}
                  selectionReason={providerSelection.selectionReason}
                  rateDifferencePercent={providerSelection.rateDifferencePercent}
                  flow={StUSDSFlow.WITHDRAW}
                  isLoading={isProviderLoading}
                  nativeBlockedReason={providerSelection.nativeProvider?.state?.blockedReason}
                />
              </div>
            )}
            {isWithdrawDisabled ? (
              <div className="mt-2 ml-3 flex items-start text-amber-400">
                <PopoverRateInfo type="stusdsLiquidity" iconClassName="mt-1 shrink-0" />
                <Text variant="small" className="ml-2 flex gap-2">
                  Both native and Curve routes are unavailable. Withdrawals are temporarily unavailable.
                </Text>
              </div>
            ) : !isStUsdsDataLoading && !isCurveSelected && userSuppliedExceedsLiquidity ? (
              <div className="mt-2 ml-3 flex items-start text-white">
                <PopoverRateInfo type="stusdsLiquidity" iconClassName="mt-1 shrink-0" />
                <Text variant="small" className="ml-2 flex gap-2">
                  You cannot withdraw your full balance due to current liquidity limits.
                </Text>
              </div>
            ) : !isCurveSelected ? (
              <div className="mb-4" />
            ) : null}
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
            ...(tabIndex === 0
              ? [
                  {
                    label: t`You will receive`,
                    value:
                      stUsdsAmount.value > 0n ? (
                        `${formatBigInt(stUsdsAmount.value, {
                          maxDecimals: 2,
                          compact: true
                        })} stUSDS`
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
                      stUsdsAmount.value > 0n ? (
                        `${formatBigInt(stUsdsAmount.value, {
                          maxDecimals: 2,
                          compact: true
                        })} stUSDS`
                      ) : (
                        <Skeleton className="bg-textSecondary h-4 w-16" />
                      )
                  }
                ]
              : []),
            {
              label: t`Rate`,
              value: moduleRate !== undefined && moduleRate > 0n ? formatStrAsApy(moduleRate) : '--'
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
