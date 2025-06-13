import {
  TOKENS,
  Token,
  daiUsdsAddress,
  getTokenDecimals,
  mkrSkyAddress,
  useTokenBalance
} from '@jetstreamgg/sky-hooks';
import { UpgradeRevert } from './components/UpgradeRevert';
import { WidgetContext, WidgetProvider } from '@widgets/context/WidgetContext';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Heading } from '@widgets/shared/components/ui/Typography';
import { UpgradeTransactionStatus } from './components/UpgradeTransactionStatus';
import { useAccount, useChainId } from 'wagmi';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce, getTransactionLink, useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { useTokenAllowance } from '@jetstreamgg/sky-hooks';
import { useUpgraderManager } from './hooks/useUpgraderManager';
import { TxStatus, notificationTypeMaping } from '@widgets/shared/constants';
import { formatUnits, parseUnits } from 'viem';
import { useApproveManager } from './hooks/useApproveManager';
import { UpgradeAction, UpgradeFlow, UpgradeScreen, upgradeTokens } from './lib/constants';
import { useLingui } from '@lingui/react';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { getValidatedState } from '@widgets/lib/utils';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { ErrorBoundary } from '@widgets/shared/components/ErrorBoundary';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { math } from '@jetstreamgg/sky-utils';

const defaultUpgradeOptions = [TOKENS.dai, TOKENS.mkr];
const defaultRevertOptions = [TOKENS.usds];

function calculateOriginOptions(
  token: Token,
  action: string,
  upgradeOptions: Token[] = [],
  revertOptions: Token[] = []
) {
  const options = action === 'upgrade' ? [...upgradeOptions] : [...revertOptions];

  // Sort the array so that the selected token is first
  options.sort((a, b) => {
    if (a.symbol === token.symbol) {
      return -1;
    }
    if (b.symbol === token.symbol) {
      return 1;
    }
    return 0;
  });

  return options;
}

const calculateTargetOptions = (
  originToken: Token,
  upgradeOptions: Token[] = [],
  revertOptions: Token[] = []
) =>
  ({
    DAI: [revertOptions[0]],
    MKR: [revertOptions[1]],
    USDS: [upgradeOptions[0]],
    SKY: [upgradeOptions[1]]
  })[originToken.symbol];

const tokenForSymbol = (symbol: keyof typeof upgradeTokens) => {
  return TOKENS[symbol.toLowerCase()];
};

const targetTokenForSymbol = (symbol: keyof typeof upgradeTokens) => {
  return { DAI: TOKENS.usds, USDS: TOKENS.dai, MKR: TOKENS.sky, SKY: TOKENS.mkr }[symbol];
};

export type UpgradeWidgetProps = WidgetProps & {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  upgradeOptions?: Token[];
};

