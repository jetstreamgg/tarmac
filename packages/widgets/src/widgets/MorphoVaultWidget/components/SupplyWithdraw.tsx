import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { getTokenDecimals, Token, WriteHook } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@widgets/components/ui/tabs';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { useContext, useMemo } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { MorphoVaultFlow } from '../lib/constants';
import { MorphoVaultStatsCard } from './MorphoVaultStatsCard';
import { useConnection, useChainId } from 'wagmi';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { formatUnits } from 'viem';
import { Text } from '@widgets/shared/components/ui/Typography';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { Checkbox } from '@widgets/components/ui/checkbox';
import { cn } from '@widgets/lib/utils';

type SupplyWithdrawProps = {
  /** User's wallet address */
  address?: string;
  /** User's underlying asset balance (e.g., USDC balance) */
  assetBalance?: bigint;
  /** User's vault balance in underlying assets */
  vaultBalance?: bigint;
  /** Maximum amount user can withdraw - may be less than vaultBalance due to liquidity */
  maxWithdraw?: bigint;
  /** Whether user's withdrawal is constrained by vault liquidity */
  isLiquidityConstrained?: boolean;
  /** User's vault share balance */
  userShares?: bigint;
  /** The underlying asset token */
  assetToken: Token;
  /** Whether vault data is loading */
  isVaultDataLoading: boolean;
  /** Callback when amount changes */
  onChange: (val: bigint, userTriggered?: boolean) => void;
  /** Current input amount */
  amount: bigint;
  /** Whether there's a balance error */
  error: boolean;
  /** Callback for tab toggle */
  onToggle: (tabIndex: 0 | 1) => void;
  /** Callback for max button */
  onSetMax?: (val: boolean) => void;
  /** Current tab index (0 = Supply, 1 = Withdraw) */
  tabIndex: 0 | 1;
  /** Whether the widget is enabled */
  enabled: boolean;
  /** Callback for external link clicks */
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  /** Vault contract address for etherscan link */
  vaultAddress?: `0x${string}`;
  /** Display name for the vault */
  vaultName: string;
  /** Vault TVL (total assets) */
  vaultTvl?: bigint;
  /** Vault APY (if available from external source) */
  vaultRate?: string;
  /** Share decimals for formatting vault shares (typically 18) */
  shareDecimals: number;
  /** Claim rewards hook */
  claimRewards?: WriteHook;
  /** Whether rewards are loading */
  isRewardsLoading?: boolean;
  /** Whether there are claimable rewards */
  hasClaimableRewards?: boolean;
  /** Available liquidity in the vault for withdrawals */
  availableLiquidity?: bigint;
  /** Whether the liquidity disclaimer checkbox is checked */
  disclaimerChecked?: boolean;
  /** Callback when disclaimer checkbox changes */
  onDisclaimerChange?: (checked: boolean) => void;
};

