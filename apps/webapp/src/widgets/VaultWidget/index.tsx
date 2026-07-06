import {
  getTokenDecimals,
  useTokenBalance,
  useTokenAllowance,
  useIsBatchSupported,
  Token,
  useMorphoVaultOnChainData,
  useVaultMarketData,
  useSparkVaultRate,
  computeVaultLimits,
  usdtAddress,
  type VaultProvider
} from '@/hooks';
import { useDebounce } from '@/hooks';
import { REFERRAL_CODE } from '@/lib/constants';
import { resolveSparkVaultRate } from '@/lib/vaults/sparkVaultRate';
import { useContext, useEffect, useMemo, useState } from 'react';
import { WidgetContainer } from '@/widgets/shared/components/ui/widget/WidgetContainer';
import { VaultFlow, VaultAction, VaultScreen } from './lib/constants';
import { VaultTransactionStatus } from './components/VaultTransactionStatus';
import { SupplyWithdraw } from './components/SupplyWithdraw';
import { WidgetContext } from '@/widgets/context/WidgetContext';
import { NotificationType, TxStatus } from '@/widgets/shared/constants';
import { WidgetProps, WidgetState } from '@/widgets/shared/types/widgetState';
import { WidgetAnalyticsEventType } from '@/widgets/shared/types/analyticsEvents';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLingui } from '@lingui/react';
import { useConnection, useChainId } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Heading } from '@/widgets/shared/components/ui/Typography';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/widgets/components/ui/button';
import { HStack } from '@/widgets/shared/components/ui/layout/HStack';
import { getValidatedState } from '@/widgets/lib/utils';
import { WidgetButtons } from '@/widgets/shared/components/ui/widget/WidgetButtons';
import { AnimatePresence } from 'motion/react';
import { CardAnimationWrapper } from '@/widgets/shared/animation/Wrappers';
import { useNotifyWidgetState } from '@/widgets/shared/hooks/useNotifyWidgetState';
import { VaultTransactionReview } from './components/VaultTransactionReview';
import { withWidgetProvider } from '@/widgets/shared/hocs/withWidgetProvider';
import { useVaultTransactions } from './hooks/useVaultTransactions';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { useNotification } from '@/modules/app/hooks/useNotification';
import { useWidgetAnalytics } from '@/modules/analytics/hooks/useWidgetAnalytics';

export type VaultWidgetProps = WidgetProps & {
  /** The vault contract address */
  vaultAddress: `0x${string}`;
  /** The underlying asset token address (e.g., USDC) */
  assetAddress: `0x${string}`;
  /** The underlying asset token (e.g., USDC token object) */
  assetToken: Token;
  /** Vault name for display purposes */
  vaultName?: string;
  /** Which provider operates the vault (drives branding + data source). Defaults to Morpho. */
  provider?: VaultProvider;
  /** Callback to navigate back to vaults view */
  onBackToVaults?: () => void;
};

/** @deprecated Use {@link VaultWidgetProps}. Kept as a thin alias. */
export type MorphoVaultWidgetProps = VaultWidgetProps;

