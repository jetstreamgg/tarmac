import {
  TOKENS,
  Token,
  daiUsdsAddress,
  getTokenDecimals,
  mkrSkyAddress,
  useIsBatchSupported,
  useTokenBalance,
  useMkrSkyFee,
  useTokenAllowance
} from '@jetstreamgg/sky-hooks';
import { UpgradeRevert } from './components/UpgradeRevert';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { UpgradeTransactionStatus } from './components/UpgradeTransactionStatus';
import { useConnection, useChainId } from 'wagmi';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce, math, useIsMetaMaskWallet } from '@jetstreamgg/sky-utils';
import { TxStatus } from '@widgets/shared/constants';
import { formatUnits, parseUnits } from 'viem';
import {
  defaultRevertOptions,
  defaultUpgradeOptions,
  UpgradeAction,
  UpgradeFlow,
  UpgradeScreen,
  upgradeTokens
} from './lib/constants';
import { useLingui } from '@lingui/react';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { getValidatedState } from '@widgets/lib/utils';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { UpgradeTransactionReview } from './components/UpgradeTransactionReview';
import { withWidgetProvider } from '@widgets/shared/hocs/withWidgetProvider';
import { useUpgradeTransactions } from './hooks/useUpgradeTransactions';
import {
  calculateOriginOptions,
  calculateTargetOptions,
  targetTokenForSymbol,
  tokenForSymbol
} from './lib/helpers';

export type UpgradeWidgetProps = WidgetProps & {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  upgradeOptions?: Token[];
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
};

