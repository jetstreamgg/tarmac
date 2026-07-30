import { useChainId, useChains } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { NetworkFeeLabel } from '@/modules/ui/components/NetworkFeeLabel';
import { formatBigInt, formatNumber } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { useNetworkFee } from '@/hooks';
import type { NetworkFeeData } from '@/hooks';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import {
  NetworkFeeValue,
  useBundleFeeState,
  type BundleFeeState
} from '@/modules/ui/components/NetworkFeeValue';
import { useSavingsLaunch, type SavingsLaunchFlow } from '../hooks/useSavingsLaunch';
import { useSavingsTransactionForm, type SavingsModalPreset } from '../hooks/useSavingsTransactionForm';
import {
  buildSupplyModalRows,
  buildWithdrawModalRows,
  NETWORK_FEE_LABEL,
  type SavingsModalRow
} from './savingsModalRows';
import { SavingsOriginSelect } from './SavingsOriginSelect';

// `SavingsModalPreset` now lives with the shared form model; re-exported here so the
// modal trigger (`useSavingsModal`) and tests keep importing it from this module.
export type { SavingsModalPreset } from '../hooks/useSavingsTransactionForm';

const NO_VALUE = '–';
const USDS_DECIMALS = 18;

const formatUsds = (value: bigint) =>
  `${formatNumber(parseFloat(formatUnits(value, USDS_DECIMALS)), { maxDecimals: 2 })} USDS`;

function ModalRow({
  row,
  networkFee,
  state
}: {
  row: SavingsModalRow;
  networkFee?: NetworkFeeData;
  state: BundleFeeState;
}) {
  const isFeeRow = row.label === NETWORK_FEE_LABEL;
  return (
    <div className="flex items-center justify-between" data-testid={`savings-modal-row-${row.label}`}>
      {/* Rows stay pure string data (asserted in savingsModalRows.test.ts); the fee row's
          tooltip and bundling badge are attached here, in the renderer, rather than
          smuggling JSX into them. */}
      <Text className="text-textSecondary text-sm">{isFeeRow ? <NetworkFeeLabel /> : row.label}</Text>
      {isFeeRow ? (
        <NetworkFeeValue fee={networkFee} state={state} />
      ) : row.kind === 'single' ? (
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

  // Stable confirm over a live `execute` ref + the `updateModalContent` push that
  // keeps the shared modal's confirm gating / step labels / wallet summary / toast
  // titles in sync, and the entry-slot portal. Returns the slot renderer.
  const renderInSlot = useModalEntryBody({
    sessionId,
    execute,
    confirmDisabled: disabled,
    steps,
    transactionScreenContent,
    toast
  });

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
        networkFee: networkFee?.formatted ?? NO_VALUE
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
        networkFee: networkFee?.formatted ?? NO_VALUE
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
          <ModalRow key={row.label} row={row} networkFee={networkFee} state={bundleState} />
        ))}
      </div>

      {bundleState.promoVisible && <BundleSavingsPromo saving={networkFee!.batchSaving!} />}
    </div>
  );

  return renderInSlot(body);
}
