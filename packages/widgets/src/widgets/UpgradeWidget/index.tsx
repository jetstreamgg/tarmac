import { TOKENS, Token, daiUsdsAddress, mkrSkyAddress, useTokenBalance } from '@jetstreamgg/hooks';
import { UpgradeRevert } from './components/UpgradeRevert';
import { WidgetContext, WidgetProvider } from '@/context/WidgetContext';
import { WidgetProps, WidgetState } from '@/shared/types/widgetState';
import { WidgetContainer } from '@/shared/components/ui/widget/WidgetContainer';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Heading } from '@/shared/components/ui/Typography';
import { UpgradeTransactionStatus } from './components/UpgradeTransactionStatus';
import { useAccount, useChainId } from 'wagmi';
import { useContext, useEffect, useMemo, useState } from 'react';
import { getEtherscanLink, useDebounce } from '@jetstreamgg/utils';
import { useTokenAllowance } from '@jetstreamgg/hooks';
import { useUpgraderManager } from './hooks/useUpgraderManager';
import { TxStatus, notificationTypeMaping } from '@/shared/constants';
import { formatUnits, parseUnits } from 'viem';
import { useApproveManager } from './hooks/useApproveManager';
import { UpgradeAction, UpgradeFlow, UpgradeScreen, upgradeTokens } from './lib/constants';
import { useLingui } from '@lingui/react';
import { VStack } from '@/shared/components/ui/layout/VStack';
import { getValidatedState } from '@/lib/utils';
import { WidgetButtons } from '@/shared/components/ui/widget/WidgetButtons';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@/shared/animation/Wrappers';
import { useNotifyWidgetState } from '@/shared/hooks/useNotifyWidgetState';
import { math } from '@jetstreamgg/utils';

const defaultUpgradeOptions = [TOKENS.dai, TOKENS.mkr];
const defaultRevertOptions = [TOKENS.usds, TOKENS.sky];

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

const actionForTokenSymbol = (symbol: keyof typeof upgradeTokens) => {
  return symbol === 'DAI' || symbol === 'MKR' ? 0 : 1;
};

const tokenForSymbol = (symbol: keyof typeof upgradeTokens) => {
  return TOKENS[symbol.toLowerCase()];
};

const targetTokenForSymbol = (symbol: keyof typeof upgradeTokens) => {
  return { DAI: TOKENS.usds, USDS: TOKENS.dai, MKR: TOKENS.sky, SKY: TOKENS.mkr }[symbol];
};

