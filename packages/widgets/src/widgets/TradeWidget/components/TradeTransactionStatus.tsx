import { useContext, useEffect } from 'react';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { getTokenDecimals, OrderQuoteResponse, Token } from '@jetstreamgg/hooks';
import {
  WAD_PRECISION,
  formatBigInt,
  ExplorerName,
  getExplorerName,
  isL2ChainId,
  useIsSafeWallet
} from '@jetstreamgg/utils';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TransactionStatus } from '@widgets/shared/components/ui/transaction/TransactionStatus';
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
  tradeTitle
} from '../lib/constants';
import { TxStatus, approveLoadingButtonText } from '@widgets/shared/constants';
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
  onExternalLinkClicked
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
              unit: originToken ? getTokenDecimals(originToken, chainId) : 18
            }),
            targetToken,
            targetAmount: formatBigInt(targetAmount, {
              unit: targetToken ? getTokenDecimals(targetToken, chainId) : 18
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
        setLoadingText(i18n._(approveLoadingButtonText[txStatus as keyof TxCardCopyText]));
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
                unit: originToken ? getTokenDecimals(originToken, chainId) : 18
              }),
              targetToken,
              targetAmount: formatBigInt(targetAmount, {
                unit: targetToken ? getTokenDecimals(targetToken, chainId) : 18
              })
            })
          )
        );
        setTxDescription(i18n._(tradeDescription({ originToken, targetToken, txStatus, executionPrice })));
        setLoadingText(i18n._(tradeLoadingButtonText({ txStatus })));
      }
    }
  }, [txStatus, flow, action, screen, i18n.locale, isEthFlow, ethFlowTxStatus]);
  return (
    <TransactionStatus
      explorerName={
        action === TradeAction.APPROVE || isL2
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
