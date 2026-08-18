import { useMemo } from 'react';
import { useChainId, useChains } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt, formatNumber, projectAnnualEarnings } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { ModalAmountField } from '@/components/product/ModalAmountField';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { withdrawalWording } from '@/components/product/withdrawalAvailability';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { useNetworkFee } from '@/hooks';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import { useBundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import { useSavingsLaunch, type SavingsLaunchFlow } from '../hooks/useSavingsLaunch';
import { useSavingsTransactionForm, type SavingsModalPreset } from '../hooks/useSavingsTransactionForm';
import { SavingsOriginSelect } from './SavingsOriginSelect';
import {
  buildSupplyModalRows,
  buildSupplyReviewRows,
  buildWithdrawModalRows,
  buildWithdrawReviewRows
} from './savingsModalRows';

// `SavingsModalPreset` now lives with the shared form model; re-exported here so the
// modal trigger (`useSavingsModal`) and tests keep importing it from this module.
export type { SavingsModalPreset } from '../hooks/useSavingsTransactionForm';

const NO_VALUE = '–';
const USDS_DECIMALS = 18;

const formatUsds = (value: bigint) =>
  formatNumber(parseFloat(formatUnits(value, USDS_DECIMALS)), { maxDecimals: 2 });

/**
 * Editable body for the "Supply to / Withdraw from Sky Savings" modals (Figma
 * 859:36036 entry / 859:36154 review), mounted as the shared modal's
 * `entry.content`. One body, two flows (`flow`).
 *
 * The form model (amount/Max/token state, the balance + L2 PSM reads, and the spend
 * gate) lives in `useSavingsTransactionForm`, shared with the inline no-position
 * surface; this component is the modal *presentation* over it: the DS amount field
 * (label + 24px icon + Heading-3 input, balance + 25/50/100% chips + token
 * dropdown) and the two-column detail grid. The shared modal owns the confirm
 * button and the three-screen sequence (entry → review → wallet): this body keeps
 * the button's gating + the review breakdown + step labels + the wallet-screen
 * hero + minimized-toast titles live via `updateModalContent`, which *merges* into
 * the entry (so this `content` is never re-pushed and the body never remounts —
 * keeping the input focused and loop-free). The review's Confirm fires the engine
 * `execute` from `useSavingsLaunch` — calldata is identical to the inline path.
 */
export function SavingsModalForm({
  sessionId,
  flow,
  preset
}: {
  sessionId: string;
  flow: SavingsLaunchFlow;
  preset?: SavingsModalPreset;
}) {
  const chainId = useChainId();
  const chains = useChains();
  const { i18n } = useLingui();

  // The mainnet supply preview feeds the review's "You'll receive" (ERC-4626
  // convertToShares); L2 covers it with the PSM min-out bound.
  const form = useSavingsTransactionForm({ flow, preset, enablePreview: true });
  const {
    isConnected,
    isSupply,
    isL2,
    originSymbol,
    originOptions,
    originDecimals,
    value,
    amount,
    available,
    isZero,
    insufficient,
    amountReady,
    usdcBlockedReason,
    position,
    apyDisplay,
    rate,
    previewShares,
    engineParams,
    transactionScreenContent,
    toast,
    onInput,
    setPercentAmount,
    switchOrigin
  } = form;

  const { execute, steps, prepared, calls, isBatch } = useSavingsLaunch(engineParams);
  const disabled = !amountReady || !prepared;

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
  // against). Same field-by-field list the convert launch hook keeps.
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
  // The position is always USDS-denominated (18-dec — on L2 `userSavingsBalance` is
  // the sUSDS balance pre-converted to USDS). Express the entered amount as a USDS
  // wad for the before→after delta: USDS/DAI are already 18-dec; a USDC amount
  // (6-dec) is widened 1:1 — exact on mainnet (`sellGem` mints amount × 1e12 at the
  // zero fee the supply is gated on), approximate on L2 (the PSM swaps ≈1:1).
  const amountWad = originDecimals === 18 ? amount : amount * 10n ** BigInt(18 - originDecimals);

  // Position after the action, clamped at zero for over-withdrawals (the
  // insufficient gate blocks submission anyway).
  const positionAfter = isSupply ? position + amountWad : position > amountWad ? position - amountWad : 0n;

  // 1Y projected earnings, the same simple principal × rate the Savings position
  // card and every other product modal show. The position is USDS-denominated and
  // USDS is $1-pegged, so the wad doubles as its USD value. A rate that hasn't
  // loaded yet keeps the cell on a dash rather than projecting zero.
  const projectEarnings = (units: bigint) =>
    rate !== undefined
      ? formatNumber(projectAnnualEarnings(parseFloat(formatUnits(units, USDS_DECIMALS)), rate), {
          maxDecimals: 2
        })
      : NO_VALUE;

  const rows = isSupply
    ? buildSupplyModalRows({
        savingsRate: apyDisplay,
        network: networkName,
        supplyBefore: formatUsds(position),
        supplyAfter: formatUsds(positionAfter),
        hasAmount: !isZero,
        // L2 PSM supply: surface the sUSDS slippage floor once an amount is entered.
        minReceived:
          isL2 && !isZero
            ? formatBigInt(engineParams.minAmountOut ?? 0n, { unit: 18, maxDecimals: 2 })
            : undefined,
        earningsBefore: projectEarnings(position),
        earningsAfter: projectEarnings(positionAfter),
        networkFee: networkFee?.formatted ?? NO_VALUE
      })
    : buildWithdrawModalRows({
        savingsRate: apyDisplay,
        network: networkName,
        supplyBefore: formatUsds(position),
        supplyAfter: formatUsds(positionAfter),
        hasAmount: !isZero,
        earningsBefore: projectEarnings(position),
        earningsAfter: projectEarnings(positionAfter),
        networkFee: networkFee?.formatted ?? NO_VALUE
      });

  // Review breakdown (Figma 859:36154): the amount hero the wallet screen also
  // draws, over the review grid. "You'll receive": mainnet supply previews sUSDS
  // shares (convertToShares); L2 supply shows the PSM min-out floor; withdraw is
  // the requested amount in the destination token.
  const youReceive = isSupply
    ? isL2
      ? `${formatBigInt(engineParams.minAmountOut ?? 0n, { unit: 18, maxDecimals: 2 })} sUSDS`
      : previewShares !== undefined
        ? `${formatUsds(previewShares)} sUSDS`
        : NO_VALUE
    : `${formatNumber(parseFloat(formatUnits(amount, originDecimals)), { maxDecimals: 2 })} ${originSymbol}`;

  // The review projects the position the transaction leaves behind. Scalar, so the
  // memo below stays stable across unrelated renders.
  const earningsAfterDisplay = projectEarnings(positionAfter);

  const transactionContent = useMemo(() => {
    const reviewRows = isSupply
      ? buildSupplyReviewRows({
          youReceive,
          estEarnings: earningsAfterDisplay,
          product: 'Sky Savings',
          rate: apyDisplay,
          withdrawal: i18n._(withdrawalWording('savings', 'supply')),
          network: networkName,
          networkFee: networkFee?.formatted ?? NO_VALUE
        })
      : buildWithdrawReviewRows({
          youReceive,
          receiveToken: originSymbol,
          estEarnings: earningsAfterDisplay,
          product: 'Sky Savings',
          rate: apyDisplay,
          withdrawal: i18n._(withdrawalWording('savings', 'withdraw')),
          network: networkName,
          networkFee: networkFee?.formatted ?? NO_VALUE
        });
    return (
      <div className="flex flex-col gap-8 sm:gap-12" data-testid={`savings-modal-${flow}-review`}>
        {transactionScreenContent}
        <ModalSummaryGrid
          rows={toGridCells(reviewRows, 'savings-modal-row', feeCell)}
          dividerClassName="h-6"
        />
      </div>
    );
  }, [
    isSupply,
    youReceive,
    earningsAfterDisplay,
    apyDisplay,
    networkName,
    originSymbol,
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
    transactionContent,
    transactionScreenContent,
    steps,
    toast,
    // All supply/withdraw origins are $1-pegged (USDS/DAI/USDC), so the
    // entered amount doubles as the USD notional (enhanced screening, APP-517).
    usdValue: parseFloat(formatUnits(amount, originDecimals))
  });

  const body = (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid={`savings-modal-${flow}-form`}>
      <ModalAmountField
        label={<Trans>Amount</Trans>}
        tokenSymbol={originSymbol}
        value={value}
        onInput={onInput}
        disabled={!isConnected}
        balance={
          <>
            <Trans>Balance</Trans>:{' '}
            {isConnected
              ? formatNumber(parseFloat(formatUnits(available, originDecimals)), { maxDecimals: 2 })
              : NO_VALUE}
          </>
        }
        onPercent={setPercentAmount}
        selector={
          <SavingsOriginSelect
            value={originSymbol}
            options={originOptions}
            onChange={switchOrigin}
            disabled={!isConnected}
          />
        }
        error={
          insufficient ? (
            <Text className="text-error text-sm" data-testid="savings-modal-amount-error">
              <Trans>Insufficient balance</Trans>
            </Text>
          ) : usdcBlockedReason ? (
            // The USDC leg swaps through the PSM wrapper; when the module is off, the
            // sell direction is halted, or it charges a fee, say so rather than leaving
            // Review inert with no explanation. One message for all three reasons —
            // "unavailable" is true of each, and the distinction between them is the
            // Protocol's business, not something the depositor can act on differently.
            <Text className="text-error text-sm" data-testid="savings-modal-usdc-blocked">
              <Trans>USDC conversion is unavailable right now. Supply USDS or DAI instead.</Trans>
            </Text>
          ) : undefined
        }
        inputAriaLabel={isSupply ? t`Supply amount` : t`Withdraw amount`}
        inputTestId="savings-modal-amount-input"
        maxTestId="savings-modal-amount-max"
      />

      <ModalSummaryGrid rows={toGridCells(rows, 'savings-modal-row', feeCell)} dividerClassName="h-8" />

      {bundleState.promoVisible && <BundleSavingsPromo saving={networkFee!.batchSaving!} />}
    </div>
  );

  return renderInSlot(body);
}