export const SupplyWithdraw = ({
  address,
  assetBalance,
  vaultBalance,
  maxWithdraw,
  isLiquidityConstrained,
  userShares,
  assetToken,
  isVaultDataLoading,
  onChange,
  amount,
  error,
  onToggle,
  onSetMax,
  tabIndex,
  enabled = true,
  onExternalLinkClicked,
  vaultAddress,
  vaultName,
  vaultTvl,
  vaultRate,
  shareDecimals,
  claimRewards,
  isRewardsLoading,
  hasClaimableRewards,
  availableLiquidity,
  disclaimerChecked = false,
  onDisclaimerChange
}: SupplyWithdrawProps) => {
  const chainId = useChainId();
  const tokenDecimals = getTokenDecimals(assetToken, chainId);

  const { widgetState } = useContext(WidgetContext);
  const { isConnected } = useConnection();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);

  // Calculate final balances after transaction
  const finalAssetBalance =
    widgetState.flow === MorphoVaultFlow.SUPPLY
      ? (assetBalance || 0n) - amount
      : (assetBalance || 0n) + amount;

  const finalVaultBalance =
    widgetState.flow === MorphoVaultFlow.SUPPLY
      ? (vaultBalance || 0n) + amount
      : (vaultBalance || 0n) - amount;

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

        <MorphoVaultStatsCard
          isLoading={isVaultDataLoading}
          vaultAddress={vaultAddress}
          vaultName={vaultName}
          vaultBalance={vaultBalance}
          userShares={userShares}
          vaultTvl={vaultTvl}
          assetSymbol={assetToken.symbol}
          assetDecimals={tokenDecimals}
          shareDecimals={shareDecimals}
          isConnectedAndEnabled={isConnectedAndEnabled}
          onExternalLinkClicked={onExternalLinkClicked}
          claimRewards={claimRewards}
          isRewardsLoading={isRewardsLoading}
          hasClaimableRewards={hasClaimableRewards}
        />

        <TabsContent value="left">
          <motion.div className="flex w-full flex-col" variants={positionAnimations}>
            <TokenInput
              className="w-full"
              label={t`How much ${assetToken.symbol} would you like to supply?`}
              placeholder={t`Enter amount`}
              token={assetToken}
              tokenList={[assetToken]}
              balance={address ? assetBalance : undefined}
              onChange={(newValue, event) => {
                onChange(BigInt(newValue), !!event);
              }}
              value={amount}
              dataTestId="supply-input-morpho"
              error={error ? t`Insufficient funds` : undefined}
              showPercentageButtons={isConnectedAndEnabled}
              enabled={isConnectedAndEnabled}
            />
            {onDisclaimerChange && (
              <label className="mt-2 -mb-1 ml-3 flex cursor-pointer items-start">
                <Checkbox
                  checked={disclaimerChecked}
                  onCheckedChange={onDisclaimerChange}
                  className="mt-0.5 shrink-0"
                />
                <Text
                  variant="small"
                  className={cn(
                    'ml-2',
                    !isVaultDataLoading && availableLiquidity === 0n ? 'text-amber-400' : 'text-textSecondary'
                  )}
                >
                  {!isVaultDataLoading && availableLiquidity === 0n ? (
                    <Trans>
                      I understand that {assetToken.symbol} deposited into this vault is used to fund
                      borrowing, and that I will not be able to withdraw as long as the available liquidity is
                      0
                    </Trans>
                  ) : (
                    <Trans>
                      I understand that {assetToken.symbol} deposited into this vault is used to fund
                      borrowing, and that I will not be able to withdraw if the available liquidity becomes
                      exhausted
                    </Trans>
                  )}
                </Text>
              </label>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="right">
          <motion.div className="flex w-full flex-col" variants={positionAnimations}>
            <TokenInput
              className="w-full"
              label={t`How much ${assetToken.symbol} would you like to withdraw?`}
              placeholder={t`Enter amount`}
              token={assetToken}
              tokenList={[assetToken]}
              balance={address ? maxWithdraw : undefined}
              limitText={
                isLiquidityConstrained && maxWithdraw !== undefined
                  ? `${formatBigInt(maxWithdraw, {
                      unit: tokenDecimals,
                      maxDecimals: 4
                    })} ${assetToken.symbol}`
                  : undefined
              }
              onChange={(newValue, event) => {
                onChange(BigInt(newValue), !!event);
              }}
              value={amount}
              error={
                error
                  ? isLiquidityConstrained
                    ? t`Insufficient liquidity. Maximum available is ${formatUnits(maxWithdraw || 0n, tokenDecimals)} ${assetToken.symbol}.`
                    : t`Insufficient funds. Your balance is ${formatUnits(vaultBalance || 0n, tokenDecimals)} ${assetToken.symbol}.`
                  : undefined
              }
              onSetMax={onSetMax}
              dataTestId="withdraw-input-morpho"
              showPercentageButtons={isConnectedAndEnabled}
              enabled={isConnectedAndEnabled}
              showGauge={true}
            />
            {!isVaultDataLoading && isLiquidityConstrained && maxWithdraw === 0n && (
              <div className="mt-2 ml-3 flex items-start text-amber-400">
                <PopoverRateInfo type="morphoLiquidity" iconClassName="mt-1 shrink-0 text-amber-400" />
                <Text variant="small" className="ml-2 flex gap-2">
                  <Trans>Withdrawals are temporarily unavailable due to liquidity constraints.</Trans>
                </Text>
              </div>
            )}
            {!isVaultDataLoading &&
              isLiquidityConstrained &&
              maxWithdraw !== undefined &&
              maxWithdraw > 0n && (
                <div className="mt-2 ml-3 flex items-start text-white">
                  <PopoverRateInfo type="morphoLiquidity" iconClassName="mt-1 shrink-0 text-white" />
                  <Text variant="small" className="ml-2 flex gap-2">
                    <Trans>You cannot withdraw your full balance due to current liquidity limits.</Trans>
                  </Text>
                </div>
              )}
          </motion.div>
        </TabsContent>
      </Tabs>

      {!!amount && !error && (
        <TransactionOverview
          title={t`Transaction overview`}
          isFetching={false}
          fetchingMessage={t`Fetching transaction details`}
          onExternalLinkClicked={onExternalLinkClicked}
          rateType="morpho"
          transactionData={[
            {
              label: tabIndex === 0 ? t`You will supply` : t`You will withdraw`,
              value: `${formatBigInt(amount, {
                unit: tokenDecimals,
                maxDecimals: 2,
                compact: true
              })} ${assetToken.symbol}`
            },
            ...(vaultRate
              ? [
                  {
                    label: t`Rate`,
                    value: vaultRate
                  }
                ]
              : []),
            ...(address
              ? [
                  {
                    label: t`Your wallet ${assetToken.symbol} balance`,
                    value:
                      assetBalance !== undefined
                        ? [
                            formatBigInt(assetBalance, {
                              unit: tokenDecimals,
                              maxDecimals: 2,
                              compact: true
                            }),
                            formatBigInt(finalAssetBalance, {
                              unit: tokenDecimals,
                              maxDecimals: 2,
                              compact: true
                            })
                          ]
                        : '--'
                  },
                  {
                    label: t`Your vault ${assetToken.symbol} balance`,
                    value:
                      vaultBalance !== undefined
                        ? [
                            formatBigInt(vaultBalance, {
                              unit: tokenDecimals,
                              maxDecimals: 2,
                              compact: true
                            }),
                            formatBigInt(finalVaultBalance, {
                              unit: tokenDecimals,
                              maxDecimals: 2,
                              compact: true
                            })
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
