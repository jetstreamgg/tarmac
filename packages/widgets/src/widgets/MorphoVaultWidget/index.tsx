import {
  getTokenDecimals,
  useTokenBalance,
  useTokenAllowance,
  useIsBatchSupported,
  Token,
  useMorphoVaultData,
  useMorphoVaultRate
} from '@jetstreamgg/sky-hooks';
import { useDebounce } from '@jetstreamgg/sky-utils';
import { useContext, useEffect, useMemo, useState } from 'react';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { MorphoVaultFlow, MorphoVaultAction, MorphoVaultScreen } from './lib/constants';
import { MorphoVaultTransactionStatus } from './components/MorphoVaultTransactionStatus';
import { SupplyWithdraw } from './components/SupplyWithdraw';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { NotificationType, TxStatus } from '@widgets/shared/constants';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLingui } from '@lingui/react';
import { useConnection, useChainId } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@widgets/components/ui/button';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { getValidatedState } from '@widgets/lib/utils';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { MorphoVaultTransactionReview } from './components/MorphoVaultTransactionReview';
import { withWidgetProvider } from '@widgets/shared/hocs/withWidgetProvider';
import { useMorphoVaultTransactions } from './hooks/useMorphoVaultTransactions';

export type MorphoVaultWidgetProps = WidgetProps & {
  /** The Morpho vault contract address */
  vaultAddress: `0x${string}`;
  /** The underlying asset token address (e.g., USDC) */
  assetAddress: `0x${string}`;
  /** The underlying asset token (e.g., USDC token object) */
  assetToken: Token;
  /** Vault name for display purposes */
  vaultName?: string;
  /** Callback when external link is clicked */
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  /** Whether batch transactions are enabled */
  batchEnabled?: boolean;
  /** Callback to set batch enabled state */
  setBatchEnabled?: (enabled: boolean) => void;
  /** Callback to navigate back to expert view */
  onBackToExpert?: () => void;
};

