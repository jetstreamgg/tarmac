import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChainId, useChains, useConnection } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  getTokenDecimals,
  useSavingsData,
  useOverallSkyData,
  useTokenBalance,
  usePreviewSwapExactIn,
  usePreviewSwapExactOut,
  TOKENS
} from '@/hooks';
import { formatBigInt, formatNumber, formatDecimalPercentage, isL2ChainId } from '@/utils';
import { REFERRAL_CODE } from '@/lib/constants';
import { Text } from '@/modules/layout/components/Typography';
import { useTransaction, useEntrySlot } from '@/modules/ui/context/TransactionContext';
import { useSavingsLaunch, type SavingsLaunchFlow } from '../hooks/useSavingsLaunch';
import { useSavingsSupplyMinAmountOut } from '../hooks/useSavingsSupplyMinAmountOut';
import { buildSupplyModalRows, buildWithdrawModalRows, type SavingsModalRow } from './savingsModalRows';
import { SavingsAmountSummary } from './SavingsAmountSummary';
import {
  ORIGIN_TOKENS,
  MAINNET_SUPPLY_ORIGINS,
  L2_SUPPLY_ORIGINS,
  L2_WITHDRAW_ORIGINS,
  SavingsOriginSelect,
  type OriginSymbol
} from './SavingsOriginSelect';

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
 * body, two flows (`flow`) — the single component the PRD calls for (module 2).
 *
 * Token choice (Figma `USDS ▾`):
 *  - mainnet supply  → USDS / DAI (DAI routes to upgrade-and-supply, calldata unchanged)
 *  - mainnet withdraw → USDS-only (static chip)
 *  - L2 supply       → USDS / USDC (USDC swaps through the PSM)
 *  - L2 withdraw     → USDS / USDC destination choice (sUSDS swaps out to the picked token)
 *
 * It owns its amount/max state and renders the input + Max + the flow's before→after
 * rows. The shared modal owns the confirm button; this body keeps that button's
 * gating + handler live via `updateModalContent`, which *merges* into the entry (so
 * this `content` is never re-pushed and the body never remounts — keeping the input
 * focused and loop-free). Confirm fires the engine `execute` from `useSavingsLaunch`
 * directly (the modal is already open, so there is no separate review screen) —
 * calldata is identical to the inline/launch path.
 *
 * Supply spends the wallet balance of the origin token; withdraw spends the position
 * (mainnet: the USDS savings balance; L2: the sUSDS balance converted to the chosen
 * destination token). A withdraw Max sets the `max` flag so the engine redeems the
 * whole position with no dust — mainnet via `maxWithdraw(owner)`, L2 via
 * `swapExactIn(whole sUSDS balance)`; the UI never computes the redeem amount. The L2
 * PSM bounds (`minAmountOut` / `sUsdsBalance` / `minAmountOutForWithdrawAll` /
 * `maxAmountInForWithdraw`) are computed here and handed straight to the orchestrator
 * (mirroring `SavingsSupplyWithdrawPanel`); they are no-ops on mainnet.
 */