export const UpgradeWidget = ({
  onConnect,
  addRecentTransaction,
  locale,
  rightHeaderComponent,
  externalWidgetState,
  onStateValidated,
  onNotification,
  onWidgetStateChange,
  onCustomNavigation,
  customNavigationLabel,
  onExternalLinkClicked,
  upgradeOptions = defaultUpgradeOptions,
  enabled = true,
  shouldReset = false
}: UpgradeWidgetProps) => {
  const key = shouldReset ? 'reset' : undefined;
  return (
    <ErrorBoundary componentName="UpgradeWidget">
      <WidgetProvider key={key} locale={locale}>
        <UpgradeWidgetWrapped
          key={key}
          onConnect={onConnect}
          addRecentTransaction={addRecentTransaction}
          rightHeaderComponent={rightHeaderComponent}
          externalWidgetState={externalWidgetState}
          onStateValidated={onStateValidated}
          onNotification={onNotification}
          onWidgetStateChange={shouldReset ? undefined : onWidgetStateChange}
          customNavigationLabel={customNavigationLabel}
          onCustomNavigation={onCustomNavigation}
          onExternalLinkClicked={onExternalLinkClicked}
          enabled={enabled}
          upgradeOptions={upgradeOptions}
        />
      </WidgetProvider>
    </ErrorBoundary>
  );
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
  upgradeOptions,
  enabled = true
}: UpgradeWidgetProps): React.ReactElement {
  const validatedExternalState = getValidatedState(externalWidgetState);
  const shouldAllowExternalUpdate = useRef(true);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const chainId = useChainId();
  const { address, isConnected, isConnecting } = useAccount();
  const isSafeWallet = useIsSafeWallet();
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
    setWidgetState
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

  const {
    data: allowance,
    mutate: mutateAllowance,
    isLoading: allowanceLoading
  } = useTokenAllowance({
    chainId,
    contractAddress: originToken.address[chainId],
    owner: address,
    spender:
      originToken.symbol === 'DAI' || originToken.symbol === 'USDS'
        ? daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
        : mkrSkyAddress[chainId as keyof typeof mkrSkyAddress]
  });
  const hasAllowance = !!(allowance && debouncedOriginAmount !== 0n && allowance >= debouncedOriginAmount);

  const actionManager = useUpgraderManager({
    token: originToken,
    amount: debouncedOriginAmount,
    enabled:
      (widgetState.action === UpgradeAction.UPGRADE || widgetState.action === UpgradeAction.REVERT) &&
      allowance !== undefined,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description:
          tabIndex === 0
            ? t`Upgrade ${originToken.symbol} into ${targetToken.symbol}`
            : t`Revert ${originToken.symbol} into ${targetToken.symbol}`
      });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: tabIndex === 0 ? t`Upgrade successful` : t`Revert successful`,
        description:
          tabIndex === 0
            ? t`You upgraded ${formatUnits(debouncedOriginAmount, 18)} ${originToken.symbol} into ${
                targetToken.symbol
              }`
            : t`You reverted ${formatUnits(debouncedOriginAmount, 18)} ${originToken.symbol} into ${
                targetToken.symbol
              }`,
        status: TxStatus.SUCCESS,
        type: notificationTypeMaping[targetToken?.symbol?.toUpperCase() || 'none']
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateAllowance();
      mutateOriginBalance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error, hash) => {
      onNotification?.({
        title: tabIndex === 0 ? t`Upgrade failed` : t`Revert failed`,
        description: t`Something went wrong with your transaction. Please try again.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      mutateAllowance();
      mutateOriginBalance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
      console.log(error);
    }
  });

  const approve = useApproveManager({
    amount: debouncedOriginAmount,
    token: originToken,
    enabled: widgetState.action === UpgradeAction.APPROVE && allowance !== undefined,
    onStart: (hash: string) => {
      addRecentTransaction?.({ hash, description: t`Approving ${originToken.symbol} token` });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: t`Approve successful`,
        description: t`You approved ${formatUnits(debouncedOriginAmount, 18)} ${originToken.symbol}`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateAllowance();
      actionManager.retryPrepare();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error, hash) => {
      onNotification?.({
        title: t`Approval failed`,
        description: t`We could not approve your token allowance.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      mutateAllowance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    }
  });

  useEffect(() => {
    if (widgetState.screen === UpgradeScreen.TRANSACTION) return;
    const flow = validatedExternalState?.flow || (tabIndex === 0 ? UpgradeFlow.UPGRADE : UpgradeFlow.REVERT);
    if (isConnectedAndEnabled) {
      // Use external flow if available, otherwise use tabIndex
      if (flow === UpgradeFlow.UPGRADE) {
        setWidgetState({
          flow: UpgradeFlow.UPGRADE,
          action: UpgradeAction.APPROVE,
          screen: UpgradeScreen.ACTION
        });
      } else if (flow === UpgradeFlow.REVERT) {
        setWidgetState({
          flow: UpgradeFlow.REVERT,
          action: UpgradeAction.APPROVE,
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

  // If we're in the upgrade or revert flow and we need allowance, set the action to approve,
  useEffect(() => {
    if (widgetState.flow === UpgradeFlow.UPGRADE && widgetState.screen === UpgradeScreen.ACTION) {
      setWidgetState((prev: any) => ({
        ...prev,
        action: !hasAllowance && !allowanceLoading ? UpgradeAction.APPROVE : UpgradeAction.UPGRADE
      }));
    } else if (widgetState.flow === UpgradeFlow.REVERT && widgetState.screen === UpgradeScreen.ACTION) {
      setWidgetState((prev: any) => ({
        ...prev,
        action: !hasAllowance && !allowanceLoading ? UpgradeAction.APPROVE : UpgradeAction.REVERT
      }));
    }
  }, [widgetState.flow, widgetState.screen, hasAllowance, allowanceLoading]);

  const isBalanceError =
    txStatus === TxStatus.IDLE &&
    (originBalance?.value || originBalance?.value === 0n) &&
    debouncedOriginAmount &&
    debouncedOriginAmount > 0n &&
    debouncedOriginAmount > originBalance.value &&
    originAmount !== 0n //don't wait for debouncing on default state
      ? true
      : false;

  const prepareError = approve.prepareError || actionManager.prepareError;

  useEffect(() => {
    if (prepareError) {
      console.log(prepareError);
      onNotification?.({
        title: t`Error preparing transaction`,
        description: prepareError.message,
        status: TxStatus.ERROR
      });
    }
  }, [prepareError]);

  const isAmountWaitingForDebounce = debouncedOriginAmount !== originAmount;

  const approveDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    !approve.prepared ||
    isBalanceError ||
    approve.isLoading ||
    allowance === undefined ||
    allowanceLoading ||
    (txStatus === TxStatus.SUCCESS && !actionManager.prepared) || //disable next button if action not prepared
    isAmountWaitingForDebounce;

  const upgradeDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    !actionManager.prepared ||
    actionManager.isLoading ||
    allowance === undefined ||
    allowanceLoading ||
    isBalanceError ||
    isAmountWaitingForDebounce;

  const approveOnClick = () => {
    shouldAllowExternalUpdate.current = false;
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: UpgradeAction.APPROVE,
      screen: UpgradeScreen.TRANSACTION
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    approve.execute();
  };

  const upgradeOnClick = () => {
    shouldAllowExternalUpdate.current = false;
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: UpgradeAction.UPGRADE,
      screen: UpgradeScreen.TRANSACTION
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    actionManager.execute();
  };

  const revertOnClick = () => {
    shouldAllowExternalUpdate.current = false;
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: UpgradeAction.REVERT,
      screen: UpgradeScreen.TRANSACTION
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    actionManager.execute();
  };

  const nextOnClick = () => {
    shouldAllowExternalUpdate.current = true;
    setTxStatus(TxStatus.IDLE);

    // After a successful upgrade/revert, we reset the origin amount
    if (widgetState.action !== UpgradeAction.APPROVE) {
      setOriginAmount(0n);
    }

    if (widgetState.action === UpgradeAction.APPROVE && hasAllowance) {
      // If we just finished approving, we want to go directly to the next action
      return widgetState.flow === UpgradeFlow.UPGRADE ? upgradeOnClick() : revertOnClick();
    }

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
    return widgetState.action === UpgradeAction.UPGRADE
      ? upgradeOnClick()
      : widgetState.action === UpgradeAction.REVERT
        ? revertOnClick()
        : widgetState.action === UpgradeAction.APPROVE
          ? approveOnClick()
          : undefined;
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : txStatus === TxStatus.SUCCESS && customNavigationLabel
      ? onCustomNavigation
      : txStatus === TxStatus.SUCCESS
        ? nextOnClick
        : txStatus === TxStatus.ERROR
          ? errorOnClick
          : (widgetState.flow === UpgradeFlow.UPGRADE && widgetState.action === UpgradeAction.APPROVE) ||
              (widgetState.flow === UpgradeFlow.REVERT && widgetState.action === UpgradeAction.APPROVE)
            ? approveOnClick
            : widgetState.flow === UpgradeFlow.UPGRADE && widgetState.action === UpgradeAction.UPGRADE
              ? upgradeOnClick
              : widgetState.flow === UpgradeFlow.REVERT && widgetState.action === UpgradeAction.REVERT
                ? revertOnClick
                : undefined;

  const onClickBack = () => {
    shouldAllowExternalUpdate.current = true;
    setTxStatus(TxStatus.IDLE);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: UpgradeAction.APPROVE,
      screen: UpgradeScreen.ACTION
    }));
  };

  const showSecondaryButton =
    !!customNavigationLabel ||
    txStatus === TxStatus.ERROR ||
    // After a successful approve transaction, show the back button
    (txStatus === TxStatus.SUCCESS &&
      widgetState.action === UpgradeAction.APPROVE &&
      widgetState.screen === UpgradeScreen.TRANSACTION);

  // Update button state according to action and tx
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (widgetState.action === UpgradeAction.APPROVE && txStatus === TxStatus.SUCCESS) {
        setButtonText(t`Continue`);
      } else if (txStatus === TxStatus.SUCCESS) {
        if (customNavigationLabel) {
          setButtonText(customNavigationLabel);
        } else {
          setButtonText(t`Back to Upgrade`);
        }
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (widgetState.screen === UpgradeScreen.ACTION && debouncedOriginAmount === 0n) {
        setButtonText(t`Enter amount`);
      } else if (widgetState.action === UpgradeAction.APPROVE) {
        setButtonText(t`Approve ${tabIndex === 0 ? 'upgrade' : 'revert'} amount`);
      } else if (widgetState.flow === UpgradeFlow.UPGRADE && widgetState.action === UpgradeAction.UPGRADE) {
        setButtonText(t`Upgrade`);
      } else if (widgetState.flow === UpgradeFlow.REVERT && widgetState.action === UpgradeAction.REVERT) {
        setButtonText(t`Revert`);
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [
    widgetState.action,
    widgetState.flow,
    txStatus,
    debouncedOriginAmount,
    linguiCtx,
    isConnectedAndEnabled,
    customNavigationLabel
  ]);

  // Set widget button to be disabled depending on which flow we're in
  useEffect(() => {
    setIsDisabled(
      isConnectedAndEnabled &&
        ((widgetState.action === UpgradeAction.APPROVE && approveDisabled) ||
          ((widgetState.action === UpgradeAction.UPGRADE || widgetState.action === UpgradeAction.REVERT) &&
            upgradeDisabled))
    );
  }, [approveDisabled, upgradeDisabled, widgetState.action, isConnectedAndEnabled]);

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
        action: UpgradeAction.APPROVE,
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
  }, [chainId]);

  return (
    <WidgetContainer
      header={
        <Heading variant="x-large">
          <Trans>Upgrade</Trans>
        </Heading>
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
              targetAmount={math.calculateConversion(originToken, debouncedOriginAmount)}
              onExternalLinkClicked={onExternalLinkClicked}
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
                targetAmount={math.calculateConversion(originToken, debouncedOriginAmount)}
                originOptions={calculateOriginOptions(
                  originToken,
                  tabIndex === 0 ? 'upgrade' : 'revert',
                  upgradeOptions,
                  defaultRevertOptions
                )}
                originToken={originToken}
                targetToken={targetToken}
                originBalance={originBalance?.value}
                onToggle={(index: 0 | 1) => {
                  if (tabIndex === index) {
                    return;
                  }

                  const newOriginToken = targetToken;
                  setTabIndex(index);
                  setOriginToken(newOriginToken);
                  setTargetToken(originToken);
                  setOriginAmount(0n);

                  if (isConnectedAndEnabled) {
                    if (index === 0) {
                      //Initialize the upgrade flow
                      setWidgetState({
                        flow: UpgradeFlow.UPGRADE,
                        action: UpgradeAction.APPROVE,
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
