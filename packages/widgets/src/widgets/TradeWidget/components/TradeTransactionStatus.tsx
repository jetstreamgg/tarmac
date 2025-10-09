import { useContext, useEffect } from 'react';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { getTokenDecimals, OrderQuoteResponse, Token } from '@jetstreamgg/sky-hooks';
import {
  WAD_PRECISION,
  formatBigInt,
  ExplorerName,
  getExplorerName,
  isL2ChainId,
  useIsSafeWallet,
  isCowSupportedChainId
} from '@jetstreamgg/sky-utils';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TransactionStatus } from '@widgets/shared/components/ui/transaction/TransactionStatus';
import { StepIndicator } from '@widgets/shared/components/ui/transaction/StepIndicator';
import { TokenIconWithBalance } from '@widgets/shared/components/ui/token/TokenIconWithBalance';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import {
  EthFlowTxStatus,
  TradeAction,
  TradeFlow,
  TradeScreen,
  TradeSide,
  ethFlowTradeDescription,
  ethFlowTradeLoadingButtonText,
  ethFlowTradeSubtitle,
  ethFlowTradeTitle,
  tradeApproveDescription,
  tradeApproveSubtitle,
  tradeApproveTitle,
  tradeDescription,
  tradeLoadingButtonText,
  tradeSubtitle,
  tradeTitle,
  tradeApproveLoadingButtonText
} from '../lib/constants';
import { TxStatus } from '@widgets/shared/constants';
import { formatUnits } from 'viem';
import { EthTxCardCopyText } from '../lib/types';
import { useChainId } from 'wagmi';