export function SavingsModalForm({ sessionId, flow }: { sessionId: string; flow: SavingsLaunchFlow }) {
  const isSupply = flow === 'supply';
  const chainId = useChainId();
  const chains = useChains();
  const { address, isConnected } = useConnection();
  const { data: savingsData } = useSavingsData();
  const { data: overall } = useOverallSkyData();
  const { updateModalContent } = useTransaction();
  // Rendered as the modal's `backgroundContent` (a hidden, always-mounted host so
  // the in-flight engine hook survives minimize). The visible inputs portal into
  // the dialog's entry slot when present; with no slot (standalone / minimized)
  // they render inline in the hidden host.
  const entrySlot = useEntrySlot();

  const [value, setValue] = useState('');
  // Withdraw-only: set by Max so the engine redeems the whole position (no dust).
  // Cleared the moment the user edits the amount.
  const [max, setMax] = useState(false);
  const [originSymbol, setOriginSymbol] = useState<OriginSymbol>('USDS');
  const isL2 = isL2ChainId(chainId);
  // Supply always offers an origin choice (USDS/DAI mainnet, USDS/USDC L2); withdraw
  // offers a destination choice only on L2 (USDS/USDC). Mainnet withdraw → USDS-only
  // static chip.
  const showOriginSelect = isSupply || isL2;
  const origins = isSupply ? (isL2 ? L2_SUPPLY_ORIGINS : MAINNET_SUPPLY_ORIGINS) : L2_WITHDRAW_ORIGINS;
  const originOptions: OriginSymbol[] = showOriginSelect ? origins : ['USDS'];
  const originToken = showOriginSelect ? ORIGIN_TOKENS[originSymbol] : TOKENS.usds;
  const originDecimals = getTokenDecimals(originToken, chainId);

  const amount = parseAmount(value, originDecimals);
  const { data: walletBalance } = useTokenBalance({
    address,
    chainId,
    token: originToken.address[chainId]
  });
  const walletBalanceValue = walletBalance?.value ?? 0n;
  // sUSDS token balance — the whole of it is swapped out on a max L2 withdraw.
  const { data: susdsBalance } = useTokenBalance({
    address,
    chainId,
    token: TOKENS.susds.address[chainId]
  });
  const position = savingsData?.userSavingsBalance ?? 0n;

  // L2 PSM bounds (no-ops on mainnet / where the flow doesn't use them):
  //  - minAmountOut: chi-projected sUSDS-out floor for an L2 supply (swapExactIn)
  //  - convertedBalance: the whole sUSDS balance valued in the destination token →
  //    the L2 withdraw source balance + the max-withdraw floor (swapExactIn)
  //  - maxAmountInForWithdraw: the sUSDS-in ceiling to take exactly `amount` out
  //    (specific L2 withdraw, swapExactOut)
  const minAmountOut = useSavingsSupplyMinAmountOut({ amount, originToken });
  const convertedBalance = usePreviewSwapExactIn(susdsBalance?.value ?? 0n, TOKENS.susds, originToken);
  const { value: maxAmountInForWithdraw } = usePreviewSwapExactOut(amount, TOKENS.susds, originToken);

  // Supply is capped by the wallet balance of the origin token; withdraw by the
  // position (mainnet: USDS savings balance; L2: sUSDS converted to the destination
  // token).
  const available = isSupply ? walletBalanceValue : isL2 ? convertedBalance.value : position;
  const isZero = amount === 0n;
  // A max withdraw bypasses the amount check — the redeem is driven by the flag, not
  // the displayed (rounded) value.
  const insufficient = isConnected && !max && amount > available;

  const { execute, steps, prepared } = useSavingsLaunch({
    flow,
    originToken,
    amount,
    max: !isSupply && max,
    referralCode: REFERRAL_CODE,
    minAmountOut,
    sUsdsBalance: susdsBalance?.value,
    minAmountOutForWithdrawAll: convertedBalance.value,
    maxAmountInForWithdraw
  });

  const disabled = !isConnected || !prepared || (!max && (isZero || insufficient));

  // The modal's confirm calls this. `execute` is rebuilt every render (its calls
  // array is fresh each time), so pushing it directly would loop the sync below;
  // instead a stable handler reads the latest `execute` from a ref kept current in
  // an effect — so `onConfirm` need never be re-pushed.
  const executeRef = useRef(execute);
  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);
  const onConfirm = useCallback(() => executeRef.current(), []);

  // Compact summary for the wallet/status screen (Figma "Confirm in the wallet").
  // Memoised so the sync effect below only fires when the amount/token/flow change
  // — a fresh element every render would loop the merge.
  const transactionScreenContent = useMemo(() => {
    const display = value ? formatNumber(parseFloat(value), { maxDecimals: 2 }) : '0';
    return (
      <SavingsAmountSummary
        label={isSupply ? t`Supply amount` : t`Withdrawal amount`}
        amount={display}
        symbol={originToken.symbol}
        usd={value ? display : undefined}
        dataTestId="savings-confirm-summary"
      />
    );
  }, [isSupply, value, originToken.symbol]);

  // Amount-aware titles for the minimized toast (Figma "10,000.00 USDS supplied!").
  // Memoised on the amount/token/flow so the sync effect below stays bounded.
  const toastTitles = useMemo(() => {
    const display = value ? formatNumber(parseFloat(value), { maxDecimals: 2 }) : '0';
    const amount = `${display} ${originToken.symbol}`;
    return isSupply
      ? { loading: t`Supplying ${amount}`, success: t`${amount} supplied!`, error: t`Supply failed` }
      : { loading: t`Withdrawing ${amount}`, success: t`${amount} withdrawn!`, error: t`Withdrawal failed` };
  }, [isSupply, value, originToken.symbol]);

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
      toast: toastTitles
    });
  }, [sessionId, disabled, steps, onConfirm, transactionScreenContent, toastTitles, updateModalContent]);

  const onInput = (raw: string) => {
    setMax(false);
    setValue(raw.replace(/[^0-9.]/g, ''));
  };
  const setMaxAmount = () => {
    if (!isSupply) setMax(true);
    setValue(formatUnits(available, originDecimals));
  };
  // Switching the origin token resets the amount + Max (the previous amount was
  // denominated in the old token's balance/decimals).
  const switchOrigin = (next: OriginSymbol) => {
    setOriginSymbol(next);
    setMax(false);
    setValue('');
  };

  const networkName = chains.find(c => c.id === chainId)?.name ?? 'Ethereum';
  // Canonical Sky Savings Rate — same source as the page headline + Details grid
  // (skySavingsRatecRate), NOT useSavingsData().savingsRate (the DSR).
  const savingsRate = overall?.skySavingsRatecRate
    ? formatDecimalPercentage(parseFloat(overall.skySavingsRatecRate))
    : NO_VALUE;
  // The position is always USDS-denominated (18-dec — on L2 `userSavingsBalance` is
  // the sUSDS balance pre-converted to USDS). Express the entered amount as a USDS
  // wad for the before→after delta: USDS/DAI are already 18-dec; an L2 USDC amount
  // (6-dec) is widened 1:1 (the PSM swaps ≈1:1 — exact figures are stubbed per the
  // PRD Out of Scope). Mainnet is unchanged (amount === amountWad).
  const amountWad = originDecimals === 18 ? amount : amount * 10n ** BigInt(18 - originDecimals);
  const rows = isSupply
    ? buildSupplyModalRows({
        savingsRate,
        supplyBefore: formatUsds(position),
        supplyAfter: formatUsds(position + amountWad),
        // L2 PSM supply: surface the sUSDS slippage floor once an amount is entered.
        minReceived:
          isL2 && !isZero ? `${formatBigInt(minAmountOut, { unit: 18, maxDecimals: 2 })} sUSDS` : undefined,
        // 1Y est. earnings has no projection source yet (PRD Out of Scope) — stubbed.
        earningsBefore: NO_VALUE,
        earningsAfter: NO_VALUE,
        network: networkName,
        networkFee: NO_VALUE
      })
    : buildWithdrawModalRows({
        // Rate is unchanged by a withdrawal, but Figma 527:10945 draws it as a delta.
        savingsRateBefore: savingsRate,
        savingsRateAfter: savingsRate,
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

// Parse the raw input to a bigint at the origin token's decimals; partial/invalid → 0.
function parseAmount(raw: string, decimals: number): bigint {
  if (!raw) return 0n;
  try {
    return parseUnits(raw, decimals);
  } catch {
    return 0n;
  }
}
