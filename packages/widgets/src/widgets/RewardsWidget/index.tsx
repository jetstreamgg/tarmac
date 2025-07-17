import {
  RewardContract,
  useApproveToken,
  useRewardsRewardsBalance,
  useRewardsSupply,
  useRewardsSuppliedBalance,
  useRewardsWithdraw,
  useBatchRewardsSupply,
  useRewardsClaim,
  useTokenAllowance,
  useTokenBalance,
  getTokenDecimals,
  useIsBatchSupported,
  useRewardsChartInfo
} from '@jetstreamgg/sky-hooks';
import {
  getTransactionLink,
  useDebounce,
  formatBigInt,
  useIsSafeWallet,
  formatDecimalPercentage
} from '@jetstreamgg/sky-utils';
import { useContext, useEffect, useMemo, useState } from 'react';
import { WidgetContainer } from '../../shared/components/ui/widget/WidgetContainer';
import { RewardsFlow, RewardsAction, RewardsScreen } from './lib/constants';
import { WidgetContext, WidgetProvider } from '../../context/WidgetContext';
import { NotificationType, TxStatus } from '../../shared/constants';
import { WidgetProps, WidgetState } from '../../shared/types/widgetState';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useAccount, useChainId } from 'wagmi';
import { RewardsTransactionStatus } from './components/RewardsTransactionStatus';
import { ManagePosition } from './components/ManagePosition';
import { Heading } from '@widgets/shared/components/ui/Typography';
import { RewardsOverview } from './components/RewardsOverview';
import { Button } from '@widgets/components/ui/button';
import { getValidatedState } from '../../lib/utils';
import { formatUnits, parseUnits } from 'viem';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { ArrowLeft } from 'lucide-react';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { ErrorBoundary } from '@widgets/shared/components/ErrorBoundary';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { AnimatePresence, motion } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { RewardsTransactionReview } from './components/RewardsTransactionReview';

export type RewardsWidgetProps = WidgetProps & {
  onRewardContractChange?: (rewardContract?: RewardContract) => void;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
};

export const RewardsWidget = ({
  addRecentTransaction,
  onConnect,
  locale,
  rightHeaderComponent,
  onRewardContractChange,
  externalWidgetState,
  onStateValidated,
  onNotification,
  onWidgetStateChange,
  onExternalLinkClicked,
  enabled = true,
  legalBatchTxUrl,
  referralCode,
  shouldReset = false,
  batchEnabled,
  setBatchEnabled
}: RewardsWidgetProps) => {
  const key = shouldReset ? 'reset' : undefined;
  return (
    <ErrorBoundary componentName="RewardsWidget">
      <WidgetProvider key={key} locale={locale}>
        <RewardsWidgetWrapped
          key={key}
          addRecentTransaction={addRecentTransaction}
          onConnect={onConnect}
          locale={locale}
          rightHeaderComponent={rightHeaderComponent}
          onRewardContractChange={onRewardContractChange}
          externalWidgetState={externalWidgetState}
          onStateValidated={onStateValidated}
          onNotification={onNotification}
          onWidgetStateChange={shouldReset ? undefined : onWidgetStateChange}
          onExternalLinkClicked={onExternalLinkClicked}
          enabled={enabled}
          referralCode={referralCode}
          batchEnabled={batchEnabled}
          setBatchEnabled={setBatchEnabled}
          legalBatchTxUrl={legalBatchTxUrl}
        />
      </WidgetProvider>
    </ErrorBoundary>
  );
};

