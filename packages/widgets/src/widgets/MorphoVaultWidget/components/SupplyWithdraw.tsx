import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { getTokenDecimals, Token } from '@jetstreamgg/sky-hooks';
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

type SupplyWithdrawProps = {
  /** User's wallet address */
  address?: string;
  /** User's underlying asset balance (e.g., USDC balance) */
  assetBalance?: bigint;
  /** User's vault balance in underlying assets */
  vaultBalance?: bigint;
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
  /** Vault TVL (total assets) */
  vaultTvl?: bigint;
  /** Vault APY (if available from external source) */
  vaultRate?: string;
};

export const SupplyWithdraw = ({
  address,
  assetBalance,
  vaultBalance,
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
  vaultTvl,
  vaultRate
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
          vaultBalance={vaultBalance}
          vaultTvl={vaultTvl}
          vaultRate={vaultRate}
          assetSymbol={assetToken.symbol}
          isConnectedAndEnabled={isConnectedAndEnabled}
          onExternalLinkClicked={onExternalLinkClicked}
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
              balance={address ? vaultBalance : undefined}
              onChange={(newValue, event) => {
                onChange(BigInt(newValue), !!event);
              }}
              value={amount}
              error={
                error
                  ? t`Insufficient funds. Your balance is ${formatUnits(vaultBalance || 0n, tokenDecimals)} ${assetToken.symbol}.`
                  : undefined
              }
              onSetMax={onSetMax}
              dataTestId="withdraw-input-morpho"
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
          onExternalLinkClicked={onExternalLinkClicked}
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
