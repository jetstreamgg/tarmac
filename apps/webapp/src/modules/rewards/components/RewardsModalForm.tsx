import { useMemo } from 'react';
import { useChainId, useChains } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { type Token, useNetworkFee } from '@/hooks';
import { formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { ModalAmountField } from '@/components/product/ModalAmountField';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { withdrawalWording } from '@/components/product/withdrawalAvailability';
import { TokenSelectorPill } from '@/components/product/TokenSelectorPill';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import { useBundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { enginePrepareErrorMessage } from '@/modules/ui/lib/enginePrepareErrorMessage';
import { useRewardsLaunch, type RewardsLaunchFlow } from '../hooks/useRewardsLaunch';
import { useRewardsTransactionForm, type RewardsModalPreset } from '../hooks/useRewardsTransactionForm';
import {
  buildRewardsSupplyModalRows,
  buildRewardsSupplyReviewRows,
  buildRewardsWithdrawModalRows,
  buildRewardsWithdrawReviewRows
} from './rewardsModalRows';

export type { RewardsModalPreset } from '../hooks/useRewardsTransactionForm';

const NO_VALUE = '–';

const formatUsd = (value: number) => `$${formatNumber(value, { maxDecimals: 2 })}`;

/**
 * Editable body for the rewards "Supply to / Withdraw from {farm}" modals,
 * mounted as the shared modal's entry screen — the rewards analogue of
 * `SavingsModalForm`. One body, two flows. No Figma comps exist for these
 * flows, so the presentation adapts the Savings template to the farm's data
 * points: the DS amount field (label + 24px icon + Heading-3 input, balance +
 * 25/50/100% chips + static token chip) over the two-column detail grid, and a
 * review stage whose breakdown pairs the legacy rows into the shared grid.
 *
 * The form model (`useRewardsTransactionForm`) is shared; the shared modal owns
 * the confirm button and the three-screen sequence (entry → review → wallet).
 * This body keeps the button's gating + the review breakdown + step labels +
 * the wallet-screen hero + minimized-toast titles live via `updateModalContent`
 * so the body never remounts (input stays focused). The review's Confirm fires
 * the engine `execute` from `useRewardsLaunch`.
 */
export function RewardsModalForm({
  sessionId,
  flow,
  contractAddress,
  supplyToken,
  displayName,
  rewardTokenSymbol,
  rate,
  preset
}: {
  sessionId: string;
  flow: RewardsLaunchFlow;
  contractAddress: `0x${string}`;
  supplyToken: Token;
  /** Product title shown in the review "Product" cell (e.g. "SPK Rewards"). */
  displayName: string;
  /** Reward-token symbol for the "Rewards in" cell; omit for point farms. */
  rewardTokenSymbol?: string;
  /** Reward rate as a decimal fraction (e.g. 0.045) for the Rate + projected-earnings cells. */
  rate?: number;
  preset?: RewardsModalPreset;
}) {
  const chainId = useChainId();
  const chains = useChains();
  const { i18n } = useLingui();

  const form = useRewardsTransactionForm({ flow, contractAddress, supplyToken, preset });
  const {
    isConnected,
    isSupply,
    decimals,
    value,
    amount,
    available,
    position,
    isZero,
    insufficient,
    amountReady,
    engineParams,
    toast,
    transactionScreenContent,
    onInput,
    setPercentAmount
  } = form;

  const { execute, steps, prepared, error, calls, isBatch } = useRewardsLaunch(engineParams);
  const disabled = !amountReady || !prepared;
  const errorMessage = enginePrepareErrorMessage(prepared, error);

  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const { data: networkFee, error: networkFeeError } = useNetworkFee({
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
  // against). Same field-by-field list the savings form keeps.
  const feeCell = useMemo(
    () => ({ fee: networkFee, state: bundleState }),
    [
      networkFee?.formatted,
      networkFee?.batchSaving,
      bundleState.ready,
      bundleState.settled,
      bundleState.canBundle,
      bundleState.promoVisible
    ]
  );

  const networkName = chains.find(c => c.id === chainId)?.name ?? 'Ethereum';
  const rateValue = rate !== undefined ? formatDecimalPercentage(rate) : NO_VALUE;

  // Position/earnings deltas from the parsed engine `amount` (not the raw input)
  // so the preview matches what's submitted. USD ≈ amount for the $1-pegged
  // supply token (USDS); earnings = position × rate, "–" for point farms.
  const positionUsd = parseFloat(formatUnits(position, decimals));
  const amountUsd = parseFloat(formatUnits(amount, decimals));
  const positionAfterUsd = isSupply ? positionUsd + amountUsd : Math.max(positionUsd - amountUsd, 0);
  const earnings = (principalUsd: number) =>
    rate !== undefined ? formatUsd(projectAnnualEarnings(principalUsd, rate)) : NO_VALUE;

  const entryInput = {
    rate: rateValue,
    network: networkName,
    supplyToken: supplyToken.symbol,
    supplyBefore: formatNumber(positionUsd, { maxDecimals: 2 }),
    supplyAfter: formatNumber(positionAfterUsd, { maxDecimals: 2 }),
    hasAmount: !isZero,
    earningsBefore: earnings(positionUsd),
    earningsAfter: earnings(positionAfterUsd),
    networkFee: networkFee?.formatted ?? NO_VALUE
  };
  const rows = isSupply
    ? buildRewardsSupplyModalRows({ ...entryInput, rewardsIn: rewardTokenSymbol })
    : buildRewardsWithdrawModalRows(entryInput);

  // Review breakdown: the amount hero the wallet screen also draws, over the
  // review grid. The Product cell's iconbox carries the reward token (the
  // farm's mark), falling back to the supply token for point farms.
  const transactionContent = useMemo(() => {
    const reviewInput = {
      estEarnings: rate !== undefined ? formatUsd(projectAnnualEarnings(positionAfterUsd, rate)) : NO_VALUE,
      product: displayName,
      productToken: rewardTokenSymbol ?? supplyToken.symbol,
      rate: rateValue,
      network: networkName,
      networkFee: networkFee?.formatted ?? NO_VALUE
    };
    const reviewRows = isSupply
      ? buildRewardsSupplyReviewRows({
          ...reviewInput,
          rewardsIn: rewardTokenSymbol,
          withdrawal: i18n._(withdrawalWording('rewards', 'supply'))
        })
      : buildRewardsWithdrawReviewRows({
          ...reviewInput,
          youReceive: `${formatNumber(amountUsd, { maxDecimals: 2 })} ${supplyToken.symbol}`,
          receiveToken: supplyToken.symbol,
          withdrawal: i18n._(withdrawalWording('rewards', 'withdraw'))
        });
    return (
      <div className="flex flex-col gap-8 sm:gap-12" data-testid={`rewards-modal-${flow}-review`}>
        {transactionScreenContent}
        <ModalSummaryGrid
          rows={toGridCells(reviewRows, 'rewards-modal-row', feeCell)}
          dividerClassName="h-6"
        />
      </div>
    );
  }, [
    isSupply,
    rate,
    positionAfterUsd,
    amountUsd,
    displayName,
    rewardTokenSymbol,
    supplyToken.symbol,
    rateValue,
    networkName,
    flow,
    transactionScreenContent,
    feeCell,
    networkFee,
    i18n
  ]);

  // Stable confirm over a live `execute` ref + the `updateModalContent` push that
  // keeps the shared modal's confirm gating / review breakdown / step labels /
  // wallet summary / toast titles in sync, and the entry-slot portal.
  const renderInSlot = useModalEntryBody({
    sessionId,
    execute,
    confirmDisabled: disabled,
    errorMessage,
    transactionContent,
    transactionScreenContent,
    steps,
    toast
  });

  const body = (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid={`rewards-modal-${flow}-form`}>
      <ModalAmountField
        label={<Trans>Amount</Trans>}
        tokenSymbol={supplyToken.symbol}
        value={value}
        onInput={onInput}
        disabled={!isConnected}
        balance={
          <>
            <Trans>Balance</Trans>:{' '}
            {isConnected
              ? formatNumber(parseFloat(formatUnits(available, decimals)), { maxDecimals: 2 })
              : NO_VALUE}
          </>
        }
        onPercent={setPercentAmount}
        selector={
          <TokenSelectorPill tokens={[supplyToken]} selected={supplyToken} testId="rewards-modal-asset" />
        }
        error={
          insufficient ? (
            <Text className="text-error text-sm" data-testid="rewards-modal-amount-error">
              {isSupply ? <Trans>Insufficient balance</Trans> : <Trans>Amount exceeds your position</Trans>}
            </Text>
          ) : undefined
        }
        inputAriaLabel={isSupply ? t`Supply amount` : t`Withdraw amount`}
        inputTestId="rewards-modal-amount-input"
        maxTestId="rewards-modal-amount-max"
      />

      <ModalSummaryGrid rows={toGridCells(rows, 'rewards-modal-row', feeCell)} dividerClassName="h-8" />

      {bundleState.promoVisible && <BundleSavingsPromo saving={networkFee!.batchSaving!} />}
    </div>
  );

  return renderInSlot(body);
}
