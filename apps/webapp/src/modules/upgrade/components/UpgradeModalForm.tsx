import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { useChainId, useChains, useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { TOKENS, useMkrSkyFee, useDebounce, useTokenBalance, type UpgradeSourceToken } from '@/hooks';
import { formatNumber, math } from '@/utils';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import { useBundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import { useNetworkFee } from '@/hooks';
import { TxStatus, PopoverRateInfo } from '@/widgets';
import { Text } from '@/modules/layout/components/Typography';
import { ModalAmountField, type PercentPreset } from '@/components/product/ModalAmountField';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { TokenSelectorPill } from '@/components/product/TokenSelectorPill';
import { TokenTransferHero } from '@/components/product/TokenTransferHero';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useConnectModal } from '@/modules/ui/context/ConnectModalContext';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import type { TransactionAnalytics } from '@/modules/ui/context/transactionContract';
import { signedAmount } from '@/modules/analytics/constants';
import { setUpgradeModalOpen } from '@/modules/analytics/lib/destination';
import { parseAmountInput } from '@/lib/amountInput';
import { UPGRADE_TARGET, useUpgradeLaunch } from '../hooks/useUpgradeLaunch';
import { buildUpgradeModalRows } from './upgradeModalRows';

const NO_VALUE = '–';
const UPGRADE_SOURCE_TOKENS = [TOKENS.dai, TOKENS.mkr];

// DAI, MKR, USDS and SKY are all 18-decimal on mainnet.
const DECIMALS = 18;

// The comps pin two decimals on every amount — balance line, grid values and
// the confirm-screen hero alike ("7,500.00" / "9,000.00", Figma 1310:130760).
const formatAmount = (amount: bigint) =>
  formatNumber(parseFloat(formatUnits(amount, DECIMALS)), { minDecimals: 2, maxDecimals: 2 });

/**
 * Editable body for the "Upgrade DAI/MKR" modal (Figma 1310:130712 DAI /
 * 1310:130760 MKR), mounted as the shared modal's entry screen via
 * `useModalEntryBody` — single-screen entry (CTA "Continue" goes straight to
 * the wallet screen; the comps draw no review stage). DS amount field (balance,
 * 25/50/100% chips, source-token pill) over the shared summary grid: [Rate |
 * You'll receive], [Penalty ⓘ (MKR only) | Network], Network fee.
 *
 * The MKR→SKY figures come from the immutable 1:24,000 contract rate net of
 * the governance fee (`useMkrSkyFee`) — the engine's calldata takes the raw
 * amount, so the preview math (`math.calculateConversion`) is display-only.
 */
export function UpgradeModalForm({
  sessionId,
  initialToken = 'DAI'
}: {
  sessionId: string;
  initialToken?: UpgradeSourceToken;
}) {
  const { address, isConnected } = useConnection();
  const chainId = useChainId();
  const chains = useChains();

  const [token, setToken] = useState<UpgradeSourceToken>(initialToken);
  const [value, setValue] = useState('');

  const amount = parseAmountInput(value, DECIMALS);
  const debouncedAmount = useDebounce(amount);
  const debouncePending = debouncedAmount !== amount;

  const isMkr = token === 'MKR';
  const target = UPGRADE_TARGET[token];

  const sourceToken = isMkr ? TOKENS.mkr : TOKENS.dai;
  const { data: balance, refetch: refetchBalance } = useTokenBalance({
    address,
    token: sourceToken.address[chainId],
    chainId
  });

  const { data: mkrSkyFee } = useMkrSkyFee();
  // Unknown fee = unknown economics: the penalty/receive cells and the confirm
  // both wait on it.
  const feeUnknown = isMkr && mkrSkyFee === undefined;
  const fee = isMkr ? (mkrSkyFee ?? 0n) : 0n;
  const receiveAmount = math.calculateConversion({ symbol: token }, debouncedAmount, fee);

  const insufficient = amount > 0n && balance !== undefined && amount > balance.value;
  const amountReady = isConnected && amount > 0n && !insufficient && !debouncePending && !feeUnknown;

  const { execute, steps, prepared, error, calls, isBatch } = useUpgradeLaunch({
    token,
    amount: debouncedAmount
  });

  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const {
    data: networkFee,
    isLoading: networkFeeLoading,
    error: networkFeeError
  } = useNetworkFee({
    calls,
    chainId,
    shouldUseBatch: isBatch,
    enabled: amountReady
  });

  const bundleState = useBundleFeeState(calls.length, networkFee, !!networkFeeError);
  // Scalar deps, not the objects: `useBundleFeeState` returns a fresh object
  // every render, so depending on its identity would give the review breakdown a
  // new identity every render — and the live push that carries it would re-enter
  // the provider on each of its re-renders (the update loop the modal forms guard
  // against). Same field-by-field list the convert launch hook keeps.
  const feeCell = useMemo(
    () => ({ fee: networkFee, state: bundleState, loading: networkFeeLoading }),
    [
      networkFee?.formatted,
      networkFee?.batchSaving,
      networkFeeLoading,
      bundleState.ready,
      bundleState.settled,
      bundleState.failed,
      bundleState.canBundle,
      bundleState.promoVisible
    ]
  );
  // Disconnected (APP-446): the modal still opens — the CTA becomes an enabled
  // "Connect wallet" that opens the connect modal in place (no screen advance,
  // see `confirmAction`), and reverts to the gated "Continue" once connected.
  const { openConnectModal } = useConnectModal();
  const disabled = isConnected && (!amountReady || !prepared);

  // The wallet balance is chain state the engine's success doesn't refetch —
  // sync it so the entry screen shows the post-upgrade balance if revisited.
  const { txStatus, isModalOpen, isMinimized } = useTransaction();
  useEffect(() => {
    if (txStatus === TxStatus.SUCCESS) refetchBalance();
  }, [txStatus, refetchBalance]);

  // Upgrade is the one URL-less surface: while its modal is visibly open the
  // destination stamp reads 'upgrade' (APP-444 D2/B6). Gated on visibility, not
  // mount — this body stays mounted (hidden) through minimize, and while
  // minimized events belong to the section the user is actually browsing.
  const modalVisible = isModalOpen && !isMinimized;
  useEffect(() => {
    setUpgradeModalOpen(modalVisible);
    return () => setUpgradeModalOpen(false);
  }, [modalVisible]);

  const amountLabel = `${formatAmount(debouncedAmount)} ${token}`;

  // Memoized on their data so the useModalEntryBody sync effect has stable
  // deps (the savings/stUSDS forms' convention).
  const toast = useMemo(
    () => ({
      loading: t`Upgrading ${amountLabel}`,
      success: t`${amountLabel} upgraded!`,
      error: t`Upgrade failed`
    }),
    [amountLabel]
  );

  // Wallet/status screen ("Confirm upgrade", Figma 1310:130685): source →
  // target hero rows with the 20px move-down arrow between, above the
  // Approve/Upgrade steps.
  const transactionScreenContent = useMemo(
    () => (
      <TokenTransferHero
        from={{ symbol: token, amount: formatAmount(debouncedAmount), testId: 'upgrade-modal-from-amount' }}
        to={{ symbol: target, amount: formatAmount(receiveAmount), testId: 'upgrade-modal-to-amount' }}
        testId="upgrade-modal-summary"
      />
    ),
    [token, target, debouncedAmount, receiveAmount]
  );

  // Legacy UpgradeWidget payload shape (APP-444 B6): widget_name 'convert', the
  // redesign modal only upgrades (no revert direction), so the amount is always
  // positive.
  const analytics = useMemo<TransactionAnalytics>(
    () => ({
      widgetName: 'convert',
      flow: 'upgrade',
      action: 'upgrade',
      data: {
        module: 'upgrade',
        assetAddress: sourceToken.address[chainId],
        assetSymbol: token,
        targetSymbol: target,
        targetAddress: (target === 'USDS' ? TOKENS.usds : TOKENS.sky).address[chainId],
        isBatchTx: isBatch,
        amount: signedAmount(parseFloat(formatUnits(debouncedAmount, DECIMALS)), 'upgrade')
      }
    }),
    [sourceToken, chainId, token, target, isBatch, debouncedAmount]
  );

  // Stable identity — an inline arrow here re-triggers useModalEntryBody's sync effect every render.
  const connectAction = useCallback(() => openConnectModal('upgrade_modal'), [openConnectModal]);

  const renderInSlot = useModalEntryBody({
    sessionId,
    execute,
    confirmDisabled: disabled,
    confirmLabel: isConnected ? t`Continue` : t`Connect wallet`,
    confirmAction: isConnected ? undefined : connectAction,
    steps,
    transactionScreenContent,
    toast,
    analytics
  });

  const networkName = chains.find(chain => chain.id === chainId)?.name ?? 'Ethereum';

  const setPercent = (percent: PercentPreset) => {
    if (balance === undefined) return;
    setValue(formatUnits((balance.value * BigInt(percent)) / 100n, DECIMALS));
  };

  const rows = buildUpgradeModalRows({
    sourceToken: token,
    targetToken: target,
    targetRate: isMkr
      ? formatNumber(Number(math.MKR_TO_SKY_RATE), { minDecimals: 2, maxDecimals: 2 })
      : '1.00',
    receiveAmount: formatAmount(receiveAmount),
    penalty: isMkr
      ? `${formatNumber(Number(math.calculateUpgradePenalty(mkrSkyFee)), { minDecimals: 2, maxDecimals: 2 })}%`
      : undefined,
    // 12px info glyph after the label (Figma 1343:79562).
    penaltyInfo: isMkr ? <PopoverRateInfo type="delayedUpgradePenalty" width={12} height={12} /> : undefined,
    network: networkName,
    networkFee: networkFee?.formatted ?? NO_VALUE,
    feeLoading: feeUnknown
  });

  const body = (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid="upgrade-modal-form">
      <ModalAmountField
        label={<Trans>Amount</Trans>}
        tokenSymbol={token}
        value={value}
        decimals={DECIMALS}
        onInput={setValue}
        disabled={!isConnected}
        balance={
          <>
            <Trans>Balance</Trans>:{' '}
            {isConnected && balance !== undefined ? formatAmount(balance.value) : NO_VALUE}
          </>
        }
        onPercent={setPercent}
        selector={
          <TokenSelectorPill
            tokens={UPGRADE_SOURCE_TOKENS}
            selected={sourceToken}
            onSelect={next => {
              setToken(next.symbol as UpgradeSourceToken);
              setValue('');
            }}
            testId="upgrade-token-select"
          />
        }
        error={
          insufficient ? (
            <Text className="text-error text-sm" data-testid="upgrade-modal-amount-error">
              <Trans>Insufficient balance</Trans>
            </Text>
          ) : undefined
        }
        inputAriaLabel={t`Upgrade amount`}
        inputTestId="upgrade-modal-amount-input"
        maxTestId="upgrade-modal-amount-max"
      />

      <div className="flex flex-col gap-4">
        <ModalSummaryGrid rows={toGridCells(rows, 'upgrade-modal-row', feeCell)} dividerClassName="h-6" />

        {bundleState.promoVisible && <BundleSavingsPromo saving={networkFee!.batchSaving!} />}
        {error && amountReady && (
          <Text className="text-error text-sm" data-testid="upgrade-modal-error">
            <Trans>Something went wrong preparing the transaction. Please try again.</Trans>
          </Text>
        )}
      </div>
    </div>
  );

  return renderInSlot(body);
}