// HOC Widget
const RewardsWidgetWrapped = ({
  onConnect,
  locale,
  addRecentTransaction,
  rightHeaderComponent,
  onRewardContractChange,
  externalWidgetState,
  onStateValidated,
  onNotification,
  onWidgetStateChange,
  onExternalLinkClicked,
  enabled = true,
  legalBatchTxUrl,
  referralCode,
  batchEnabled,
  setBatchEnabled
}: RewardsWidgetProps) => {
  const validatedExternalState = getValidatedState(externalWidgetState);
  const chainId = useChainId();
  const { address, isConnecting, isConnected } = useAccount();
  const isSafeWallet = useIsSafeWallet();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const [selectedRewardContract, setSelectedRewardContract] = useState<RewardContract | undefined>(undefined);
  const [amount, setAmount] = useState(parseUnits(validatedExternalState?.amount || '0', 18));
  const [claimAmount, setClaimAmount] = useState(0n);
  const { data: batchSupported, isLoading: isBatchSupportLoading } = useIsBatchSupported();

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  useEffect(() => {
    setSelectedRewardContract(validatedExternalState?.selectedRewardContract);
    setAmount(parseUnits(validatedExternalState?.amount || '0', 18));
  }, [validatedExternalState?.selectedRewardContract, validatedExternalState?.amount]);

  // Balance of the token to be supplied
  const { data: tokenBalance, refetch: mutateTokenBalance } = useTokenBalance({
    chainId,
    address: address,
    token: selectedRewardContract?.supplyToken.address[chainId]
  });
  // Amount of tokens supplied in the contract
  const { data: suppliedBalance, mutate: mutateUserSuppliedBalance } = useRewardsSuppliedBalance({
    chainId,
    address: address,
    contractAddress: selectedRewardContract?.contractAddress as `0x${string}`
  });

  // Rewards balance
  const { data: rewardsBalance, mutate: mutateRewardsBalance } = useRewardsRewardsBalance({
    chainId,
    address: address,
    contractAddress: selectedRewardContract?.contractAddress as `0x${string}`
  });

  // Rewards chart info for rate
  const { data: chartData } = useRewardsChartInfo({
    rewardContractAddress: selectedRewardContract?.contractAddress || ''
  });

  // Get the most recent rate from chart data
  const mostRecentRate = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    const sortedData = [...chartData].sort((a, b) => b.blockTimestamp - a.blockTimestamp);
    return sortedData[0].rate;
  }, [chartData]);

  const {
    data: allowance,
    mutate: mutateAllowance,
    isLoading: allowanceLoading
  } = useTokenAllowance({
    chainId,
    contractAddress: selectedRewardContract?.supplyToken.address[chainId],
    spender: selectedRewardContract?.contractAddress as `0x${string}`,
    owner: address
  });

  const debouncedAmount = useDebounce(amount);
  const initialTabIndex = validatedExternalState?.flow === RewardsFlow.WITHDRAW ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);
  const linguiCtx = useLingui();

  useEffect(() => {
    setTabIndex(initialTabIndex);
  }, [initialTabIndex]);

  const {
    setButtonText,
    setIsDisabled,
    setIsLoading,
    setTxStatus,
    txStatus,
    setExternalLink,
    widgetState,
    setWidgetState,
    setShowStepIndicator
  } = useContext(WidgetContext);

  useNotifyWidgetState({ widgetState, txStatus, onWidgetStateChange });

  const supplyParams = {
    contractAddress: selectedRewardContract?.contractAddress as `0x${string}`,
    supplyTokenAddress: selectedRewardContract?.supplyToken.address[chainId],
    ref: referralCode,
    amount: debouncedAmount,
    onStart: (hash?: string) => {
      if (hash) {
        addRecentTransaction?.({
          hash,
          description: t`Supplying ${formatBigInt(debouncedAmount, { locale })} ${
            selectedRewardContract?.supplyToken.name ?? ''
          }`
        });
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: (hash: string | undefined) => {
      onNotification?.({
        title: t`Supply successful`,
        description: t`You supplied ${formatBigInt(debouncedAmount, { locale })} ${
          selectedRewardContract?.supplyToken.name ?? ''
        }`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      mutateAllowance();
      mutateTokenBalance();
      mutateRewardsBalance();
      mutateUserSuppliedBalance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error: Error, hash: string | undefined) => {
      onNotification?.({
        title: t`Supply failed`,
        description: t`Something went wrong with your transaction. Please try again.`,
        status: TxStatus.ERROR
      });
      mutateTokenBalance();
      setTxStatus(TxStatus.ERROR);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    }
  };

  // Supply call
  const supply = useRewardsSupply({
    ...supplyParams,
    enabled: widgetState.action === RewardsAction.SUPPLY && allowance !== undefined
  });

  const batchSupply = useBatchRewardsSupply({
    ...supplyParams,
    enabled:
      (widgetState.action === RewardsAction.SUPPLY || widgetState.action === RewardsAction.APPROVE) &&
      allowance !== undefined
  });

  // Approve
  const approve = useApproveToken({
    spender: selectedRewardContract?.contractAddress as `0x${string}`,
    enabled: widgetState.action === RewardsAction.APPROVE && allowance !== undefined,
    amount: debouncedAmount,
    contractAddress: selectedRewardContract?.supplyToken.address[chainId],
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Approving ${formatBigInt(debouncedAmount, { locale })} ${
          selectedRewardContract?.supplyToken.name ?? ''
        }`
      });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: t`Approve successful`,
        description: t`You approved ${formatBigInt(debouncedAmount, { locale })} ${
          selectedRewardContract?.supplyToken.name ?? ''
        }`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateAllowance();
      supply.retryPrepare();
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

  // Withdraw
  const withdraw = useRewardsWithdraw({
    contractAddress: selectedRewardContract?.contractAddress as `0x${string}`,
    enabled: widgetState.action === RewardsAction.WITHDRAW,
    amount: debouncedAmount,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Withdrawing ${formatBigInt(debouncedAmount, { locale })} ${
          selectedRewardContract?.supplyToken.name ?? ''
        }`
      });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: t`Withdraw successful`,
        description: t`You withdrew ${formatBigInt(debouncedAmount, { locale })} ${
          selectedRewardContract?.supplyToken.name ?? ''
        }`,
        status: TxStatus.SUCCESS
      });

      setTxStatus(TxStatus.SUCCESS);
      mutateTokenBalance();
      mutateRewardsBalance();
      mutateAllowance();
      mutateUserSuppliedBalance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error, hash) => {
      onNotification?.({
        title: t`Withdraw failed`,
        description: t`Something went wrong with your withdraw. Please try again.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      mutateTokenBalance();
      mutateAllowance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    }
  });

  // Harvest
  const claim = useRewardsClaim({
    contractAddress: selectedRewardContract?.contractAddress as `0x${string}`,
    onStart: (hash: string) => {
      addRecentTransaction?.({ hash, description: 'Claiming tokens' });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: 'Rewards claim successful',
        description: 'You claimed your rewards!',
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateRewardsBalance();
      mutateRewardsBalance();
      mutateTokenBalance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error, hash) => {
      onNotification?.({
        title: 'Claim failed',
        description: 'Something went wrong with claiming your rewards. Please try again.',
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      mutateTokenBalance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    }
  });

  const needsAllowance = !!(!allowance || allowance < amount);
  const shouldUseBatch =
    !!batchEnabled && !!batchSupported && needsAllowance && widgetState.flow === RewardsFlow.SUPPLY;

  useEffect(() => {
    if (widgetState.action === RewardsAction.CLAIM) {
      setWidgetState({
        flow: selectedRewardContract ? (tabIndex === 1 ? RewardsFlow.WITHDRAW : RewardsFlow.SUPPLY) : null,
        action: RewardsAction.CLAIM,
        screen: RewardsScreen.ACTION
      });
      return;
    }
    // Set the widget state based on tabIndex and selectedRewardContract
    setWidgetState({
      flow: selectedRewardContract ? (tabIndex === 1 ? RewardsFlow.WITHDRAW : RewardsFlow.SUPPLY) : null,
      action: selectedRewardContract
        ? tabIndex === 1
          ? RewardsAction.WITHDRAW
          : RewardsAction.SUPPLY
        : RewardsAction.OVERVIEW,
      screen: RewardsScreen.ACTION
    });
    //for some reason without the widgetState.flow dependency, the action can be stuck in approve even when we're in the withdraw flow
  }, [tabIndex, widgetState.flow, selectedRewardContract]);

  // If we're in the supply flow and action screen, need allowance, and batch transactions are not supported, set the action to approve
  // This useEffect should run whenever the useEffect above runs, so we don't end up with the wrong action
  useEffect(() => {
    if (
      widgetState.flow === RewardsFlow.SUPPLY &&
      (widgetState.screen === RewardsScreen.ACTION || widgetState.screen === RewardsScreen.REVIEW)
    ) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action:
          needsAllowance && !allowanceLoading && !shouldUseBatch && !isBatchSupportLoading
            ? RewardsAction.APPROVE
            : RewardsAction.SUPPLY
      }));
    }
  }, [
    widgetState.flow,
    widgetState.screen,
    needsAllowance,
    allowanceLoading,
    isConnectedAndEnabled,
    tabIndex,
    selectedRewardContract,
    shouldUseBatch,
    isBatchSupportLoading
  ]);

  const isSupplyBalanceError =
    txStatus === TxStatus.IDLE &&
    (tokenBalance?.value || tokenBalance?.value === 0n) &&
    debouncedAmount > tokenBalance.value &&
    amount !== 0n //don't wait for debouncing on default state
      ? true
      : false;

  const isWithdrawBalanceError =
    txStatus === TxStatus.IDLE &&
    (suppliedBalance === 0n || !!suppliedBalance) &&
    debouncedAmount > suppliedBalance &&
    amount !== 0n //don't wait for debouncing on default state
      ? true
      : false;

  const currentError =
    widgetState.flow === RewardsFlow.SUPPLY ? isSupplyBalanceError : isWithdrawBalanceError;

  const isAmountWaitingForDebounce = debouncedAmount !== amount;

  const withdrawDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isWithdrawBalanceError ||
    !withdraw.prepared ||
    withdraw.isLoading ||
    isAmountWaitingForDebounce;

  const suppliedisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    !supply.prepared ||
    supply.isLoading ||
    allowance === undefined ||
    isAmountWaitingForDebounce;

  const batchSupplyDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    !batchSupply.prepared ||
    batchSupply.isLoading ||
    isAmountWaitingForDebounce ||
    // If the user has allowance, don't send a batch transaction as it's only 1 contract call
    !needsAllowance ||
    allowanceLoading ||
    !batchSupported;

  const approveDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    !approve.prepared ||
    allowance === undefined ||
    (txStatus === TxStatus.SUCCESS && !supply.prepared) || //disable next button if supply not prepared
    isAmountWaitingForDebounce ||
    (!!batchEnabled && isBatchSupportLoading);

  const supplyPrepareError = approve.prepareError || supply.prepareError;

  useEffect(() => {
    if (supplyPrepareError) {
      console.log(supply.prepareError);
      onNotification?.({
        title: t`Error preparing transaction`,
        description: supplyPrepareError.message,
        status: TxStatus.ERROR
      });
    }
  }, [supplyPrepareError]);

  useEffect(() => {
    if (withdraw.prepareError) {
      console.log(withdraw.prepareError);
      onNotification?.({
        title: t`Error preparing transaction`,
        description: withdraw.prepareError.message,
        status: TxStatus.ERROR
      });
    }
  }, [withdraw.prepareError]);

  useEffect(() => {
    if (claim.prepareError) {
      console.log(supply.prepareError);
      onNotification?.({
        title: t`Error preparing transaction`,
        description: claim.prepareError.message,
        status: TxStatus.ERROR
      });
    }
  }, [claim.prepareError]);

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

  const approveOnClick = () => {
    setShowStepIndicator(true);
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: RewardsScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    approve.execute();
  };
  const supplyOnClick = () => {
    setShowStepIndicator(true);
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: RewardsScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    supply.execute();
  };
  const batchSupplyOnClick = () => {
    if (!needsAllowance) {
      // If the user does not need allowance, just send the individual transaction as it will be more gas efficient
      supplyOnClick();
      return;
    }
    setShowStepIndicator(true);
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: RewardsScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    batchSupply.execute();
  };
  const withdrawOnClick = () => {
    setShowStepIndicator(false);
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: RewardsScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    withdraw.execute();
  };
  const nextOnClick = () => {
    setTxStatus(TxStatus.IDLE);

    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action:
        prev.flow === RewardsFlow.WITHDRAW
          ? RewardsAction.WITHDRAW
          : needsAllowance
            ? RewardsAction.APPROVE
            : RewardsAction.SUPPLY,
      screen: RewardsScreen.ACTION
    }));

    // if successful supply/wWITHDRAW, reset amount
    if (widgetState.action !== RewardsAction.APPROVE) {
      setAmount(0n);
    }

    // if successfully approved, go to supply/withdraw
    if (widgetState.action === RewardsAction.APPROVE && !needsAllowance) {
      return widgetState.flow === RewardsFlow.SUPPLY ? supplyOnClick() : withdrawOnClick();
    }
  };

  const reviewOnClick = () => {
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: RewardsScreen.REVIEW
    }));
  };

  const onClickBack = () => {
    setTxStatus(TxStatus.IDLE);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: prev.flow === RewardsFlow.SUPPLY ? RewardsAction.SUPPLY : RewardsAction.WITHDRAW,
      screen: RewardsScreen.ACTION
    }));
  };

  // Handle the error onClicks separately to keep it clean
  const errorOnClick = () => {
    return widgetState.action === RewardsAction.SUPPLY
      ? shouldUseBatch
        ? batchSupplyOnClick()
        : supplyOnClick()
      : widgetState.action === RewardsAction.WITHDRAW
        ? withdrawOnClick()
        : widgetState.action === RewardsAction.APPROVE
          ? approveOnClick()
          : widgetState.action === RewardsAction.CLAIM
            ? onClaimClick()
            : undefined;
  };

  const onClaimClick = () => {
    setClaimAmount(rewardsBalance || 0n);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: RewardsScreen.TRANSACTION,
      action: RewardsAction.CLAIM
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    setShowStepIndicator(false);
    claim?.execute();
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : txStatus === TxStatus.SUCCESS
      ? nextOnClick
      : txStatus === TxStatus.ERROR
        ? errorOnClick
        : widgetState.screen === RewardsScreen.ACTION
          ? reviewOnClick
          : widgetState.flow === RewardsFlow.SUPPLY
            ? shouldUseBatch
              ? batchSupplyOnClick
              : widgetState.action === RewardsAction.APPROVE
                ? approveOnClick
                : supplyOnClick
            : widgetState.flow === RewardsFlow.WITHDRAW && widgetState.action === RewardsAction.WITHDRAW
              ? withdrawOnClick
              : undefined;

  const showSecondaryButton = txStatus === TxStatus.ERROR || widgetState.screen === RewardsScreen.REVIEW;

  // Update button state according to action and tx
  // Ref: https://lingui.dev/tutorials/react-patterns#memoization-pitfall
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (txStatus === TxStatus.SUCCESS && widgetState.action !== RewardsAction.APPROVE) {
        setButtonText(t`Back to Rewards`);
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (widgetState.screen === RewardsScreen.ACTION && amount === 0n) {
        setButtonText(t`Enter amount`);
      } else if (widgetState.screen === RewardsScreen.ACTION) {
        setButtonText(t`Review`);
      } else if (widgetState.screen === RewardsScreen.REVIEW) {
        if (shouldUseBatch) {
          setButtonText(t`Confirm bundled transaction`);
        } else if (widgetState.action === RewardsAction.APPROVE) {
          setButtonText(t`Confirm 2 transactions`);
        } else if (widgetState.flow === RewardsFlow.SUPPLY) {
          setButtonText(t`Confirm supply`);
        } else if (widgetState.flow === RewardsFlow.WITHDRAW) {
          setButtonText(t`Confirm withdrawal`);
        }
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [widgetState, txStatus, linguiCtx, amount, isConnectedAndEnabled, shouldUseBatch]);

  // Set widget button to be disabled depending on which action we're in
  useEffect(() => {
    setIsDisabled(
      isConnectedAndEnabled &&
        ((widgetState.action === RewardsAction.APPROVE && approveDisabled) ||
          (widgetState.action === RewardsAction.SUPPLY &&
            (shouldUseBatch ? batchSupplyDisabled : suppliedisabled)) ||
          (widgetState.action === RewardsAction.WITHDRAW && withdrawDisabled))
    );
  }, [
    isConnectedAndEnabled,
    widgetState.action,
    approveDisabled,
    suppliedisabled,
    withdrawDisabled,
    shouldUseBatch,
    batchSupplyDisabled
  ]);

  // After a successful approval, wait for the next hook (supply) to be prepared and send the transaction
  useEffect(() => {
    if (widgetState.action === RewardsAction.APPROVE && txStatus === TxStatus.SUCCESS && supply.prepared) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: RewardsAction.SUPPLY
      }));
      supplyOnClick();
    }
  }, [widgetState.action, txStatus, supply.prepared]);

  // Set isLoading to be consumed by WidgetButton
  useEffect(() => {
    setIsLoading(
      isConnecting ||
        txStatus === TxStatus.LOADING ||
        txStatus === TxStatus.INITIALIZED ||
        // Keep the loading state after a successful approval as a new transaction will automatically pop up
        (widgetState.action === RewardsAction.APPROVE && txStatus === TxStatus.SUCCESS)
    );
  }, [isConnecting, txStatus, widgetState.action]);

  const onSelectRewardContract = (rewardContract: RewardContract) => {
    setSelectedRewardContract(rewardContract);
    onRewardContractChange?.(rewardContract);
  };

  const onViewAllRewardContracts = () => {
    setSelectedRewardContract(undefined);
    onRewardContractChange?.(undefined);
    setWidgetState({
      ...widgetState,
      action: RewardsAction.OVERVIEW,
      flow: RewardsFlow.SUPPLY
    });
    setTxStatus(TxStatus.IDLE);
    setAmount(0n);
  };

  // Reset widget state after switching network
  useEffect(() => {
    // Reset all state variables
    setAmount(parseUnits(validatedExternalState?.amount || '0', 18));
    setClaimAmount(0n);
    setTxStatus(TxStatus.IDLE);
    setExternalLink(undefined);

    // Reset selected reward contract to initial value
    setSelectedRewardContract(validatedExternalState?.selectedRewardContract);

    // Reset widget state to overview screen
    setWidgetState({
      flow: null,
      action: RewardsAction.OVERVIEW,
      screen: RewardsScreen.ACTION
    });

    // Refresh data
    mutateAllowance?.();
    mutateTokenBalance?.();
    mutateRewardsBalance?.();
    mutateUserSuppliedBalance?.();
  }, [chainId]);

  return (
    <WidgetContainer
      header={
        widgetState.action === RewardsAction.OVERVIEW ? (
          <CardAnimationWrapper key="widget-title">
            <Heading variant="x-large">
              <Trans>Sky Token Rewards</Trans>
            </Heading>
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-back-button">
            <Button variant="link" onClick={onViewAllRewardContracts} className="p-0">
              <HStack className="space-x-2">
                <ArrowLeft className="self-center" />
                <Heading tag="h3" variant="small" className="text-textSecondary">
                  View all Sky Token Rewards
                </Heading>
              </HStack>
            </Button>
          </CardAnimationWrapper>
        )
      }
      rightHeader={rightHeaderComponent}
      footer={
        <AnimatePresence mode="popLayout" initial={false}>
          {widgetState.action !== RewardsAction.OVERVIEW && (
            <CardAnimationWrapper key="widget-footer" className="w-full">
              {widgetState.action !== RewardsAction.OVERVIEW && (
                <WidgetButtons
                  onClickAction={onClickAction}
                  onClickBack={onClickBack}
                  showSecondaryButton={showSecondaryButton}
                  enabled={enabled}
                  onExternalLinkClicked={onExternalLinkClicked}
                />
              )}
            </CardAnimationWrapper>
          )}
        </AnimatePresence>
      }
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {widgetState.screen === RewardsScreen.ACTION && widgetState.action === RewardsAction.OVERVIEW ? (
          <CardAnimationWrapper key="widget-overview">
            <RewardsOverview
              onSelectRewardContract={onSelectRewardContract}
              isConnectedAndEnabled={isConnectedAndEnabled}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          </CardAnimationWrapper>
        ) : txStatus !== TxStatus.IDLE && selectedRewardContract ? (
          <CardAnimationWrapper key="widget-transaction-status">
            <RewardsTransactionStatus
              rewardToken={
                widgetState.action === RewardsAction.CLAIM
                  ? selectedRewardContract?.rewardToken
                  : selectedRewardContract?.supplyToken
              }
              rewardAmount={widgetState.action === RewardsAction.CLAIM ? claimAmount : amount}
              selectedRewardContract={selectedRewardContract}
              onExternalLinkClicked={onExternalLinkClicked}
              isBatchTransaction={shouldUseBatch}
              needsAllowance={needsAllowance}
            />
          </CardAnimationWrapper>
        ) : widgetState.screen === RewardsScreen.REVIEW && selectedRewardContract ? (
          <CardAnimationWrapper key="widget-transaction-review">
            <RewardsTransactionReview
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
              isBatchTransaction={shouldUseBatch}
              rewardToken={
                widgetState.action === RewardsAction.CLAIM
                  ? selectedRewardContract?.rewardToken
                  : selectedRewardContract?.supplyToken
              }
              rewardAmount={widgetState.action === RewardsAction.CLAIM ? claimAmount : amount}
              selectedRewardContract={selectedRewardContract}
              needsAllowance={needsAllowance}
              legalBatchTxUrl={legalBatchTxUrl}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-inputs">
            <>
              <motion.div variants={positionAnimations}>
                <ManagePosition
                  rewardContract={selectedRewardContract}
                  amount={amount}
                  tokenBalance={tokenBalance?.value}
                  suppliedBalance={suppliedBalance}
                  rewardsBalance={rewardsBalance}
                  claim={claim}
                  error={currentError}
                  onChange={(newValue: bigint, userTriggered?: boolean) => {
                    setAmount(newValue);
                    if (userTriggered && selectedRewardContract?.supplyToken) {
                      // If newValue is 0n and it was triggered by user, it means they're clearing the input
                      const formattedValue =
                        newValue === 0n
                          ? ''
                          : formatUnits(
                              newValue,
                              getTokenDecimals(selectedRewardContract.supplyToken, chainId)
                            );
                      onWidgetStateChange?.({
                        originAmount: formattedValue,
                        txStatus,
                        widgetState
                      });
                    }
                  }}
                  onToggle={index => {
                    setTabIndex(index);
                    setAmount(0n);
                    onWidgetStateChange?.({
                      originAmount: '',
                      txStatus,
                      widgetState
                    });
                  }}
                  onClaimClick={onClaimClick}
                  isConnectedAndEnabled={isConnectedAndEnabled}
                  tabIndex={tabIndex}
                  onExternalLinkClicked={onExternalLinkClicked}
                />
              </motion.div>
              {!!amount && !currentError && (
                <motion.div variants={positionAnimations}>
                  <TransactionOverview
                    title={t`Transaction overview`}
                    isFetching={false}
                    fetchingMessage={t`Fetching transaction details`}
                    rateType="str"
                    onExternalLinkClicked={onExternalLinkClicked}
                    transactionData={[
                      {
                        label:
                          widgetState.flow === RewardsFlow.SUPPLY ? t`You will supply` : t`You will withdraw`,
                        value: `${formatBigInt(amount, { maxDecimals: 2, compact: true })} ${selectedRewardContract?.supplyToken.symbol ?? ''}`
                      },
                      ...(mostRecentRate && parseFloat(mostRecentRate) > 0
                        ? [
                            {
                              label: t`Rate`,
                              value: formatDecimalPercentage(parseFloat(mostRecentRate))
                            }
                          ]
                        : []),
                      ...(isConnectedAndEnabled
                        ? [
                            {
                              label: t`Your wallet ${selectedRewardContract?.supplyToken.symbol ?? ''} balance`,
                              value:
                                tokenBalance?.value !== undefined
                                  ? [
                                      formatBigInt(tokenBalance.value, { maxDecimals: 2, compact: true }),
                                      formatBigInt(
                                        widgetState.flow === RewardsFlow.SUPPLY
                                          ? tokenBalance.value - amount
                                          : tokenBalance.value + amount,
                                        { maxDecimals: 2, compact: true }
                                      )
                                    ]
                                  : '--'
                            },
                            {
                              label: t`Your ${selectedRewardContract?.rewardToken.symbol ?? ''} rewards ${selectedRewardContract?.supplyToken.symbol ?? ''} balance`,
                              value:
                                suppliedBalance !== undefined
                                  ? [
                                      formatBigInt(suppliedBalance, { maxDecimals: 2, compact: true }),
                                      formatBigInt(
                                        widgetState.flow === RewardsFlow.SUPPLY
                                          ? suppliedBalance + amount
                                          : suppliedBalance - amount,
                                        { maxDecimals: 2, compact: true }
                                      )
                                    ]
                                  : '--'
                            }
                          ]
                        : [])
                    ]}
                  />
                </motion.div>
              )}
            </>
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};
