import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useChainId, useChains } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatBigInt, formatNumber } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { useTransaction, useEntrySlot } from '@/modules/ui/context/TransactionContext';
import { useSavingsLaunch, type SavingsLaunchFlow } from '../hooks/useSavingsLaunch';
import {
  useSavingsTransactionForm,
  type SavingsModalPreset
} from '../hooks/useSavingsTransactionForm';
import { buildSupplyModalRows, buildWithdrawModalRows, type SavingsModalRow } from './savingsModalRows';
import { SavingsOriginSelect } from './SavingsOriginSelect';

// `SavingsModalPreset` now lives with the shared form model; re-exported here so the
// modal trigger (`useSavingsModal`) and tests keep importing it from this module.
export type { SavingsModalPreset } from '../hooks/useSavingsTransactionForm';

const NO_VALUE = '–';
const USDS_DECIMALS = 18;

const formatUsds = (value: bigint) =>
  `${formatNumber(parseFloat(formatUnits(value, USDS_DECIMALS)), { maxDecimals: 2 })} USDS`;

function ModalRow({ row }: { row: SavingsModalRow }) {
  return (
    <div className="flex items-center justify-between" data-testid={`savings-modal-row-${row.label}`}>
      <Text className="text-textSecondary text-sm">{row.label}</Text>
      {row.kind === 'single' ? (
        <Text className="text-text text-sm font-medium">{row.value}</Text>
      ) : (
        <span className="text-text flex items-center gap-1.5 text-sm font-medium">
          <Text className="text-textSecondary text-sm">{row.before}</Text>
          <span aria-hidden className="text-textSecondary">
            →
          </span>
          <Text className="text-text text-sm font-medium">{row.after}</Text>
        </span>
      )}
    </div>
  );
}