export function UpgradeWidgetWrapped({
  addRecentTransaction,
  onConnect,
  rightHeaderComponent,
  externalWidgetState,
  onStateValidated,
  onNotification,
  onWidgetStateChange,
  onCustomNavigation,
  customNavigationLabel,
  onExternalLinkClicked,
  upgradeOptions = defaultUpgradeOptions,
  batchEnabled,
  setBatchEnabled,
  legalBatchTxUrl,
  enabled = true,
  disallowedFlow
}: UpgradeWidgetProps): React.ReactElement {
  const validatedExternalState = getValidatedState(externalWidgetState);
  const shouldAllowExternalUpdate = useRef(true);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const chainId = useChainId();
  const { address, isConnected, isConnecting } = useConnection();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);

  const initialTabIndex = validatedExternalState?.flow === UpgradeFlow.REVERT ? 1 : 0;

  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);
  const [originAmount, setOriginAmount] = useState(parseUnits(validatedExternalState?.amount || '0', 18));
  const debouncedOriginAmount = useDebounce(originAmount);
  const [originToken, setOriginToken] = useState<Token>(
    tokenForSymbol((validatedExternalState?.initialUpgradeToken as keyof typeof upgradeTokens) || 'DAI')
  );

  const [targetToken, setTargetToken] = useState<Token>(
    targetTokenForSymbol((validatedExternalState?.initialUpgradeToken as keyof typeof upgradeTokens) || 'DAI')
  );
  const linguiCtx = useLingui();

  useEffect(() => {
    setTabIndex(initialTabIndex);
  }, [initialTabIndex]);

  useEffect(() => {
    if (!shouldAllowExternalUpdate.current) return;

    const externalToken = validatedExternalState?.initialUpgradeToken;
    let newOriginToken: Token;

    if (externalToken) {
      // If we have an external token, use it
      newOriginToken = tokenForSymbol(externalToken as keyof typeof upgradeTokens);
    } else {
      // If no external token, check if current originToken matches the flow
      const isUpgradeToken = originToken.symbol === 'DAI' || originToken.symbol === 'MKR';
      const isRevertToken = originToken.symbol === 'USDS' || originToken.symbol === 'SKY';
      const isFlowUpgrade =
        validatedExternalState?.flow === undefined || validatedExternalState?.flow === UpgradeFlow.UPGRADE;

      if ((isFlowUpgrade && !isUpgradeToken) || (!isFlowUpgrade && !isRevertToken)) {
        // Token doesn't match flow, set to default
        newOriginToken = tokenForSymbol(
          (validatedExternalState?.flow === UpgradeFlow.REVERT ? 'USDS' : 'DAI') as keyof typeof upgradeTokens
        );
      } else {
        // Current token is valid for the flow, keep it
        newOriginToken = originToken;
      }
    }

    const newTargetToken = targetTokenForSymbol(newOriginToken.symbol as keyof typeof upgradeTokens);

    if (newOriginToken && newTargetToken) {
      setOriginToken(newOriginToken);
      setTargetToken(newTargetToken);
    }

    if (validatedExternalState?.amount !== undefined) {
      setOriginAmount(parseUnits(validatedExternalState.amount, 18));
    }
  }, [
    validatedExternalState?.initialUpgradeToken,
    validatedExternalState?.amount,
    validatedExternalState?.flow,
    originToken
  ]);

  const {
    setButtonText,
    setIsDisabled,
    setIsLoading,
    txStatus,
    setTxStatus,
    setExternalLink,
    widgetState,
    setWidgetState,
    setShowStepIndicator
  } = useContext(WidgetContext);

  useNotifyWidgetState({
    widgetState,
    txStatus,
    originToken: originToken?.symbol,
    targetToken: targetToken?.symbol,
    onWidgetStateChange
  });

  // Balance of the tokens to be upgraded/reverted
  const { data: originBalance, refetch: mutateOriginBalance } = useTokenBalance({
    chainId,
    address: address,
    token: originToken.address[chainId]
  });

  // Balance of the target token
  const { data: targetBalance, refetch: mutateTargetBalance } = useTokenBalance({
    chainId,
    address: address,
    token: targetToken.address[chainId]
  });

  const { data: batchSupported } = useIsBatchSupported();
  const isMetaMaskWallet = useIsMetaMaskWallet();

  // Fetch the current fee from the contract
  const { data: mkrSkyFee, isLoading: isFeeLoading } = useMkrSkyFee();

  // Calculate target amount with fee applied
  const targetAmount = useMemo(() => {
    // Don't calculate if fee is still loading or undefined
    if (isFeeLoading || mkrSkyFee === undefined) {
      return 0n;
    }
    return math.calculateConversion(originToken, debouncedOriginAmount, mkrSkyFee);
  }, [originToken, debouncedOriginAmount, mkrSkyFee, isFeeLoading]);

  const { data: allowance, mutate: mutateAllowance } = useTokenAllowance({
    chainId,
    contractAddress: originToken.address[chainId],
    owner: address,
    spender:
      originToken.symbol === 'DAI' || originToken.symbol === 'USDS'
        ? daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
        : mkrSkyAddress[chainId as keyof typeof mkrSkyAddress]
  });
  const hasAllowance = !!(allowance && debouncedOriginAmount !== 0n && allowance >= debouncedOriginAmount);
  // MKR to SKY conversion is not supported in MetaMask as a bundled transaction as it's throwing missleading warnings
  // So we we avoid the bundled Upgrade MKR flow in MetaMask for now
  const shouldAvoidBundledFlow = originToken.symbol === 'MKR' && isMetaMaskWallet;
  const shouldUseBatch = !!batchEnabled && !!batchSupported && !hasAllowance && !shouldAvoidBundledFlow;

  const { batchActionManager } = useUpgradeTransactions({
    originToken,
    targetToken,
    originAmount,
    shouldUseBatch,
    tabIndex,
    shouldAllowExternalUpdate,
    mutateAllowance,
    mutateOriginBalance,
    mutateTargetBalance,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  useEffect(() => {
    if (txStatus === TxStatus.IDLE) {
      setShowStepIndicator(!hasAllowance);
    }
  }, [txStatus, hasAllowance, setShowStepIndicator]);

  useEffect(() => {
    if (widgetState.screen === UpgradeScreen.TRANSACTION || widgetState.screen === UpgradeScreen.REVIEW)
      return;
    const flow = validatedExternalState?.flow || (tabIndex === 0 ? UpgradeFlow.UPGRADE : UpgradeFlow.REVERT);
    if (isConnectedAndEnabled) {
      // Use external flow if available, otherwise use tabIndex
      if (flow === UpgradeFlow.UPGRADE) {
        setWidgetState({
          flow: UpgradeFlow.UPGRADE,
          action: UpgradeAction.UPGRADE,
          screen: UpgradeScreen.ACTION
        });
      } else if (flow === UpgradeFlow.REVERT) {
        setWidgetState({
          flow: UpgradeFlow.REVERT,
          action: UpgradeAction.REVERT,
          screen: UpgradeScreen.ACTION
        });
      }
    } else {
      // Reset widget state when we are not connected, but still respect external flow
      setWidgetState({
        flow,
        action: null,
        screen: null
      });
    }
  }, [isConnectedAndEnabled, validatedExternalState?.flow, tabIndex, widgetState.screen]);

  const isBalanceError =
    txStatus === TxStatus.IDLE &&
    (originBalance?.value || originBalance?.value === 0n) &&
    debouncedOriginAmount &&
    debouncedOriginAmount > 0n &&
    debouncedOriginAmount > originBalance.value &&
    originAmount !== 0n //don't wait for debouncing on default state
      ? true
      : false;

  const isAmountWaitingForDebounce = debouncedOriginAmount !== originAmount;

  const batchCallDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    !batchActionManager.prepared ||
    batchActionManager.isLoading ||
    isBalanceError ||
    isAmountWaitingForDebounce;

  const nextOnClick = () => {
    shouldAllowExternalUpdate.current = true;
    setTxStatus(TxStatus.IDLE);
    setOriginAmount(0n);

    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: UpgradeAction.UPGRADE,
      screen: UpgradeScreen.ACTION
    }));

    onWidgetStateChange?.({
      originAmount: '',
      originToken: '',
      widgetState: {
        ...widgetState,
        action: UpgradeAction.UPGRADE,
        screen: UpgradeScreen.ACTION
      },
      txStatus: TxStatus.IDLE
    });
  };

  // Handle the error onClicks separately to keep it clear
  const errorOnClick = () => {
    return batchActionManager.execute();
  };

  const reviewOnClick = () => {
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: UpgradeScreen.REVIEW
    }));
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : txStatus === TxStatus.SUCCESS && customNavigationLabel
      ? onCustomNavigation
      : txStatus === TxStatus.SUCCESS
        ? nextOnClick
        : txStatus === TxStatus.ERROR
          ? errorOnClick
          : widgetState.screen === UpgradeScreen.ACTION
            ? reviewOnClick
            : widgetState.flow === UpgradeFlow.UPGRADE || widgetState.flow === UpgradeFlow.REVERT
              ? batchActionManager.execute
              : undefined;

  const onClickBack = () => {
    shouldAllowExternalUpdate.current = true;
    setTxStatus(TxStatus.IDLE);
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: UpgradeScreen.ACTION }));
  };

  const showSecondaryButton =
    !!customNavigationLabel || txStatus === TxStatus.ERROR || widgetState.screen === UpgradeScreen.REVIEW;

  // Update button state according to action and tx
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (txStatus === TxStatus.SUCCESS) {
        if (customNavigationLabel) {
          setButtonText(customNavigationLabel);
        } else {
          setButtonText(t`Back to Upgrade`);
        }
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (widgetState.screen === UpgradeScreen.ACTION && debouncedOriginAmount === 0n) {
        setButtonText(t`Enter amount`);
      } else if (widgetState.screen === UpgradeScreen.ACTION) {
        setButtonText(t`Review`);
      } else if (widgetState.screen === UpgradeScreen.REVIEW) {
        if (shouldUseBatch) {
          setButtonText(t`Confirm bundled transaction`);
        } else if (!hasAllowance) {
          setButtonText(t`Confirm 2 transactions`);
        } else if (widgetState.flow === UpgradeFlow.UPGRADE) {
          setButtonText(t`Confirm upgrade`);
        } else if (widgetState.flow === UpgradeFlow.REVERT) {
          setButtonText(t`Confirm revert`);
        }
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [
    widgetState.action,
    widgetState.flow,
    widgetState.screen,
    txStatus,
    debouncedOriginAmount,
    linguiCtx,
    isConnectedAndEnabled,
    customNavigationLabel,
    shouldUseBatch,
    hasAllowance
  ]);

  // Set widget button to be disabled depending on which flow we're in
  useEffect(() => {
    setIsDisabled(isConnectedAndEnabled && batchCallDisabled);
  }, [isConnectedAndEnabled, batchCallDisabled]);

  // Set isLoading to be consumed by WidgetButton
  useEffect(() => {
    setIsLoading(isConnecting || txStatus === TxStatus.LOADING || txStatus === TxStatus.INITIALIZED);
  }, [txStatus, isConnecting]);

  // Reset widget state after switching network
  useEffect(() => {
    // Reset all state variables
    setOriginAmount(parseUnits(validatedExternalState?.amount || '0', 18));
    setTxStatus(TxStatus.IDLE);
    setExternalLink(undefined);

    // Reset tokens to initial values
    setOriginToken(
      tokenForSymbol((validatedExternalState?.initialUpgradeToken as keyof typeof upgradeTokens) || 'DAI')
    );
    setTargetToken(
      targetTokenForSymbol(
        (validatedExternalState?.initialUpgradeToken as keyof typeof upgradeTokens) || 'DAI'
      )
    );

    // Reset widget state to initial screen based on current tab
    if (tabIndex === 0) {
      setWidgetState({
        flow: UpgradeFlow.UPGRADE,
        action: UpgradeAction.UPGRADE,
        screen: UpgradeScreen.ACTION
      });
    } else {
      setWidgetState({
        flow: UpgradeFlow.REVERT,
        action: UpgradeAction.REVERT,
        screen: UpgradeScreen.ACTION
      });
    }

    // Refresh data
    mutateAllowance();
    mutateOriginBalance();
    mutateTargetBalance();
  }, [chainId]);

  return (
    <WidgetContainer
      header={
        <Heading variant="x-large">
          <Trans>Upgrade</Trans>
        </Heading>
      }
      subHeader={
        <Text className="text-textSecondary" variant="small">
          <Trans>Upgrade your DAI to USDS and MKR to SKY</Trans>
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
        {txStatus !== TxStatus.IDLE ? (
          <CardAnimationWrapper key="widget-transaction-status">
            <UpgradeTransactionStatus
              originToken={originToken}
              originAmount={originAmount}
              targetToken={targetToken}
              targetAmount={targetAmount}
              onExternalLinkClicked={onExternalLinkClicked}
              isBatchTransaction={shouldUseBatch}
              needsAllowance={!hasAllowance}
            />
          </CardAnimationWrapper>
        ) : widgetState.screen === UpgradeScreen.REVIEW ? (
          <CardAnimationWrapper key="widget-transaction-review">
            <UpgradeTransactionReview
              batchEnabled={batchEnabled && !shouldAvoidBundledFlow}
              setBatchEnabled={setBatchEnabled}
              isBatchTransaction={shouldUseBatch}
              originToken={originToken}
              originAmount={debouncedOriginAmount}
              targetToken={targetToken}
              targetAmount={targetAmount}
              needsAllowance={!hasAllowance}
              legalBatchTxUrl={legalBatchTxUrl}
              isBatchFlowSupported={!shouldAvoidBundledFlow}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-inputs" className="w-full">
            <VStack className="w-full">
              <UpgradeRevert
                leftTabTitle={t`Upgrade`}
                rightTabTitle={t`Revert`}
                originTitle={
                  tabIndex === 0
                    ? t`Choose a token to upgrade, and enter an amount`
                    : t`Enter an amount of USDS to revert`
                }
                originAmount={originAmount}
                targetAmount={targetAmount}
                mkrSkyFee={mkrSkyFee}
                isFeeLoading={isFeeLoading}
                originOptions={calculateOriginOptions(
                  originToken,
                  tabIndex === 0 ? 'upgrade' : 'revert',
                  upgradeOptions,
                  defaultRevertOptions
                )}
                originToken={originToken}
                targetToken={targetToken}
                originBalance={originBalance?.value}
                targetBalance={targetBalance?.value}
                disallowedFlow={disallowedFlow}
                onToggle={(index: 0 | 1) => {
                  if (tabIndex === index) {
                    return;
                  }

                  const targetFlow = index === 0 ? UpgradeFlow.UPGRADE : UpgradeFlow.REVERT;
                  if (disallowedFlow && disallowedFlow === targetFlow) {
                    return;
                  }

                  setTabIndex(index);
                  //Always default to DAI / USDS flow when toggling tabs
                  const newOriginToken = index === 0 ? TOKENS.dai : TOKENS.usds;
                  const newTargetToken = index === 0 ? TOKENS.usds : TOKENS.dai;
                  setOriginToken(newOriginToken);
                  setTargetToken(newTargetToken);
                  setOriginAmount(0n);

                  if (isConnectedAndEnabled) {
                    if (index === 0) {
                      //Initialize the upgrade flow
                      setWidgetState({
                        flow: UpgradeFlow.UPGRADE,
                        action: UpgradeAction.UPGRADE,
                        screen: UpgradeScreen.ACTION
                      });
                    } else if (index === 1) {
                      //Initialize the revert flow
                      setWidgetState({
                        flow: UpgradeFlow.REVERT,
                        action: UpgradeAction.REVERT,
                        screen: UpgradeScreen.ACTION
                      });
                    }
                  } else {
                    setWidgetState({
                      flow: index === 0 ? UpgradeFlow.UPGRADE : UpgradeFlow.REVERT,
                      action: null,
                      screen: null
                    });
                  }

                  onWidgetStateChange?.({
                    originToken: newOriginToken.symbol,
                    txStatus,
                    widgetState: {
                      ...widgetState,
                      flow: index === 0 ? UpgradeFlow.UPGRADE : UpgradeFlow.REVERT
                    }
                  });
                }}
                onOriginInputChange={(val, userTriggered) => {
                  setOriginAmount(val);
                  if (originToken && userTriggered) {
                    const formattedValue = formatUnits(val, getTokenDecimals(originToken, chainId));
                    onWidgetStateChange?.({
                      originAmount: formattedValue,
                      txStatus,
                      widgetState
                    });
                  }
                }}
                tabIndex={tabIndex}
                error={isBalanceError ? new Error(t`Insufficient funds`) : undefined}
                onMenuItemChange={(op: Token | null) => {
                  if (op) {
                    setOriginToken(op as Token);
                    const target = calculateTargetOptions(op as Token, upgradeOptions, [
                      TOKENS.usds,
                      TOKENS.sky
                    ]);
                    if (target?.length) {
                      setTargetToken(target[0]);
                    }
                    onWidgetStateChange?.({
                      originToken: op.symbol,
                      txStatus,
                      widgetState
                    });
                  }
                }}
                isConnectedAndEnabled={isConnectedAndEnabled}
              />
            </VStack>
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
}

export const UpgradeWidget = withWidgetProvider(UpgradeWidgetWrapped, 'UpgradeWidget');
