import { WidgetProps } from '@widgets/shared/types/widgetState';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { Tabs, TabsList, TabsTrigger } from '@widgets/components/ui/tabs';
import { getTokenDecimals, Token, TOKENS } from '@jetstreamgg/sky-hooks';
import { UpgradeStats } from './UpgradeStats';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { t } from '@lingui/core/macro';
import { formatBigInt, math } from '@jetstreamgg/sky-utils';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { useChainId } from 'wagmi';
import { UpgradeFlow } from '../lib/constants';
import { Text } from '@widgets/shared/components/ui/Typography';
import { getTooltipById } from '../../../data/tooltips';

type Props = WidgetProps & {
  leftTabTitle: string;
  rightTabTitle: string;
  originTitle: string;
  originAmount: bigint;
  targetAmount: bigint;
  originBalance?: bigint;
  targetBalance?: bigint;
  originToken?: Token;
  targetToken?: Token;
  originOptions?: Token[];
  tabIndex: 0 | 1;
  error?: Error;
  onToggle: (number: 0 | 1) => void;
  onOriginInputChange: (val: bigint, userTriggered?: boolean) => void;
  onMenuItemChange?: (token: Token) => void;
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export function UpgradeRevert({
  leftTabTitle,
  rightTabTitle,
  originToken,
  targetToken,
  originOptions,
  originTitle,
  originAmount,
  targetAmount,
  originBalance,
  targetBalance,
  tabIndex,
  error,
  onToggle,
  onOriginInputChange,
  onMenuItemChange,
  isConnectedAndEnabled = true
}: Props): React.ReactElement {
  const chainId = useChainId();

  return (
    <VStack className="w-full items-center justify-center">
      <Tabs value={tabIndex === 0 ? UpgradeFlow.UPGRADE : UpgradeFlow.REVERT} className="w-full">
        <motion.div variants={positionAnimations}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger
              position="left"
              data-testid="upgrade-toggle-left"
              value={UpgradeFlow.UPGRADE}
              onClick={() => onToggle(0)}
            >
              {leftTabTitle}
            </TabsTrigger>
            <TabsTrigger
              position="right"
              data-testid="upgrade-toggle-right"
              value={UpgradeFlow.REVERT}
              onClick={() => onToggle(1)}
            >
              {rightTabTitle}
            </TabsTrigger>
          </TabsList>
        </motion.div>

        <motion.div variants={positionAnimations}>
          <UpgradeStats />
        </motion.div>

        <VStack className="w-full" gap={0}>
          <motion.div variants={positionAnimations}>
            <TokenInput
              className="w-full"
              token={originToken}
              balance={originBalance}
              onChange={(val, event) => onOriginInputChange(val, !!event)}
              value={originAmount}
              dataTestId="upgrade-input-origin"
              label={originTitle}
              tokenList={originOptions || []}
              onTokenSelected={token => {
                onMenuItemChange?.(token);
              }}
              error={error?.message}
              showPercentageButtons={isConnectedAndEnabled}
              enabled={isConnectedAndEnabled}
            />
          </motion.div>
          {!!originAmount && !error && (
            // TODO add additional data points
            <motion.div variants={positionAnimations}>
              <TransactionOverview
                title={t`Transaction overview`}
                isFetching={!!originAmount && !targetAmount}
                fetchingMessage={t`Fetching transaction details`}
                transactionData={[
                  {
                    label: t`Exchange rate`,
                    tooltipText: getTooltipById('exchange-rate')?.tooltip || '',
                    value: (() => {
                      // Check if it's MKR to SKY conversion
                      if (
                        originToken?.symbol === TOKENS.mkr.symbol &&
                        targetToken?.symbol === TOKENS.sky.symbol
                      ) {
                        return `1:${math.MKR_TO_SKY_PRICE_RATIO.toString()}`;
                      }
                      // Check if it's SKY to MKR conversion
                      else if (
                        originToken?.symbol === TOKENS.sky.symbol &&
                        targetToken?.symbol === TOKENS.mkr.symbol
                      ) {
                        return `${math.MKR_TO_SKY_PRICE_RATIO.toString()}:1`;
                      }
                      // All other conversions are 1:1 (DAI to USDS, USDS to DAI)
                      else {
                        return '1:1';
                      }
                    })()
                  },
                  {
                    label: t`Tokens to receive`,
                    value: `${formatBigInt(targetAmount, {
                      unit: targetToken ? getTokenDecimals(targetToken, chainId) : 18,
                      compact: true
                    })} ${targetToken?.symbol}`
                  },
                  {
                    label: t`Your wallet ${originToken?.symbol || ''} balance`,
                    value:
                      originBalance !== undefined && originAmount > 0n
                        ? [
                            formatBigInt(originBalance, {
                              unit: originToken ? getTokenDecimals(originToken, chainId) : 18,
                              compact: true
                            }),
                            formatBigInt(originBalance - originAmount, {
                              unit: originToken ? getTokenDecimals(originToken, chainId) : 18,
                              compact: true
                            })
                          ]
                        : '--'
                  },
                  {
                    label: t`Your wallet ${targetToken?.symbol || ''} balance`,
                    value:
                      targetBalance !== undefined && targetAmount > 0n
                        ? [
                            formatBigInt(targetBalance, {
                              unit: targetToken ? getTokenDecimals(targetToken, chainId) : 18,
                              compact: true
                            }),
                            formatBigInt(targetBalance + targetAmount, {
                              unit: targetToken ? getTokenDecimals(targetToken, chainId) : 18,
                              compact: true
                            })
                          ]
                        : '--'
                  },
                  ...(originToken?.symbol === TOKENS.mkr.symbol
                    ? [
                        {
                          label: t`Delayed Upgrade Penalty`,
                          // TODO: Fetch this value dynamically
                          value: '0%',
                          tooltipText: (
                            <>
                              <Text>
                                The Delayed Upgrade Penalty is a time-based upgrade mechanism, approved by Sky
                                Ecosystem Governance, which is designed to facilitate a smooth and prompt
                                upgrade of MKR to SKY.
                              </Text>
                              <br />
                              <Text>
                                The penalty, which will begin sometime in September 2025, reduces the amount
                                of SKY received per MKR upgraded at a rate of 1%, and increases by 1% every
                                three months thereafter until it reaches 100% in 25 years. The penalty will
                                not apply to anyone upgrading their MKR to SKY before it kicks in.
                              </Text>
                            </>
                          )
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
