import { useMemo } from 'react';
import { useChainId, useChains } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ArrowRight } from 'lucide-react';
import { formatBigInt, formatNumber } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { ModalAmountField } from '@/components/product/ModalAmountField';
import { ModalSummaryGrid, type ModalSummaryCell } from '@/components/product/ModalSummaryGrid';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useChainImage } from '@/widgets';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { useSavingsLaunch, type SavingsLaunchFlow } from '../hooks/useSavingsLaunch';
import { useSavingsTransactionForm, type SavingsModalPreset } from '../hooks/useSavingsTransactionForm';
import { SavingsOriginSelect } from './SavingsOriginSelect';
import {
  buildSupplyModalRows,
  buildSupplyReviewRows,
  buildWithdrawModalRows,
  buildWithdrawReviewRows,
  type SavingsModalCell
} from './savingsModalRows';

// `SavingsModalPreset` now lives with the shared form model; re-exported here so the
// modal trigger (`useSavingsModal`) and tests keep importing it from this module.
export type { SavingsModalPreset } from '../hooks/useSavingsTransactionForm';

const NO_VALUE = '–';
const USDS_DECIMALS = 18;

const formatUsds = (value: bigint) =>
  formatNumber(parseFloat(formatUnits(value, USDS_DECIMALS)), { maxDecimals: 2 });

/** The savings-green treatment on a value's trailing "%" (Figma gradient-savings, per WalletDrawerAssets). */
function RatePercent({ value }: { value: string }) {
  if (!value.endsWith('%')) return <>{value}</>;
  return (
    <>
      {value.slice(0, -1)}
      <span className="bg-gradient-to-b from-[#02c2a1] to-[#9fde88] bg-clip-text text-transparent">%</span>
    </>
  );
}

/** 12px trending-up glyph (Figma Icons/General/trending-up) in the system-success green. */
function TrendIcon() {
  return (
    <svg viewBox="0 0 12 12" className="text-statusSuccessSolid size-3 shrink-0" fill="none" aria-hidden>
      <path
        d="M8 3.5h3v3M11 3.5 6.75 7.75l-2.5-2.5L1 8.5"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 12px chain icon for the Network cells. */
function NetworkIcon() {
  const chainId = useChainId();
  const src = useChainImage(chainId);
  if (!src) return null;
  return <img src={src} alt="" className="size-3 shrink-0 rounded-full" />;
}

function CellToken({ symbol, ringed = false }: { symbol: string; ringed?: boolean }) {
  const icon = (
    <TokenIcon
      token={{ symbol }}
      className={ringed ? 'size-full' : 'size-3 shrink-0'}
      width={12}
      showChainIcon={false}
    />
  );
  // Iconbox / Status (Figma 859:36188): 12px border-tertiary ring, 2px inset.
  if (ringed) {
    return (
      <span className="border-borderTertiary flex size-3 shrink-0 items-center justify-center rounded-full border p-px">
        {icon}
      </span>
    );
  }
  return icon;
}

/** Renders one grid cell's value: optional icon, then a single value or the before→after delta. */
function CellValue({ cell }: { cell: SavingsModalCell }) {
  const icon = cell.network ? (
    <NetworkIcon />
  ) : cell.trend ? (
    <TrendIcon />
  ) : cell.token ? (
    <CellToken symbol={cell.token} ringed={cell.productIcon} />
  ) : null;

  if (cell.kind === 'single') {
    return (
      <span className="flex items-center gap-1">
        {icon}
        <span>{cell.rateAccent ? <RatePercent value={cell.value} /> : cell.value}</span>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1">
        {icon}
        <span>{cell.before}</span>
      </span>
      <ArrowRight className="text-fgPrimary size-3 shrink-0" aria-hidden />
      <span className="flex items-center gap-1">
        {icon}
        <span>{cell.after}</span>
      </span>
    </span>
  );
}

const toGridCells = (rows: SavingsModalCell[][]): ModalSummaryCell[][] =>
  rows.map(row =>
    row.map(cell => ({
      label: cell.label,
      testId: `savings-modal-row-${cell.label}`,
      content: <CellValue cell={cell} />
    }))
  );

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
    position,
    apyDisplay,
    previewShares,
    engineParams,
    transactionScreenContent,
    toast,
    onInput,
    setPercentAmount,
    switchOrigin
  } = form;

  const { execute, steps, prepared } = useSavingsLaunch(engineParams);
  const disabled = !amountReady || !prepared;

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
        network: networkName,
        supplyBefore: formatUsds(position),
        supplyAfter: formatUsds(position + amountWad),
        hasAmount: !isZero,
        // L2 PSM supply: surface the sUSDS slippage floor once an amount is entered.
        minReceived:
          isL2 && !isZero
            ? formatBigInt(engineParams.minAmountOut ?? 0n, { unit: 18, maxDecimals: 2 })
            : undefined,
        // 1Y est. earnings has no projection source yet (PRD Out of Scope) — stubbed.
        earningsBefore: NO_VALUE,
        earningsAfter: NO_VALUE,
        networkFee: NO_VALUE
      })
    : buildWithdrawModalRows({
        savingsRate: apyDisplay,
        network: networkName,
        supplyBefore: formatUsds(position),
        supplyAfter: formatUsds(position > amountWad ? position - amountWad : 0n),
        hasAmount: !isZero,
        earningsBefore: NO_VALUE,
        earningsAfter: NO_VALUE,
        networkFee: NO_VALUE
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
    : `${value ? formatNumber(parseFloat(value), { maxDecimals: 2 }) : '0'} ${originSymbol}`;

  const transactionContent = useMemo(() => {
    const reviewRows = isSupply
      ? buildSupplyReviewRows({
          youReceive,
          estEarnings: NO_VALUE,
          product: 'Sky Savings',
          rate: apyDisplay,
          withdrawal: t`Anytime`,
          network: networkName,
          networkFee: NO_VALUE
        })
      : buildWithdrawReviewRows({
          youReceive,
          receiveToken: originSymbol,
          product: 'Sky Savings',
          rate: apyDisplay,
          network: networkName,
          networkFee: NO_VALUE
        });
    return (
      <div className="flex flex-col gap-8 sm:gap-12" data-testid={`savings-modal-${flow}-review`}>
        {transactionScreenContent}
        <ModalSummaryGrid rows={toGridCells(reviewRows)} dividerClassName="h-6" />
      </div>
    );
  }, [isSupply, youReceive, apyDisplay, networkName, originSymbol, flow, transactionScreenContent]);

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
    toast
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
          ) : undefined
        }
        inputAriaLabel={isSupply ? t`Supply amount` : t`Withdraw amount`}
        inputTestId="savings-modal-amount-input"
        maxTestId="savings-modal-amount-max"
      />

      <ModalSummaryGrid rows={toGridCells(rows)} dividerClassName="h-8" />
    </div>
  );

  return renderInSlot(body);
}