export type UpgradeWidgetProps = WidgetProps & {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  upgradeOptions?: Token[];
  revertOptions?: Token[];
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
  revertOptions = defaultRevertOptions,
  enabled = true
}: UpgradeWidgetProps) => {
  return (
    <ErrorBoundary componentName="UpgradeWidget">
      <WidgetProvider locale={locale}>
        <UpgradeWidgetWrapped
          onConnect={onConnect}
          addRecentTransaction={addRecentTransaction}
          rightHeaderComponent={rightHeaderComponent}
          externalWidgetState={externalWidgetState}
          onStateValidated={onStateValidated}
          onNotification={onNotification}
          onWidgetStateChange={onWidgetStateChange}
          customNavigationLabel={customNavigationLabel}
          onCustomNavigation={onCustomNavigation}
          onExternalLinkClicked={onExternalLinkClicked}
          enabled={enabled}
          upgradeOptions={upgradeOptions}
          revertOptions={revertOptions}
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
  revertOptions,
  enabled = true
}: UpgradeWidgetProps): React.ReactElement {
  const validatedExternalState = getValidatedState(externalWidgetState);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const chainId = useChainId();
  const { address, isConnected, isConnecting } = useAccount();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);

  // initialUpgradeToken takes first priority, then tab, then default to 0 for tabIndex
  const initialTabIndex = validatedExternalState?.initialUpgradeToken
    ? actionForTokenSymbol(validatedExternalState.initialUpgradeToken as keyof typeof upgradeTokens)
    : validatedExternalState?.flow === UpgradeFlow.REVERT
      ? 1
      : 0;

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
    setOriginToken(
      tokenForSymbol((validatedExternalState?.initialUpgradeToken as keyof typeof upgradeTokens) || 'DAI')
    );
    setTargetToken(
      targetTokenForSymbol(
        (validatedExternalState?.initialUpgradeToken as keyof typeof upgradeTokens) || 'DAI'
      )
    );
    setOriginAmount(parseUnits(validatedExternalState?.amount || '0', 18));
  }, [validatedExternalState?.initialUpgradeToken, validatedExternalState?.amount]);

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

  useNotifyWidgetState({ widgetState, txStatus, targetToken: targetToken?.symbol, onWidgetStateChange });

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
      setExternalLink(getEtherscanLink(chainId, hash, 'tx'));
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
      setExternalLink(getEtherscanLink(chainId, hash, 'tx'));
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
    //Initialize the upgrade flow
    if (isConnectedAndEnabled) {
      if (tabIndex === 0) {
        setWidgetState({
          flow: UpgradeFlow.UPGRADE,
          action: UpgradeAction.APPROVE,
          screen: UpgradeScreen.ACTION
        });
      } else if (tabIndex === 1) {
        //Initialize the revert flow
        setWidgetState({
          flow: UpgradeFlow.REVERT,
          action: UpgradeAction.REVERT,
          screen: UpgradeScreen.ACTION
        });
      }
    } else {
      // Reset widget state when we are not connected
      setWidgetState({
        flow: tabIndex === 0 ? UpgradeFlow.UPGRADE : UpgradeFlow.REVERT,
        action: null,
        screen: null
      });
    }
  }, [isConnectedAndEnabled]);

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
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: UpgradeScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    approve.execute();
  };

  const upgradeOnClick = () => {
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
  };

  // Handle the error onClicks separately to keep it clear
  const errorOnClick = () => {
    return widgetState.action === UpgradeAction.UPGRADE
      ? upgradeOnClick
      : widgetState.action === UpgradeAction.REVERT
        ? revertOnClick
        : widgetState.action === UpgradeAction.APPROVE
          ? approveOnClick
          : undefined;
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : txStatus === TxStatus.SUCCESS && customNavigationLabel
      ? onCustomNavigation
      : txStatus === TxStatus.SUCCESS
        ? nextOnClick
        : txStatus === TxStatus.ERROR
          ? errorOnClick()
          : (widgetState.flow === UpgradeFlow.UPGRADE && widgetState.action === UpgradeAction.APPROVE) ||
              (widgetState.flow === UpgradeFlow.REVERT && widgetState.action === UpgradeAction.APPROVE)
            ? approveOnClick
            : widgetState.flow === UpgradeFlow.UPGRADE && widgetState.action === UpgradeAction.UPGRADE
              ? upgradeOnClick
              : widgetState.flow === UpgradeFlow.REVERT && widgetState.action === UpgradeAction.REVERT
                ? revertOnClick
                : undefined;

  const onClickBack = () => {
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
                    : t`Choose a token to revert, and enter an amount`
                }
                originAmount={originAmount}
                targetAmount={math.calculateConversion(originToken, debouncedOriginAmount)}
                originOptions={calculateOriginOptions(
                  originToken,
                  tabIndex === 0 ? 'upgrade' : 'revert',
                  upgradeOptions,
                  revertOptions
                )}
                originToken={originToken}
                targetToken={targetToken}
                originBalance={originBalance?.value}
                onToggle={(index: 0 | 1) => {
                  setTabIndex(index);
                  setOriginToken(targetToken);
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
                }}
                onOriginInputChange={setOriginAmount}
                tabIndex={tabIndex}
                error={isBalanceError ? new Error(t`Insufficient funds`) : undefined}
                onMenuItemChange={(op: Token | null) => {
                  if (op) {
                    setOriginToken(op as Token);
                    const target = calculateTargetOptions(op as Token, upgradeOptions, revertOptions);
                    if (target?.length) {
                      setTargetToken(target[0]);
                    }
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