const MorphoVaultWidgetWrapped = ({
  vaultAddress,
  assetAddress,
  assetToken,
  vaultName = 'Morpho Vault',
  onConnect,
  addRecentTransaction,
  rightHeaderComponent,
  externalWidgetState,
  onStateValidated,
  onNotification,
  onWidgetStateChange,
  onExternalLinkClicked,
  enabled = true,
  legalBatchTxUrl,
  batchEnabled,
  setBatchEnabled,
  onBackToExpert
}: MorphoVaultWidgetProps) => {
  const validatedExternalState = getValidatedState(externalWidgetState, [assetToken.symbol]);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const chainId = useChainId();
  const { address, isConnecting, isConnected } = useConnection();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const linguiCtx = useLingui();

  // Vault data hook - fetches user shares, user assets, max withdraw, etc.
  const {
    data: vaultData,
    isLoading: isVaultDataLoading,
    mutate: mutateVaultData
  } = useMorphoVaultData({
    vaultAddress
  });

  // Vault rate hook - fetches Rate from Morpho API
  const { data: vaultRateData } = useMorphoVaultRate({
    vaultAddress
  });

  // User's underlying asset balance (e.g., USDC balance)
  const { data: assetBalance, refetch: mutateAssetBalance } = useTokenBalance({
    chainId,
    address,
    token: assetAddress
  });

  // Allowance for the underlying asset to the vault
  const { data: allowance, mutate: mutateAllowance } = useTokenAllowance({
    chainId,
    contractAddress: assetAddress,
    owner: address,
    spender: vaultAddress
  });

  const { data: batchSupported } = useIsBatchSupported();

  // Token decimals for the underlying asset
  const assetDecimals = getTokenDecimals(assetToken, chainId);

  // Amount state
  const initialAmount =
    validatedExternalState?.amount && validatedExternalState.amount !== '0'
      ? parseUnits(validatedExternalState.amount, assetDecimals)
      : 0n;
  const [amount, setAmount] = useState(initialAmount);
  const debouncedAmount = useDebounce(amount);

  // Tab state: 0 = Supply, 1 = Withdraw
  const initialTabIndex = validatedExternalState?.flow === MorphoVaultFlow.WITHDRAW ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);

  // Max withdrawal state - when true, use redeem instead of withdraw
  const [max, setMax] = useState<boolean>(false);

  useEffect(() => {
    setAmount(initialAmount);
  }, [initialAmount]);

  useEffect(() => {
    setTabIndex(initialTabIndex);
  }, [initialTabIndex]);

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

  useNotifyWidgetState({ widgetState, txStatus, onWidgetStateChange });

  // Determine if allowance is needed for supply
  const needsAllowance = !!(!allowance || allowance < debouncedAmount);
  const shouldUseBatch =
    !!batchEnabled && !!batchSupported && needsAllowance && widgetState.flow === MorphoVaultFlow.SUPPLY;

  // Transaction hooks
  const { morphoVaultDeposit, morphoVaultWithdraw, morphoVaultRedeem } = useMorphoVaultTransactions({
    amount: debouncedAmount,
    shares: vaultData?.userShares ?? 0n,
    max,
    vaultAddress,
    assetAddress,
    assetDecimals,
    assetSymbol: assetToken.symbol,
    shouldUseBatch,
    mutateAllowance,
    mutateVaultData,
    mutateAssetBalance,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  // Initialize widget state based on connection and tab
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (tabIndex === 0) {
        setWidgetState({
          flow: MorphoVaultFlow.SUPPLY,
          action: MorphoVaultAction.SUPPLY,
          screen: MorphoVaultScreen.ACTION
        });
      } else if (tabIndex === 1) {
        setWidgetState({
          flow: MorphoVaultFlow.WITHDRAW,
          action: MorphoVaultAction.WITHDRAW,
          screen: MorphoVaultScreen.ACTION
        });
      }
    } else {
      setWidgetState({
        flow: tabIndex === 0 ? MorphoVaultFlow.SUPPLY : MorphoVaultFlow.WITHDRAW,
        action: null,
        screen: null
      });
    }
  }, [tabIndex, isConnectedAndEnabled]);

  // Show step indicator for supply flows that need allowance
  useEffect(() => {
    if (txStatus === TxStatus.IDLE) {
      setShowStepIndicator(widgetState.flow === MorphoVaultFlow.SUPPLY && needsAllowance);
    }
  }, [txStatus, widgetState.flow, needsAllowance, setShowStepIndicator]);

  // Balance error checks
  const isSupplyBalanceError =
    txStatus === TxStatus.IDLE &&
    !!address &&
    (!!assetBalance?.value || assetBalance?.value === 0n) &&
    debouncedAmount > assetBalance.value &&
    amount !== 0n;

  const isWithdrawBalanceError =
    txStatus === TxStatus.IDLE &&
    !!address &&
    (vaultData?.userAssets === 0n || !!vaultData?.userAssets) &&
    debouncedAmount > vaultData.userAssets &&
    amount !== 0n;

  const isAmountWaitingForDebounce = debouncedAmount !== amount;

  // Disable states
  const withdrawDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isWithdrawBalanceError ||
    !(max ? morphoVaultRedeem.prepared : morphoVaultWithdraw.prepared) ||
    isAmountWaitingForDebounce;

  const supplyDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    isAmountWaitingForDebounce ||
    !morphoVaultDeposit.prepared ||
    morphoVaultDeposit.isLoading;

  // Handle external state changes
  useEffect(() => {
    const formattedAmount = formatUnits(amount, assetDecimals);
    const amountHasChanged =
      validatedExternalState?.amount !== undefined && validatedExternalState?.amount !== formattedAmount;

    if (amountHasChanged && txStatus === TxStatus.IDLE) {
      if (validatedExternalState?.amount && validatedExternalState.amount !== '0') {
        const newAmount = parseUnits(validatedExternalState.amount, assetDecimals);
        setAmount(newAmount);
      } else {
        setAmount(0n);
      }
    }
  }, [validatedExternalState?.amount, txStatus]);

  // Action handlers
  const nextOnClick = () => {
    setTxStatus(TxStatus.IDLE);
    setAmount(0n);
    setMax(false);

    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: prev.flow === MorphoVaultFlow.WITHDRAW ? MorphoVaultAction.WITHDRAW : MorphoVaultAction.SUPPLY,
      screen: MorphoVaultScreen.ACTION
    }));

    onWidgetStateChange?.({
      originAmount: '',
      txStatus,
      widgetState
    });
  };

  const reviewOnClick = () => {
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: MorphoVaultScreen.REVIEW
    }));
  };

  const onClickBack = () => {
    setTxStatus(TxStatus.IDLE);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: MorphoVaultScreen.ACTION
    }));
  };

  const errorOnClick = () => {
    if (widgetState.action === MorphoVaultAction.SUPPLY) {
      return morphoVaultDeposit.execute();
    } else if (widgetState.action === MorphoVaultAction.WITHDRAW) {
      return max ? morphoVaultRedeem.execute() : morphoVaultWithdraw.execute();
    }
    return undefined;
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : txStatus === TxStatus.SUCCESS
      ? nextOnClick
      : txStatus === TxStatus.ERROR
        ? errorOnClick
        : widgetState.screen === MorphoVaultScreen.ACTION
          ? reviewOnClick
          : widgetState.flow === MorphoVaultFlow.SUPPLY
            ? morphoVaultDeposit.execute
            : widgetState.flow === MorphoVaultFlow.WITHDRAW
              ? max
                ? morphoVaultRedeem.execute
                : morphoVaultWithdraw.execute
              : undefined;

  const showSecondaryButton = txStatus === TxStatus.ERROR || widgetState.screen === MorphoVaultScreen.REVIEW;

  // Notify on prepare errors
  useEffect(() => {
    const prepareError = morphoVaultWithdraw.prepareError || morphoVaultRedeem.prepareError;
    if (prepareError) {
      onNotification?.({
        title: t`Error preparing transaction`,
        description: prepareError.message,
        status: TxStatus.ERROR
      });
    }
  }, [morphoVaultWithdraw.prepareError, morphoVaultRedeem.prepareError]);

  // Update button text based on state
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (txStatus === TxStatus.SUCCESS) {
        setButtonText(t`Back to ${vaultName}`);
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (widgetState.screen === MorphoVaultScreen.ACTION && amount === 0n) {
        setButtonText(t`Enter amount`);
      } else if (widgetState.screen === MorphoVaultScreen.ACTION) {
        setButtonText(t`Review`);
      } else if (widgetState.screen === MorphoVaultScreen.REVIEW) {
        if (widgetState.flow === MorphoVaultFlow.WITHDRAW) {
          setButtonText(t`Confirm withdrawal`);
        } else if (shouldUseBatch) {
          setButtonText(t`Confirm bundled transaction`);
        } else if (needsAllowance) {
          setButtonText(t`Confirm 2 transactions`);
        } else if (widgetState.flow === MorphoVaultFlow.SUPPLY) {
          setButtonText(t`Confirm supply`);
        }
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [
    widgetState,
    txStatus,
    linguiCtx,
    amount,
    isConnectedAndEnabled,
    shouldUseBatch,
    needsAllowance,
    vaultName
  ]);

  // Set widget button disabled state
  useEffect(() => {
    setIsDisabled(
      isConnectedAndEnabled &&
        ((widgetState.action === MorphoVaultAction.SUPPLY && supplyDisabled) ||
          (widgetState.action === MorphoVaultAction.WITHDRAW && withdrawDisabled))
    );
  }, [widgetState.action, withdrawDisabled, isConnectedAndEnabled, supplyDisabled]);

  // Set loading state
  useEffect(() => {
    setIsLoading(isConnecting || txStatus === TxStatus.LOADING || txStatus === TxStatus.INITIALIZED);
  }, [isConnecting, txStatus]);

  // Notify on balance error
  const debouncedBalanceError = useDebounce(isSupplyBalanceError, 2000);
  useEffect(() => {
    if (debouncedBalanceError) {
      onNotification?.({
        title: t`Error preparing transaction`,
        description: t`An error occurred while preparing the transaction`,
        status: TxStatus.ERROR,
        type: NotificationType.INSUFFICIENT_BALANCE
      });
    }
  }, [debouncedBalanceError]);

  // Reset widget state after switching network
  useEffect(() => {
    setAmount(initialAmount);
    setMax(false);
    setTxStatus(TxStatus.IDLE);
    setExternalLink(undefined);

    if (tabIndex === 0) {
      setWidgetState({
        flow: MorphoVaultFlow.SUPPLY,
        action: MorphoVaultAction.SUPPLY,
        screen: MorphoVaultScreen.ACTION
      });
    } else {
      setWidgetState({
        flow: MorphoVaultFlow.WITHDRAW,
        action: MorphoVaultAction.WITHDRAW,
        screen: MorphoVaultScreen.ACTION
      });
    }

    mutateAssetBalance();
    mutateVaultData();
    mutateAllowance();
  }, [chainId]);

  return (
    <WidgetContainer
      header={
        <div>
          {onBackToExpert && (
            <Button variant="link" onClick={onBackToExpert} className="mb-2 p-0">
              <HStack className="space-x-2">
                <ArrowLeft className="self-center" />
                <Heading tag="h3" variant="small" className="text-textSecondary">
                  Back to Expert
                </Heading>
              </HStack>
            </Button>
          )}
          <Heading variant="x-large">
            <Trans>{vaultName}</Trans>
          </Heading>
        </div>
      }
      subHeader={
        <Text className="text-textSecondary" variant="small">
          <Trans>Supply {assetToken.symbol} to earn yield</Trans>
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
            <MorphoVaultTransactionStatus
              assetToken={assetToken}
              amount={debouncedAmount}
              onExternalLinkClicked={onExternalLinkClicked}
              isBatchTransaction={shouldUseBatch}
              needsAllowance={needsAllowance}
            />
          </CardAnimationWrapper>
        ) : widgetState.screen === MorphoVaultScreen.REVIEW ? (
          <CardAnimationWrapper key="widget-transaction-review">
            <MorphoVaultTransactionReview
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
              isBatchTransaction={shouldUseBatch}
              assetToken={assetToken}
              amount={debouncedAmount}
              needsAllowance={needsAllowance}
              legalBatchTxUrl={legalBatchTxUrl}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-inputs">
            <SupplyWithdraw
              address={address}
              assetBalance={assetBalance?.value}
              vaultBalance={vaultData?.userAssets}
              userShares={vaultData?.userShares}
              isVaultDataLoading={isVaultDataLoading}
              onChange={(newValue: bigint, userTriggered?: boolean) => {
                setAmount(newValue);
                if (userTriggered) {
                  const formattedValue = newValue === 0n ? '' : formatUnits(newValue, assetDecimals);
                  onWidgetStateChange?.({
                    originAmount: formattedValue,
                    txStatus,
                    widgetState
                  });
                }
              }}
              assetToken={assetToken}
              onToggle={setTabIndex}
              amount={amount}
              error={
                widgetState.flow === MorphoVaultFlow.SUPPLY ? isSupplyBalanceError : isWithdrawBalanceError
              }
              onSetMax={setMax}
              tabIndex={tabIndex}
              enabled={enabled}
              onExternalLinkClicked={onExternalLinkClicked}
              vaultAddress={vaultAddress}
              vaultName={vaultName}
              vaultTvl={vaultData?.totalAssets}
              vaultRate={vaultRateData?.formattedRate}
              shareDecimals={vaultData?.decimals ?? 18}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};

export const MorphoVaultWidget = withWidgetProvider(MorphoVaultWidgetWrapped, 'MorphoVaultWidget');