// TX Status wrapper to update copy
export const TradeTransactionStatus = ({
  quoteData,
  originToken,
  originAmount,
  targetToken,
  targetAmount,
  lastUpdated,
  isEthFlow,
  ethFlowTxStatus = EthFlowTxStatus.IDLE,
  onExternalLinkClicked,
  needsUsdtReset,
  isUsdtResetFlow,
  isBatchTransaction
}: {
  quoteData?: OrderQuoteResponse | null | undefined;
  originToken?: Token;
  originAmount: bigint;
  targetToken?: Token;
  targetAmount: bigint;
  lastUpdated?: TradeSide;
  isEthFlow: boolean;
  ethFlowTxStatus?: EthFlowTxStatus;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  needsUsdtReset: boolean;
  isUsdtResetFlow: boolean;
  isBatchTransaction: boolean;
}) => {
  const { i18n } = useLingui();
  const chainId = useChainId();
  const isSafeWallet = useIsSafeWallet();
  const {
    setTxTitle,
    setTxSubtitle,
    setTxDescription,
    setLoadingText,
    txStatus,
    txDescription,
    widgetState,
    setStep,
    setStepTwoTitle,
    setOriginToken,
    setOriginAmount,
    setTargetToken,
    setTargetAmount
  } = useContext(WidgetContext);
  if (!originToken || !targetToken) return null;

  const { flow, action, screen } = widgetState;

  const exactInput = lastUpdated === TradeSide.IN;

  const inputAmount =
    txStatus === TxStatus.SUCCESS
      ? originAmount
      : exactInput
        ? quoteData?.quote.sellAmountAfterFee
        : quoteData?.quote.sellAmountBeforeFee;
  const outputAmount =
    txStatus === TxStatus.SUCCESS
      ? targetAmount
      : exactInput
        ? quoteData?.quote.buyAmountAfterFee
        : quoteData?.quote.buyAmountBeforeFee;

  const executionPrice =
    inputAmount && outputAmount
      ? (
          +formatUnits(inputAmount, getTokenDecimals(originToken, chainId) || WAD_PRECISION) /
          +formatUnits(outputAmount, getTokenDecimals(targetToken, chainId) || WAD_PRECISION)
        ).toString()
      : undefined;

  const isL2 = isL2ChainId(chainId);
  const isCowSupported = isCowSupportedChainId(chainId);
  const chainExplorerName = getExplorerName(chainId, isSafeWallet);

  useEffect(() => {
    setOriginToken(originToken);
    setOriginAmount(originAmount);
    setTargetToken(targetToken);
    setTargetAmount(targetAmount);
  }, [originToken, originAmount, targetToken, targetAmount]);

  // Sets the title and subtitle of the card
  useEffect(() => {
    if (isEthFlow) {
      setTxTitle(i18n._(ethFlowTradeTitle[ethFlowTxStatus as keyof EthTxCardCopyText]));
      setTxSubtitle(
        i18n._(
          ethFlowTradeSubtitle({
            ethFlowTxStatus,
            originToken,
            originAmount: formatBigInt(originAmount, {
              unit: getTokenDecimals(originToken, chainId)
            }),
            targetToken,
            targetAmount: formatBigInt(targetAmount, {
              unit: getTokenDecimals(targetToken, chainId)
            })
          })
        )
      );
      setTxDescription(
        i18n._(ethFlowTradeDescription({ originToken, targetToken, ethFlowTxStatus, executionPrice }))
      );
      setLoadingText(i18n._(ethFlowTradeLoadingButtonText({ ethFlowTxStatus })));
    } else {
      if (flow === TradeFlow.TRADE) setStepTwoTitle(t`Trade`);
      if (flow === TradeFlow.TRADE && action === TradeAction.APPROVE && screen === TradeScreen.TRANSACTION) {
        setStep(1);
        setLoadingText(
          i18n._(
            tradeApproveLoadingButtonText({
              txStatus,
              amount: formatBigInt(originAmount, {
                unit: getTokenDecimals(originToken, chainId)
              }),
              symbol: originToken.symbol
            })
          )
        );
        setTxTitle(i18n._(tradeApproveTitle[txStatus as keyof TxCardCopyText]));
        setTxSubtitle(i18n._(tradeApproveSubtitle(txStatus, originToken.symbol)));
        setTxDescription(
          i18n._(
            tradeApproveDescription({
              originToken,
              targetToken
            })
          )
        );
      } else if (
        flow === TradeFlow.TRADE &&
        action === TradeAction.TRADE &&
        screen === TradeScreen.TRANSACTION
      ) {
        setStep(2);
        setTxTitle(i18n._(tradeTitle[txStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            tradeSubtitle({
              txStatus,
              originToken,
              originAmount: formatBigInt(originAmount, {
                unit: getTokenDecimals(originToken, chainId)
              }),
              targetToken,
              targetAmount: formatBigInt(targetAmount, {
                unit: getTokenDecimals(targetToken, chainId)
              })
            })
          )
        );
        setTxDescription(i18n._(tradeDescription({ originToken, targetToken, txStatus, executionPrice })));
        setLoadingText(i18n._(tradeLoadingButtonText({ txStatus })));
      }
    }
  }, [txStatus, flow, action, screen, i18n.locale, isEthFlow, ethFlowTxStatus]);

  // Show USDT reset flow with two vertical steps (for both sequential and batched)
  if (isUsdtResetFlow && action === TradeAction.APPROVE) {
    const usdtResetSteps = (
      <>
        <motion.div variants={positionAnimations} className="flex w-full flex-col">
          <StepIndicator
            stepNumber={1}
            //first tx is active if we still need the reset
            //both steps are active if we're in a batch transaction
            currentStep={needsUsdtReset || isBatchTransaction}
            txStatus={isBatchTransaction ? txStatus : needsUsdtReset ? txStatus : TxStatus.SUCCESS}
            text={t`Reset USDT Approval`}
            className="flex-1"
            circleIndicator
          />
          <StepIndicator
            stepNumber={2}
            //if we no longer need reset, that means the first allowance reset tx has succeeded
            //both steps are active if we're in a batch transaction
            currentStep={!needsUsdtReset || isBatchTransaction}
            txStatus={isBatchTransaction ? txStatus : !needsUsdtReset ? txStatus : TxStatus.IDLE}
            text={t`Approve USDT`}
            className="flex-1"
            circleIndicator
          />
        </motion.div>
        <motion.div variants={positionAnimations}>
          {!!originToken && !!originAmount && (
            <HStack className="mt-8 items-center">
              <TokenIconWithBalance
                token={originToken}
                balance={formatBigInt(originAmount, {
                  unit: getTokenDecimals(originToken, chainId)
                })}
                textLarge
              />
              {!!targetToken && !!targetAmount && (
                <>
                  <ArrowRight />
                  <TokenIconWithBalance
                    token={targetToken}
                    balance={formatBigInt(targetAmount, {
                      unit: getTokenDecimals(targetToken, chainId)
                    })}
                    textLarge
                  />
                </>
              )}
            </HStack>
          )}
        </motion.div>
        <motion.div variants={positionAnimations}>
          <Text variant="medium" className="text-textSecondary mt-3 leading-4">
            {txDescription}
          </Text>
        </motion.div>
      </>
    );

    return (
      <TransactionStatus
        explorerName={chainExplorerName}
        onExternalLinkClicked={onExternalLinkClicked}
        transactionDetail={usdtResetSteps}
      />
    );
  }

  // Default behavior for everything else that's not a USDT reset flow
  return (
    <TransactionStatus
      explorerName={
        action === TradeAction.APPROVE || (isL2 && !isCowSupported)
          ? chainExplorerName
          : isEthFlow &&
              (ethFlowTxStatus === EthFlowTxStatus.SENDING_ETH ||
                ethFlowTxStatus === EthFlowTxStatus.CREATING_ORDER)
            ? chainExplorerName
            : ExplorerName.COW_EXPLORER
      }
      onExternalLinkClicked={onExternalLinkClicked}
    />
  );
};
