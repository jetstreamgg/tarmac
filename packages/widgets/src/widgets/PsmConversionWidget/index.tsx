import {
  type TokenForChain,
  getTokenDecimals,
  useTokenBalance,
  useIsBatchSupported
} from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { formatUnits, parseUnits } from 'viem';
import { useChainId, useConnection } from 'wagmi';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TxStatus, notificationTypeMaping } from '@widgets/shared/constants';
import { WidgetAnalyticsEventType } from '@widgets/shared/types/analyticsEvents';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { withWidgetProvider } from '@widgets/shared/hocs/withWidgetProvider';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@widgets/components/ui/button';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { ArrowLeft } from 'lucide-react';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { getValidatedState } from '@widgets/lib/utils';
import { PsmConversionInputs } from './components/PsmConversionInputs';
import { PsmConversionReview } from './components/PsmConversionReview';
import { PsmConversionStatus } from './components/PsmConversionStatus';
import { usePsmConversion } from './hooks/usePsmConversion';
import {
  getPsmTargetAmount,
  type PsmConversionDirection,
  type PsmConversionDisabledReason
} from './hooks/usePsmConversion.helpers';
import { PsmConversionAction, PsmConversionFlow, PsmConversionScreen } from './lib/constants';

export type PsmConversionWidgetProps = WidgetProps & {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  onBackToConvert?: () => void;
};

const supportedTokens = ['USDC', 'USDS'];

const getDirectionForToken = (symbol?: string): PsmConversionDirection =>
  symbol?.toUpperCase() === 'USDS' ? 'USDS_TO_USDC' : 'USDC_TO_USDS';

const getDecimalsForDirection = (direction: PsmConversionDirection) =>
  direction === 'USDC_TO_USDS' ? 6 : 18;

const getDisabledReasonText = (reason?: PsmConversionDisabledReason) => {
  switch (reason) {
    case 'unsupported_chain':
      return t`This conversion is not available on the current network.`;
    case 'amount_too_small':
      return t`Enter a larger amount to continue.`;
    case 'psm_unavailable':
      return t`The mainnet Peg Stability Module is currently unavailable.`;
    case 'direction_halted':
      return t`This conversion direction is temporarily halted on mainnet.`;
    case 'non_zero_fee':
      return t`Mainnet wrapper fees are active right now, so this flow is temporarily disabled.`;
    case 'insufficient_liquidity':
      return t`There is not enough USDC liquidity available for this conversion.`;
    default:
      return undefined;
  }
};