/**
 * Editable body for the has-position "Supply to / Withdraw from Sky Savings" modals
 * (Figma 527:7591 / 527:10945), mounted as the shared modal's `entry.content`. One
 * body, two flows (`flow`).
 *
 * The form model (amount/Max/token state, the balance + L2 PSM reads, and the spend
 * gate) lives in `useSavingsTransactionForm`, shared with the inline no-position
 * surface; this component is the modal *presentation* over it: the input + Max + the
 * flow's before→after rows. The shared modal owns the confirm button; this body keeps
 * that button's gating + handler + step labels + the wallet-screen summary +
 * minimized-toast titles live via `updateModalContent`, which *merges* into the entry
 * (so this `content` is never re-pushed and the body never remounts — keeping the
 * input focused and loop-free). Confirm fires the engine `execute` from
 * `useSavingsLaunch` directly (the modal is already open, so there is no separate
 * review screen) — calldata is identical to the inline/launch path.
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
  const { updateModalContent } = useTransaction();
  // Rendered as the modal's `backgroundContent` (a hidden, always-mounted host so
  // the in-flight engine hook survives minimize). The visible inputs portal into
  // the dialog's entry slot when present; with no slot (standalone / minimized)
  // they render inline in the hidden host.
  const entrySlot = useEntrySlot();

  const form = useSavingsTransactionForm({ flow, preset });
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
    position,
    apyDisplay,
    engineParams,
    transactionScreenContent,
    toast,
    onInput,
    setMaxAmount,
    switchOrigin
  } = form;

  const { execute, steps, prepared } = useSavingsLaunch(engineParams);
  const disabled = !amountReady || !prepared;

  // The modal's confirm calls this. `execute` is rebuilt every render (its calls
  // array is fresh each time), so pushing it directly would loop the sync below;
  // instead a stable handler reads the latest `execute` from a ref kept current in
  // an effect — so `onConfirm` need never be re-pushed.
  const executeRef = useRef(execute);
  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);
  const onConfirm = useCallback(() => executeRef.current(), []);

  // Keep the shared modal's confirm gating + handler + step labels + the
  // wallet-screen summary + minimized-toast titles in sync. Merged (not replacing
  // `content`), so the body never remounts; bounded to amount-driven changes, so it
  // can't loop on provider re-renders.
  useEffect(() => {
    updateModalContent(sessionId, {
      entry: { confirmDisabled: disabled },
      onConfirm,
      steps,
      transactionScreenContent,
      toast
    });
  }, [sessionId, disabled, steps, onConfirm, transactionScreenContent, toast, updateModalContent]);

  const networkName = chains.find(c => c.id === chainId)?.name ?? 'Ethereum';
  // The position is always USDS-denominated (18-dec — on L2 `userSavingsBalance` is
  // the sUSDS balance pre-converted to USDS). Express the entered amount as a USDS
  // wad for the before→after delta: USDS/DAI are already 18-dec; an L2 USDC amount
  // (6-dec) is widened 1:1 (the PSM swaps ≈1:1 — exact figures are stubbed per the
  // PRD Out of Scope). Mainnet is unchanged (amount === amountWad).
  const amountWad = originDecimals === 18 ? amount : amount * 10n ** BigInt(18 - originDecimals);
  const rows = isSupply
    ? buildSupplyModalRows({
        savingsRate: apyDisplay,
        supplyBefore: formatUsds(position),
        supplyAfter: formatUsds(position + amountWad),
        // L2 PSM supply: surface the sUSDS slippage floor once an amount is entered.
        minReceived:
          isL2 && !isZero
            ? `${formatBigInt(engineParams.minAmountOut ?? 0n, { unit: 18, maxDecimals: 2 })} sUSDS`
            : undefined,
        // 1Y est. earnings has no projection source yet (PRD Out of Scope) — stubbed.
        earningsBefore: NO_VALUE,
        earningsAfter: NO_VALUE,
        network: networkName,
        networkFee: NO_VALUE
      })
    : buildWithdrawModalRows({
        // Rate is unchanged by a withdrawal, but Figma 527:10945 draws it as a delta.
        savingsRateBefore: apyDisplay,
        savingsRateAfter: apyDisplay,
        supplyBefore: formatUsds(position),
        supplyAfter: formatUsds(position > amountWad ? position - amountWad : 0n),
        earningsBefore: NO_VALUE,
        earningsAfter: NO_VALUE,
        network: networkName,
        networkFee: NO_VALUE
      });

  const body = (
    <div className="flex flex-col gap-3" data-testid={`savings-modal-${flow}-form`}>
      <div className="bg-panel flex items-center justify-between gap-2 rounded-xl p-3">
        <input
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={e => onInput(e.target.value)}
          disabled={!isConnected}
          aria-label={isSupply ? t`Supply amount` : t`Withdraw amount`}
          data-testid="savings-modal-amount-input"
          className="text-text placeholder:text-textSecondary w-full min-w-0 bg-transparent text-2xl font-medium outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <SavingsOriginSelect
          value={originSymbol}
          options={originOptions}
          onChange={switchOrigin}
          disabled={!isConnected}
        />
      </div>

      <div className="flex items-center justify-between">
        <Text className="text-textSecondary text-sm">
          <Trans>Balance</Trans>:{' '}
          {isConnected
            ? formatNumber(parseFloat(formatUnits(available, originDecimals)), { maxDecimals: 2 })
            : NO_VALUE}
        </Text>
        <button
          type="button"
          onClick={setMaxAmount}
          className="text-textEmphasis text-sm font-medium"
          data-testid="savings-modal-amount-max"
        >
          <Trans>Max</Trans>
        </button>
      </div>

      {insufficient && (
        <Text className="text-error text-sm" data-testid="savings-modal-amount-error">
          <Trans>Insufficient balance</Trans>
        </Text>
      )}

      <div className="flex flex-col gap-3 pt-1">
        {rows.map(row => (
          <ModalRow key={row.label} row={row} />
        ))}
      </div>
    </div>
  );

  // Display inside the dialog when its entry slot is mounted; otherwise render
  // inline in the hidden host (keeps the body — and its engine hook — mounted).
  return entrySlot ? createPortal(body, entrySlot) : body;
}