const VaultWidgetWrapped = ({
  vaultAddress,
  assetAddress,
  assetToken,
  vaultName = 'Vault',
  provider = 'morpho',
  rightHeaderComponent,
  externalWidgetState,
  onStateValidated,
  onWidgetStateChange,
  onBackToVaults
}: VaultWidgetProps) => {
  const onConnect = useCustomConnectModal();
  const [batchEnabled, setBatchEnabled] = useBatchToggle();
  const onNotification = useNotification();
  const chainId = useChainId();
  const onAnalyticsEvent = useWidgetAnalytics('vaults', chainId);
  const validatedExternalState = getValidatedState(externalWidgetState, [assetToken.symbol]);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const { address, isConnecting, isConnected } = useConnection();
  const { isConnectedAndAcceptedTerms: enabled } = useConnectedContext();
  const { onExternalLinkClicked } = useConfigContext();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const linguiCtx = useLingui();

  // Vault data hook - fetches user shares, user assets, max withdraw, etc.
  const {
    data: vaultData,
    isLoading: isVaultDataLoading,
    mutate: mutateVaultData
  } = useMorphoVaultOnChainData({
    vaultAddress,
    provider
  });

  // Market data hook - provider-aware dispatcher. Morpho reads its API; other
  // providers (Spark) return an empty state until their source is wired (slice 04).
  const { data: marketData, isLoading: isMarketDataLoading } = useVaultMarketData({
    provider,
    vaultAddress
  });

  // Spark exposes its rate on-chain (Vault Savings Rate); read it directly instead of the API.
  const { formattedRate: sparkRate } = useSparkVaultRate({
    vaultAddress: provider === 'sky' ? vaultAddress : undefined
  });

  const userAssets = vaultData?.userAssets ?? 0n;
  const availableLiquidity = marketData?.liquidity;

  // sUSDT (Spark) TVL is API-first, with the on-chain ERC-4626 `totalAssets()` as the
  // fallback when the API is empty/down. Morpho keeps reading TVL on-chain (unchanged).
  const vaultTvl =
    provider === 'morpho' ? vaultData?.totalAssets : (marketData?.totalAssets ?? vaultData?.totalAssets);
  const hasLiquidityData = !isMarketDataLoading && availableLiquidity !== undefined;

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

  // Deposit-cap enforcement is provider-specific. Spark's vault exposes a real
  // on-chain supply cap via maxDeposit(user); Morpho V2 vaults return 0n even when
  // deposits are open, so consulting maxDeposit there would wrongly report every
  // Morpho vault as "cap reached" and block deposits. Mirror the withdraw side,
  // which already special-cases Morpho (usesMarketLiquidity below).
  const enforcesDepositCap = provider !== 'morpho';

  // On-chain ERC-4626 limits → effective input caps (revert-proof, no API needed).
  const limits = computeVaultLimits({
    assetBalance: assetBalance?.value,
    maxDeposit: enforcesDepositCap ? vaultData?.maxDeposit : undefined,
    userAssets,
    userShares: vaultData?.userShares,
    maxWithdraw: vaultData?.maxWithdraw
  });
  // Deposit input is clamped to min(walletBalance, remaining cap); a full vault blocks deposits.
  const maxDepositInput = limits.maxDepositInput;
  const depositCapReached = limits.depositCapReached;

  // Withdraw cap source is provider-aware: Morpho derives liquidity from its market
  // API (drives the liquidity disclaimers); Spark has no such API, so the contract's
  // on-chain maxWithdraw(user) is authoritative.
  const usesMarketLiquidity = provider === 'morpho';
  const maxWithdraw = usesMarketLiquidity
    ? hasLiquidityData
      ? userAssets < availableLiquidity
        ? userAssets
        : availableLiquidity
      : !isMarketDataLoading
        ? userAssets // Fallback: let user attempt full balance, contract enforces limits
        : undefined
    : limits.maxWithdrawInput;
  const isLiquidityConstrained = usesMarketLiquidity
    ? hasLiquidityData && userAssets > 0n && availableLiquidity < userAssets
    : userAssets > 0n && limits.maxWithdrawInput < userAssets;
  // Spark relies on the on-chain cap, so its withdraw limit is never "unavailable".
  const isLiquidityDataUnavailable =
    usesMarketLiquidity && !isMarketDataLoading && availableLiquidity === undefined;

  // Amount state
  const initialAmount =
    validatedExternalState?.amount && validatedExternalState.amount !== '0'
      ? parseUnits(validatedExternalState.amount, assetDecimals)
      : 0n;
  const [amount, setAmount] = useState(initialAmount);
  const debouncedAmount = useDebounce(amount);

  // Tab state: 0 = Supply, 1 = Withdraw
  const initialTabIndex = validatedExternalState?.flow === VaultFlow.WITHDRAW ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);

  // Max withdrawal state - when true, use redeem instead of withdraw
  const [max, setMax] = useState<boolean>(false);

  const [disclaimerChecked, setDisclaimerChecked] = useState<boolean>(false);

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
  // USDT requires resetting allowance to 0 before setting a new value
  const isUsdt = assetAddress === usdtAddress[chainId as keyof typeof usdtAddress];
  const needsAllowanceReset = isUsdt && needsAllowance && !!allowance && allowance > 0n;
  const shouldUseBatch =
    !!batchEnabled && !!batchSupported && needsAllowance && widgetState.flow === VaultFlow.SUPPLY;

  // Transaction hooks
  const { morphoVaultDeposit, morphoVaultWithdraw, morphoVaultRedeem } = useVaultTransactions({
    amount: debouncedAmount,
    shares: vaultData?.userShares ?? 0n,
    max,
    provider,
    referralCode: REFERRAL_CODE,
    vaultAddress,
    assetAddress,
    assetDecimals,
    assetSymbol: assetToken.symbol,
    vaultName,
    needsAllowance,
    shouldUseBatch,
    mutateAllowance,
    mutateVaultData,
    mutateAssetBalance,
    onWidgetStateChange,
    onNotification,
    onAnalyticsEvent
  });

  // Derive current call index based on active flow (for multi-step tracking)
  const currentCallIndex = widgetState.flow === VaultFlow.SUPPLY ? morphoVaultDeposit.currentCallIndex : 0;

  // How the vault is referred to in the transaction-flow copy. Morpho keeps its
  // legacy "the Morpho Vault" phrasing; other providers use their vault name
  // directly (e.g. "Tether Savings") so the copy isn't mis-branded as Morpho.
  const vaultLabel = provider === 'morpho' ? 'the Morpho Vault' : vaultName;

  // Initialize widget state based on connection and tab
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (tabIndex === 0) {
        setWidgetState({
          flow: VaultFlow.SUPPLY,
          action: VaultAction.SUPPLY,
          screen: VaultScreen.ACTION
        });
      } else if (tabIndex === 1) {
        setWidgetState({
          flow: VaultFlow.WITHDRAW,
          action: VaultAction.WITHDRAW,
          screen: VaultScreen.ACTION
        });
      }
    } else {
      setWidgetState({
        flow: tabIndex === 0 ? VaultFlow.SUPPLY : VaultFlow.WITHDRAW,
        action: null,
        screen: null
      });
    }
  }, [tabIndex, isConnectedAndEnabled]);

  // Show step indicator for supply flows that need allowance (hide for claim flow)
  useEffect(() => {
    if (widgetState.flow === VaultFlow.CLAIM) {
      setShowStepIndicator(false);
    } else if (txStatus === TxStatus.IDLE) {
      setShowStepIndicator(widgetState.flow === VaultFlow.SUPPLY && needsAllowance);
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
    maxWithdraw !== undefined &&
    debouncedAmount > maxWithdraw &&
    amount !== 0n;

  // Deposit exceeds the vault's remaining cap (distinct from insufficient wallet funds).
  // Only fires when the contract reports a finite cap (Spark); uncapped vaults (Morpho) skip it.
  const isOverDepositCap =
    txStatus === TxStatus.IDLE &&
    !!address &&
    enforcesDepositCap &&
    vaultData?.maxDeposit !== undefined &&
    debouncedAmount > vaultData.maxDeposit &&
    !isSupplyBalanceError &&
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
    isOverDepositCap ||
    depositCapReached ||
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
    setDisclaimerChecked(false);

    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: prev.flow === VaultFlow.WITHDRAW ? VaultAction.WITHDRAW : VaultAction.SUPPLY,
      screen: VaultScreen.ACTION
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
      screen: VaultScreen.REVIEW
    }));

    try {
      onAnalyticsEvent?.({
        event: WidgetAnalyticsEventType.REVIEW_VIEWED,
        action: widgetState.action,
        flow: widgetState.flow,
        amount: Number(formatUnits(debouncedAmount, assetDecimals)),
        assetSymbol: assetToken.symbol,
        data: {
          module: 'morpho',
          product: vaultName,
          productAddress: vaultAddress,
          assetAddress,
          assetSymbol: assetToken.symbol
        }
      });
    } catch {
      // Analytics must never break functionality
    }
  };

  const onClickBack = () => {
    setTxStatus(TxStatus.IDLE);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: VaultScreen.ACTION
    }));
  };

  const errorOnClick = () => {
    if (widgetState.action === VaultAction.SUPPLY) {
      return morphoVaultDeposit.execute();
    } else if (widgetState.action === VaultAction.WITHDRAW) {
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
        : widgetState.screen === VaultScreen.ACTION
          ? reviewOnClick
          : widgetState.flow === VaultFlow.SUPPLY
            ? morphoVaultDeposit.execute
            : widgetState.flow === VaultFlow.WITHDRAW
              ? max
                ? morphoVaultRedeem.execute
                : morphoVaultWithdraw.execute
              : undefined;

  const showSecondaryButton = txStatus === TxStatus.ERROR || widgetState.screen === VaultScreen.REVIEW;

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
      } else if (widgetState.screen === VaultScreen.ACTION && amount === 0n) {
        setButtonText(t`Enter amount`);
      } else if (widgetState.screen === VaultScreen.ACTION) {
        setButtonText(t`Review`);
      } else if (widgetState.screen === VaultScreen.REVIEW) {
        if (widgetState.flow === VaultFlow.WITHDRAW) {
          setButtonText(t`Confirm withdrawal`);
        } else if (shouldUseBatch) {
          setButtonText(t`Confirm bundled transaction`);
        } else if (needsAllowanceReset) {
          setButtonText(t`Confirm 3 transactions`);
        } else if (needsAllowance) {
          setButtonText(t`Confirm 2 transactions`);
        } else if (widgetState.flow === VaultFlow.SUPPLY) {
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

  // The liquidity disclaimer describes Morpho's lending markets (deposits fund
  // borrowing); it does not apply to the Spark vault, so only Morpho shows/enforces it.
  const shouldEnforceDisclaimer =
    provider === 'morpho' &&
    widgetState.action === VaultAction.SUPPLY &&
    widgetState.screen === VaultScreen.ACTION;
  const isDisabledForDisclaimer = shouldEnforceDisclaimer && !disclaimerChecked;

  // Set widget button disabled state
  useEffect(() => {
    setIsDisabled(
      txStatus === TxStatus.IDLE &&
        isConnectedAndEnabled &&
        ((widgetState.action === VaultAction.SUPPLY && (supplyDisabled || isDisabledForDisclaimer)) ||
          (widgetState.action === VaultAction.WITHDRAW && withdrawDisabled))
    );
  }, [
    widgetState.action,
    withdrawDisabled,
    isConnectedAndEnabled,
    supplyDisabled,
    txStatus,
    isDisabledForDisclaimer
  ]);

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
        flow: VaultFlow.SUPPLY,
        action: VaultAction.SUPPLY,
        screen: VaultScreen.ACTION
      });
    } else {
      setWidgetState({
        flow: VaultFlow.WITHDRAW,
        action: VaultAction.WITHDRAW,
        screen: VaultScreen.ACTION
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
          {onBackToVaults && (
            <Button variant="link" onClick={onBackToVaults} className="mb-2 p-0">
              <HStack className="space-x-2">
                <ArrowLeft className="self-center" />
                <Heading tag="h3" variant="small" className="text-textSecondary">
                  Back to Vaults
                </Heading>
              </HStack>
            </Button>
          )}
          <Heading variant="x-large" className="whitespace-nowrap">
            <Trans>{vaultName}</Trans>
          </Heading>
        </div>
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
            <VaultTransactionStatus
              assetToken={assetToken}
              amount={debouncedAmount}
              onExternalLinkClicked={onExternalLinkClicked}
              isBatchTransaction={shouldUseBatch}
              needsAllowance={needsAllowance}
              needsAllowanceReset={needsAllowanceReset}
              currentCallIndex={currentCallIndex}
              vaultLabel={vaultLabel}
            />
          </CardAnimationWrapper>
        ) : widgetState.screen === VaultScreen.REVIEW ? (
          <CardAnimationWrapper key="widget-transaction-review">
            <VaultTransactionReview
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
              isBatchTransaction={shouldUseBatch}
              assetToken={assetToken}
              amount={debouncedAmount}
              needsAllowance={needsAllowance}
              needsAllowanceReset={needsAllowanceReset}
              vaultLabel={vaultLabel}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-inputs">
            <SupplyWithdraw
              address={address}
              assetBalance={assetBalance?.value}
              vaultBalance={vaultData?.userAssets}
              maxWithdraw={maxWithdraw}
              isLiquidityConstrained={isLiquidityConstrained}
              isLiquidityDataUnavailable={isLiquidityDataUnavailable}
              userShares={vaultData?.userShares}
              // On-chain balance + TVL; not gated on isMarketDataLoading (that made the Spark stats slow).
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
                widgetState.flow === VaultFlow.SUPPLY
                  ? isSupplyBalanceError || isOverDepositCap
                  : isWithdrawBalanceError
              }
              maxDeposit={maxDepositInput}
              depositCapReached={depositCapReached}
              isOverDepositCap={isOverDepositCap}
              onSetMax={setMax}
              tabIndex={tabIndex}
              enabled={enabled}
              onExternalLinkClicked={onExternalLinkClicked}
              vaultAddress={vaultAddress}
              vaultName={vaultName}
              provider={provider}
              vaultTvl={vaultTvl}
              vaultRate={resolveSparkVaultRate({
                apiFormattedRate: marketData?.rate?.formattedNetRate,
                onChainFormattedRate: sparkRate
              })}
              shareDecimals={vaultData?.decimals ?? 18}
              availableLiquidity={availableLiquidity}
              disclaimerChecked={disclaimerChecked}
              onDisclaimerChange={provider === 'morpho' ? setDisclaimerChecked : undefined}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};

export const VaultWidget = withWidgetProvider(VaultWidgetWrapped, 'VaultWidget');

/** @deprecated Use {@link VaultWidget}. Kept as a thin alias. */
export const MorphoVaultWidget = VaultWidget;