function PsmConversionWidgetWrapped({
  onConnect,
  addRecentTransaction,
  rightHeaderComponent,
  externalWidgetState,
  onStateValidated,
  onNotification,
  onWidgetStateChange,
  onExternalLinkClicked,
  onAnalyticsEvent,
  enabled = true,
  legalBatchTxUrl,
  referralCode,
  batchEnabled,
  setBatchEnabled,
  onBackToConvert
}: PsmConversionWidgetProps): React.ReactElement {
  const validatedExternalState = getValidatedState(externalWidgetState, supportedTokens);
  const initialDirection = getDirectionForToken(validatedExternalState?.token);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const chainId = useChainId();
  const { address, isConnected, isConnecting } = useConnection();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [enabled, isConnected]);
  const initialAmount = parseUnits(
    validatedExternalState?.amount || '0',
    getDecimalsForDirection(initialDirection)
  );

  const [direction, setDirection] = useState<PsmConversionDirection>(initialDirection);
  const [originAmount, setOriginAmount] = useState(initialAmount);

  const {
    setButtonText,
    setIsDisabled,
    setIsLoading,
    setTxStatus,
    txStatus,
    setExternalLink,
    widgetState,
    setWidgetState,
    setBackButtonText
  } = useContext(WidgetContext);
  const lastWidgetStateNotificationRef = useRef<{
    txStatus: TxStatus;
    flow?: string;
    action?: string;
    screen?: string;
    originToken: string;
    targetToken: string;
    originAmount: string;
  } | undefined>(undefined);

  useEffect(() => {
    // Don't override origin amount during active transactions to avoid a race condition
    // where handleOnSuccess calls onWidgetStateChange without originAmount, causing the
    // parent to clear the URL param, which resets originAmount to 0n before the success
    // screen renders.
    if (txStatus !== TxStatus.IDLE) return;
    const nextDirection = getDirectionForToken(validatedExternalState?.token);
    setDirection(nextDirection);
    setOriginAmount(parseUnits(validatedExternalState?.amount || '0', getDecimalsForDirection(nextDirection)));
  }, [validatedExternalState?.amount, validatedExternalState?.token, txStatus]);

  const transactionStateRef = useRef<{
    originToken?: TokenForChain;
    targetToken?: TokenForChain;
    needsAllowance: boolean;
    shouldUseBatch: boolean;
    action: PsmConversionAction;
  }>({
    originToken: undefined,
    targetToken: undefined,
    needsAllowance: false,
    shouldUseBatch: false,
    action: PsmConversionAction.CONVERT
  });
  const stepRef = useRef(0);

  const { handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const fireAnalytics = useCallback(
    (event: Parameters<NonNullable<typeof onAnalyticsEvent>>[0]) => {
      try {
        onAnalyticsEvent?.(event);
      } catch {
        // Analytics must never break widget execution.
      }
    },
    [onAnalyticsEvent]
  );

  const { data: batchSupported } = useIsBatchSupported();

  const conversion = usePsmConversion({
    direction,
    amount: originAmount,
    referralCode,
    enabled: isConnectedAndEnabled,
    shouldUseBatch: !!batchEnabled,
    onMutate: () => {
      const current = transactionStateRef.current;
      const isApproveStep = current.needsAllowance && !current.shouldUseBatch && stepRef.current === 0;
      const action = isApproveStep ? PsmConversionAction.APPROVE : PsmConversionAction.CONVERT;

      stepRef.current += 1;
      transactionStateRef.current = { ...current, action };

      setWidgetState({
        flow: PsmConversionFlow.CONVERT,
        action,
        screen: PsmConversionScreen.TRANSACTION
      });
      setTxStatus(TxStatus.INITIALIZED);
      setExternalLink(undefined);

      fireAnalytics({
        event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
        action,
        flow: PsmConversionFlow.CONVERT,
        amount: Number(formatUnits(originAmount, getTokenDecimals(current.originToken, chainId))),
        assetSymbol: current.originToken?.symbol,
        data: {
          module: 'convert',
          convert_module: 'psm',
          direction,
          target_symbol: current.targetToken?.symbol,
          isBatchTx: current.shouldUseBatch
        }
      });
    },
    onStart: () => null,
    onSuccess: hash => {
      const current = transactionStateRef.current;
      stepRef.current = 0;
      handleOnSuccess({
        hash,
        notificationTitle: t`Conversion successful`,
        notificationDescription: t`You converted ${formatBigInt(originAmount, {
          unit: getTokenDecimals(current.originToken, chainId)
        })} ${current.originToken?.symbol || ''} into ${formatBigInt(getPsmTargetAmount(direction, originAmount), {
          unit: getTokenDecimals(current.targetToken, chainId)
        })} ${current.targetToken?.symbol || ''}`,
        notificationType: notificationTypeMaping[current.targetToken?.symbol?.toUpperCase() || 'none']
      });
      setBackButtonText(t`Back`);
      fireAnalytics({
        event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
        action: PsmConversionAction.CONVERT,
        flow: PsmConversionFlow.CONVERT,
        txHash: hash,
        amount: Number(formatUnits(originAmount, getTokenDecimals(current.originToken, chainId))),
        assetSymbol: current.originToken?.symbol,
        data: {
          module: 'convert',
          convert_module: 'psm',
          direction,
          target_symbol: current.targetToken?.symbol,
          isBatchTx: current.shouldUseBatch
        }
      });
    },
    onError: (error, hash) => {
      const current = transactionStateRef.current;
      stepRef.current = 0;
      handleOnError({
        error,
        hash,
        notificationTitle: t`Conversion failed`,
        notificationDescription: t`Something went wrong with your transaction. Please try again.`
      });
      fireAnalytics({
        event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
        action: current.action,
        flow: PsmConversionFlow.CONVERT,
        txHash: hash,
        amount: Number(formatUnits(originAmount, getTokenDecimals(current.originToken, chainId))),
        assetSymbol: current.originToken?.symbol,
        data: {
          module: 'convert',
          convert_module: 'psm',
          direction,
          target_symbol: current.targetToken?.symbol,
          isBatchTx: current.shouldUseBatch,
          error_message: error.message
        }
      });
    }
  });

  useEffect(() => {
    transactionStateRef.current = {
      originToken: conversion.originToken,
      targetToken: conversion.targetToken,
      needsAllowance: conversion.needsAllowance,
      shouldUseBatch: conversion.shouldUseBatch,
      action: transactionStateRef.current.action
    };
  }, [
    conversion.needsAllowance,
    conversion.originToken,
    conversion.shouldUseBatch,
    conversion.targetToken
  ]);

  const { data: originBalance, refetch: mutateOriginBalance } = useTokenBalance({
    chainId,
    address,
    token: conversion.originToken?.address
  });
  const { data: targetBalance, refetch: mutateTargetBalance } = useTokenBalance({
    chainId,
    address,
    token: conversion.targetToken?.address
  });

  useEffect(() => {
    if (txStatus === TxStatus.SUCCESS || txStatus === TxStatus.ERROR) {
      conversion.mutateAllowance();
      conversion.mutatePocketBalance();
      mutateOriginBalance();
      mutateTargetBalance();
    }
  }, [conversion, mutateOriginBalance, mutateTargetBalance, txStatus]);

  useEffect(() => {
    setWidgetState({
      flow: PsmConversionFlow.CONVERT,
      action: PsmConversionAction.CONVERT,
      screen: PsmConversionScreen.ACTION
    });
    setTxStatus(TxStatus.IDLE);
    setExternalLink(undefined);
  }, [chainId, setExternalLink, setTxStatus, setWidgetState]);

  const isBalanceError = Boolean(
    txStatus === TxStatus.IDLE &&
      originBalance &&
      originAmount > originBalance.value &&
      originAmount !== 0n
  );
  const disabledReasonText = getDisabledReasonText(conversion.disabledReason);
  const reviewDisabled =
    originAmount === 0n ||
    isBalanceError ||
    !!conversion.disabledReason ||
    !conversion.originToken ||
    !conversion.targetToken;
  const confirmDisabled =
    reviewDisabled || !conversion.prepared || conversion.isLoading || !!conversion.error;

  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (txStatus === TxStatus.SUCCESS) {
        setButtonText(t`Convert again`);
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (widgetState.screen === PsmConversionScreen.ACTION) {
        if (conversion.disabledReason === 'unsupported_chain') {
          setButtonText(t`Unsupported network`);
        } else if (originAmount === 0n) {
          setButtonText(t`Enter amount`);
        } else {
          setButtonText(t`Review`);
        }
      } else if (widgetState.screen === PsmConversionScreen.REVIEW) {
        if (conversion.shouldUseBatch) {
          setButtonText(t`Confirm bundled transaction`);
        } else if (conversion.needsAllowance) {
          setButtonText(t`Confirm 2 transactions`);
        } else {
          setButtonText(t`Confirm conversion`);
        }
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [
    conversion.disabledReason,
    conversion.needsAllowance,
    conversion.shouldUseBatch,
    isConnectedAndEnabled,
    originAmount,
    setButtonText,
    txStatus,
    widgetState.screen
  ]);

  useEffect(() => {
    const disabled =
      widgetState.screen === PsmConversionScreen.REVIEW ? confirmDisabled : reviewDisabled;
    setIsDisabled(txStatus === TxStatus.IDLE && isConnectedAndEnabled && disabled);
  }, [confirmDisabled, isConnectedAndEnabled, reviewDisabled, setIsDisabled, txStatus, widgetState.screen]);

  useEffect(() => {
    setIsLoading(isConnecting || txStatus === TxStatus.LOADING || txStatus === TxStatus.INITIALIZED);
  }, [isConnecting, setIsLoading, txStatus]);

  useEffect(() => {
    if (!onWidgetStateChange) {
      return;
    }

    const nextState = {
      txStatus,
      flow: widgetState.flow,
      action: widgetState.action,
      screen: widgetState.screen,
      originToken: conversion.originToken?.symbol || '',
      targetToken: conversion.targetToken?.symbol || '',
      originAmount:
        originAmount > 0n
          ? formatUnits(originAmount, getTokenDecimals(conversion.originToken, chainId))
          : ''
    };
    const previousState = lastWidgetStateNotificationRef.current;

    if (
      previousState &&
      previousState.txStatus === nextState.txStatus &&
      previousState.flow === nextState.flow &&
      previousState.action === nextState.action &&
      previousState.screen === nextState.screen &&
      previousState.originToken === nextState.originToken &&
      previousState.targetToken === nextState.targetToken &&
      previousState.originAmount === nextState.originAmount
    ) {
      return;
    }

    lastWidgetStateNotificationRef.current = nextState;
    onWidgetStateChange({
      originToken: nextState.originToken,
      targetToken: nextState.targetToken,
      originAmount: nextState.originAmount,
      txStatus,
      widgetState
    });
  }, [chainId, conversion.originToken, conversion.targetToken, onWidgetStateChange, originAmount, txStatus, widgetState]);

  const reviewOnClick = () => {
    fireAnalytics({
      event: WidgetAnalyticsEventType.REVIEW_VIEWED,
      action: PsmConversionAction.CONVERT,
      flow: PsmConversionFlow.CONVERT,
      amount: Number(formatUnits(originAmount, getTokenDecimals(conversion.originToken, chainId))),
      assetSymbol: conversion.originToken?.symbol,
      data: {
        module: 'convert',
        convert_module: 'psm',
        direction,
        target_symbol: conversion.targetToken?.symbol,
        isBatchTx: conversion.shouldUseBatch
      }
    });
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: PsmConversionScreen.REVIEW
    }));
  };

  const convertOnClick = () => {
    conversion.execute();
  };

  const retryOnClick = () => {
    // Reset the sequential flow after a failed approval so the wallet is prompted
    // for the approval signature again instead of reusing stale hook state.
    if (widgetState.action === PsmConversionAction.APPROVE) {
      stepRef.current = 0;
      conversion.reset();
      setExternalLink(undefined);
    }

    conversion.execute();
  };

  const resetFlow = () => {
    stepRef.current = 0;
    conversion.reset();
    setTxStatus(TxStatus.IDLE);
    setExternalLink(undefined);
    setOriginAmount(0n);
    setWidgetState({
      flow: PsmConversionFlow.CONVERT,
      action: PsmConversionAction.CONVERT,
      screen: PsmConversionScreen.ACTION
    });
    onWidgetStateChange?.({
      originToken: conversion.originToken?.symbol || '',
      targetToken: conversion.targetToken?.symbol || '',
      originAmount: '',
      txStatus: TxStatus.IDLE,
      widgetState: {
        flow: PsmConversionFlow.CONVERT,
        action: PsmConversionAction.CONVERT,
        screen: PsmConversionScreen.ACTION
      },
      hash: undefined
    });
  };

  const onClickBack = () => {
    conversion.reset();
    setTxStatus(TxStatus.IDLE);
    setExternalLink(undefined);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: PsmConversionAction.CONVERT,
      screen: PsmConversionScreen.ACTION
    }));
  };

  const onSwitchDirection = () => {
    const nextDirection = direction === 'USDC_TO_USDS' ? 'USDS_TO_USDC' : 'USDC_TO_USDS';
    const nextAmount = getPsmTargetAmount(direction, originAmount);

    conversion.reset();
    setTxStatus(TxStatus.IDLE);
    setExternalLink(undefined);
    setDirection(nextDirection);
    setOriginAmount(nextAmount);
    setWidgetState({
      flow: PsmConversionFlow.CONVERT,
      action: PsmConversionAction.CONVERT,
      screen: PsmConversionScreen.ACTION
    });
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : txStatus === TxStatus.SUCCESS
      ? resetFlow
      : txStatus === TxStatus.ERROR
        ? retryOnClick
        : widgetState.screen === PsmConversionScreen.ACTION
          ? reviewOnClick
          : convertOnClick;

  const showSecondaryButton =
    txStatus === TxStatus.ERROR || widgetState.screen === PsmConversionScreen.REVIEW;

  const overviewData =
    conversion.originToken && conversion.targetToken && originAmount > 0n
      ? [
          {
            label: t`Exchange Rate`,
            value: direction === 'USDC_TO_USDS' ? '1:1' : '1:1'
          },
          {
            label: t`Tokens to receive`,
            value: `${formatBigInt(conversion.targetAmount, {
              unit: getTokenDecimals(conversion.targetToken, chainId),
              compact: true
            })} ${conversion.targetToken.symbol}`
          },
          {
            label: t`Your wallet ${conversion.originToken.symbol} balance`,
            value:
              originBalance?.value !== undefined
                ? [
                    formatBigInt(originBalance.value, {
                      unit: getTokenDecimals(conversion.originToken, chainId),
                      compact: true
                    }),
                    formatBigInt(originBalance.value - originAmount, {
                      unit: getTokenDecimals(conversion.originToken, chainId),
                      compact: true
                    })
                  ]
                : '--'
          },
          {
            label: t`Your wallet ${conversion.targetToken.symbol} balance`,
            value:
              targetBalance?.value !== undefined
                ? [
                    formatBigInt(targetBalance.value, {
                      unit: getTokenDecimals(conversion.targetToken, chainId),
                      compact: true
                    }),
                    formatBigInt(targetBalance.value + conversion.targetAmount, {
                      unit: getTokenDecimals(conversion.targetToken, chainId),
                      compact: true
                    })
                  ]
                : '--'
          },
          ...(direction === 'USDS_TO_USDC' && conversion.pocketBalance !== undefined
            ? [
                {
                  label: t`Available USDC liquidity`,
                  value: `${formatBigInt(conversion.pocketBalance, {
                    unit: 6,
                    compact: true
                  })} USDC`
                }
              ]
            : [])
        ]
      : undefined;

  return (
    <WidgetContainer
      header={
        <div>
          {onBackToConvert && (
            <Button variant="link" onClick={onBackToConvert} className="mb-2 p-0">
              <HStack className="space-x-2">
                <ArrowLeft className="self-center" />
                <Heading tag="h3" variant="small" className="text-textSecondary">
                  <Trans>Back to Convert</Trans>
                </Heading>
              </HStack>
            </Button>
          )}
          <Heading variant="x-large">
            <Trans>1:1 Conversion</Trans>
          </Heading>
        </div>
      }
      subHeader={
        <Text className="text-textSecondary" variant="small">
          <Trans>Convert your USDC to USDS, or USDS to USDC at 1:1 rate with no fees and slippage</Trans>
        </Text>
      }
      rightHeader={rightHeaderComponent}
      footer={
        <WidgetButtons
          onClickAction={onClickAction}
          onClickBack={onClickBack}
          showSecondaryButton={showSecondaryButton}
          enabled={enabled}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {conversion.originToken && conversion.targetToken && txStatus !== TxStatus.IDLE ? (
          <CardAnimationWrapper key="psm-conversion-status">
            <PsmConversionStatus
              originToken={conversion.originToken as any}
              originAmount={originAmount}
              targetToken={conversion.targetToken as any}
              targetAmount={conversion.targetAmount}
              onExternalLinkClicked={onExternalLinkClicked}
              isBatchTransaction={conversion.shouldUseBatch}
              needsAllowance={conversion.needsAllowance}
              currentCallIndex={conversion.currentCallIndex}
            />
          </CardAnimationWrapper>
        ) : widgetState.screen === PsmConversionScreen.REVIEW &&
          conversion.originToken &&
          conversion.targetToken ? (
          <CardAnimationWrapper key="psm-conversion-review">
            <PsmConversionReview
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
              isBatchTransaction={conversion.shouldUseBatch}
              originToken={conversion.originToken as any}
              originAmount={originAmount}
              targetToken={conversion.targetToken as any}
              targetAmount={conversion.targetAmount}
              needsAllowance={conversion.needsAllowance}
              legalBatchTxUrl={legalBatchTxUrl}
              isBatchFlowSupported={!!batchSupported}
            />
          </CardAnimationWrapper>
        ) : conversion.originToken && conversion.targetToken ? (
          <CardAnimationWrapper key="psm-conversion-inputs">
            <div className="space-y-4">
              <PsmConversionInputs
                originToken={conversion.originToken as any}
                targetToken={conversion.targetToken as any}
                originAmount={originAmount}
                targetAmount={conversion.targetAmount}
                originBalance={originBalance?.value}
                targetBalance={targetBalance?.value}
                isBalanceError={isBalanceError}
                isConnectedAndEnabled={isConnectedAndEnabled}
                onOriginAmountChange={setOriginAmount}
                onSwitchDirection={onSwitchDirection}
              />

              {(disabledReasonText || conversion.error) && (
                <Text className="text-sm text-error">
                  {disabledReasonText || conversion.error?.message}
                </Text>
              )}

              {overviewData && (
                <TransactionOverview
                  title={t`Transaction overview`}
                  isFetching={false}
                  fetchingMessage={t`Fetching transaction details`}
                  transactionData={overviewData}
                />
              )}
            </div>
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="psm-conversion-unsupported">
            <Text className="text-textSecondary">
              <Trans>1:1 conversion is available on Ethereum mainnet and supported Layer 2 networks.</Trans>
            </Text>
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
}

export const PsmConversionWidget = withWidgetProvider(
  PsmConversionWidgetWrapped,
  'PsmConversionWidget'
);
