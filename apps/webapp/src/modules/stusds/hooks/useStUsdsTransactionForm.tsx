import { useMemo, useState, type ReactNode } from 'react';
import { useConnection } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { t } from '@lingui/core/macro';
import {
  StUsdsDirection,
  StUsdsProviderType,
  useDebounce,
  useStUsdsCapacityData,
  useStUsdsData,
  useStUsdsProviderSelection,
  useStUsdsWithdrawBalances,
  type StUsdsProviderSelectionResult
} from '@/hooks';
import { calculateApyFromStr, formatNumber } from '@/utils';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { MAX_PRICE_IMPACT_BPS_WITHOUT_WARNING } from '../lib/providerNotice';
import { StUsdsAmountSummary } from '../components/StUsdsAmountSummary';
import type { StUsdsEngineParams, StUsdsLaunchFlow } from './useStUsdsLaunch';

/** Seeds the form's initial amount (e.g. a Portfolio quick-deposit shortcut). */
export type StUsdsModalPreset = { amount?: string };

/** Minimized-toast titles, amount-aware (e.g. "10,000.00 USDS supplied!"). */
export type StUsdsToastTitles = { loading: string; success: string; error: string };

// USDS and stUSDS are both 18-decimal on every deployment.
const DECIMALS = 18;

// Reference amount for rate comparison when the input is empty — pre-selects
// the provider before user input to prevent UI flicker (widget behavior).
const REFERENCE_AMOUNT = parseUnits('1', DECIMALS);

const parseAmount = (value: string): bigint => {
  try {
    return value ? parseUnits(value, DECIMALS) : 0n;
  } catch {
    return 0n;
  }
};

export interface StUsdsTransactionForm {
  isConnected: boolean;
  isSupply: boolean;
  decimals: number;
  value: string;
  /** Debounce-settled USDS amount driving quotes + engine params. */
  amount: bigint;
  /** Spendable balance for the flow: USDS wallet balance / effective max withdraw. */
  available: bigint;
  isZero: boolean;
  insufficient: boolean;
  /** No route can take this amount (module cap / liquidity / both providers blocked). */
  blocked: boolean;
  /** Input typed but the debounced amount hasn't settled yet. */
  debouncePending: boolean;
  amountReady: boolean;
  /** Current module rate as a decimal fraction (e.g. 0.065), for the APY row. */
  rate: number | undefined;
  /** USDS-denominated position value, for the entry grid's before→after deltas. */
  position: bigint;
  engineParams: StUsdsEngineParams;
  providerSelection: StUsdsProviderSelectionResult;
  /** Price impact of the selected Curve quote (bps). */
  priceImpactBps: number | undefined;
  /** Curve route with ≥2% price impact — confirm requires the explicit checkbox. */
  needsImpactAcknowledgement: boolean;
  impactAccepted: boolean;
  setImpactAccepted: (checked: boolean) => void;
  /** First-time users must acknowledge the expert-module risks before supplying. */
  needsRiskAcknowledgement: boolean;
  riskAccepted: boolean;
  acceptRisk: (checked: boolean) => void;
  toast: StUsdsToastTitles;
  transactionScreenContent: ReactNode;
  onInput: (next: string) => void;
  setMaxAmount: () => void;
  setPercentAmount: (pct: number) => void;
}

/**
 * Shared form model for the stUSDS supply/withdraw modal — the stUSDS analogue
 * of `useSavingsTransactionForm`/`useVaultTransactionForm`, carrying the retired
 * widget's provider-aware derivations: the amount/Max state, native-vs-Curve
 * selection on the debounced amount, capacity/liquidity max limits, the
 * price-impact acknowledgement gate, and the one-time expert-risk
 * acknowledgement (persisted via the legacy `expertRiskDisclaimer*` config keys
 * so prior acknowledgments carry over).
 */
export function useStUsdsTransactionForm({
  flow,
  preset
}: {
  flow: StUsdsLaunchFlow;
  preset?: StUsdsModalPreset;
}): StUsdsTransactionForm {
  const { isConnected } = useConnection();
  const isSupply = flow === 'supply';

  const [value, setValue] = useState(preset?.amount ?? '');
  // Withdraw-only: set by Max so the native engine redeems the whole share
  // balance (no dust) and the Curve quote runs in max mode.
  const [max, setMax] = useState(false);

  const { data: stUsdsData } = useStUsdsData();
  const { data: capacityData } = useStUsdsCapacityData();

  const {
    effectiveBalance: withdrawBalanceLimit,
    curveMaxWithdraw,
    selectedProvider: withdrawSelectedProvider,
    isLoading: withdrawBalancesLoading
  } = useStUsdsWithdrawBalances();

  // Native max withdraw is buffered against liquidity drift; the Curve max is
  // the pool quote for the full share balance.
  const nativeMaxWithdraw = stUsdsData?.userMaxWithdrawBuffered ?? 0n;
  const maxWithdrawAmount =
    withdrawSelectedProvider === StUsdsProviderType.CURVE
      ? (curveMaxWithdraw ?? nativeMaxWithdraw)
      : nativeMaxWithdraw;

  const available = isSupply ? (stUsdsData?.userUsdsBalance ?? 0n) : maxWithdrawAmount;

  // Withdraw Max is flag-driven (savings-form pattern): the engine redeems the
  // whole share balance / swaps the live quote, never the typed number, so the
  // displayed amount derives from the live max instead of a click-time
  // snapshot — the Curve quotes behind `available` refetch every 15s, and a
  // pure derivation keeps tracking them with no state rewrite to freeze,
  // invalidate, or misfire (the retired widget resynced with an effect).
  const displayValue = max && !isSupply ? formatUnits(available, DECIMALS) : value;
  const amount = parseAmount(displayValue);
  const debouncedAmount = useDebounce(amount);
  const debouncePending = debouncedAmount !== amount;

  const providerSelection = useStUsdsProviderSelection({
    amount: debouncedAmount,
    referenceAmount: REFERENCE_AMOUNT,
    direction: isSupply ? StUsdsDirection.SUPPLY : StUsdsDirection.WITHDRAW,
    userStUsdsBalance: stUsdsData?.userStUsdsBalance,
    isMax: max
  });
  const isCurveSelected = providerSelection.selectedProvider === StUsdsProviderType.CURVE;

  // If Curve can absorb the supply there's no protocol limit on the input;
  // otherwise the native module capacity caps it (widget behavior).
  const isCurveAvailableForSupply = providerSelection.curveProvider?.state?.canDeposit ?? false;
  const moduleMaxSupplyAmount = isCurveAvailableForSupply
    ? undefined
    : (providerSelection.nativeProvider?.state?.maxDeposit ?? capacityData?.remainingCapacityBuffered ?? 0n);

  const isZero = amount === 0n;
  // A max withdraw bypasses the amount checks: the derived display can drift or
  // lag the debounce, but the flag — not the number — drives the redemption.
  const insufficient =
    !max &&
    amount > 0n &&
    (isSupply ? amount > available : amount > available || amount > (withdrawBalanceLimit ?? available));

  // Route-level blocks the balance check can't see: both providers blocked, or
  // a supply above the module cap while Curve can't take it either.
  const blocked =
    debouncedAmount > 0n &&
    !providerSelection.isLoading &&
    (providerSelection.allProvidersBlocked ||
      (isSupply && moduleMaxSupplyAmount !== undefined && debouncedAmount > moduleMaxSupplyAmount));

  // Curve price-impact gate (≥2% requires the explicit "proceed anyway" check).
  // The acknowledgement is keyed to the amount it was given for: if the derived
  // max drifts under a checked box, the check lapses and confirm re-gates on
  // the impact the user would actually take.
  const priceImpactBps = providerSelection.selectedQuote?.rateInfo.priceImpactBps;
  const [impactAcceptedAmount, setImpactAcceptedAmount] = useState<bigint | null>(null);
  const impactAccepted = impactAcceptedAmount !== null && impactAcceptedAmount === debouncedAmount;
  const setImpactAccepted = (checked: boolean) => setImpactAcceptedAmount(checked ? debouncedAmount : null);
  const needsImpactAcknowledgement =
    isCurveSelected &&
    priceImpactBps !== undefined &&
    priceImpactBps >= MAX_PRICE_IMPACT_BPS_WITHOUT_WARNING &&
    debouncedAmount > 0n;

  // One-time expert-risk acknowledgement. The need is captured at mount so the
  // checkbox row doesn't vanish mid-session once the config persists; the
  // legacy keys are reused so users who dismissed the old banner skip this.
  const { expertRiskDisclaimerShown, userConfig, updateUserConfig } = useConfigContext();
  const [needsRiskAcknowledgement] = useState(() => isSupply && !expertRiskDisclaimerShown);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const acceptRisk = (checked: boolean) => {
    setRiskAccepted(checked);
    if (checked && !expertRiskDisclaimerShown) {
      updateUserConfig({
        ...userConfig,
        expertRiskDisclaimerShown: true,
        expertRiskDisclaimerDismissed: true
      });
    }
  };

  // Max readiness needs a real max: zero (nothing to withdraw) or a still-loading
  // Curve max quote (whose transient fallback is the smaller native max) hold
  // the confirm rather than gating on the derived number.
  const amountReady =
    isConnected &&
    !blocked &&
    (max ? available > 0n && !withdrawBalancesLoading : !isZero && !insufficient && !debouncePending);

  const rate = stUsdsData ? calculateApyFromStr(stUsdsData.moduleRate) / 100 : undefined;

  const onInput = (next: string) => {
    setMax(false);
    setValue(next);
    // Any amount change invalidates a previous price-impact acknowledgement
    // (widget behavior — the impact is amount-specific).
    setImpactAccepted(false);
  };
  const setMaxAmount = () => {
    setValue(formatUnits(available, DECIMALS));
    // On withdraw, Max redeems the whole share balance; supply just fills the amount.
    setMax(!isSupply);
    setImpactAccepted(false);
  };
  // The 25/50/100% chips — 100% routes through Max so the withdraw keeps the
  // whole-share-balance redemption (no dust) the old Max link wired.
  const setPercentAmount = (pct: number) => {
    if (pct >= 100) return setMaxAmount();
    setMax(false);
    setValue(formatUnits((available * BigInt(pct)) / 100n, DECIMALS));
    setImpactAccepted(false);
  };

  const engineParams: StUsdsEngineParams = {
    flow,
    amount: debouncedAmount,
    max,
    selectedProvider: providerSelection.selectedProvider,
    expectedOutput: providerSelection.selectedQuote?.outputAmount ?? 0n,
    stUsdsAmount: providerSelection.selectedQuote?.stUsdsAmount
  };

  const amountLabel = `${formatNumber(parseFloat(formatUnits(debouncedAmount, DECIMALS)), { maxDecimals: 2 })} USDS`;
  // Memoized so the modal-content sync effect in StUsdsModalForm has stable deps —
  // an unmemoized object/element here recreates every render and loops
  // updateModalContent → setActiveConfig (matches the savings/vault forms).
  const toast = useMemo<StUsdsToastTitles>(
    () =>
      isSupply
        ? {
            loading: t`Supplying ${amountLabel}`,
            success: t`${amountLabel} supplied!`,
            error: t`Supply failed`
          }
        : {
            loading: t`Withdrawing ${amountLabel}`,
            success: t`${amountLabel} withdrawn!`,
            error: t`Withdrawal failed`
          },
    [isSupply, amountLabel]
  );

  // The from→to hero the review and wallet screens draw: supply is USDS →
  // quoted stUSDS; a withdraw redeems/swaps stUSDS (the quote's input) → USDS.
  // No quote (loading, refetching, all providers blocked) stays undefined so the
  // hero shows the placeholder instead of a fabricated 0.00 stUSDS.
  // Scalar deps keep the memo stable (matches the savings/vault forms).
  const quotedStUsds = isSupply
    ? providerSelection.selectedQuote?.outputAmount
    : providerSelection.selectedQuote?.inputAmount;
  const transactionScreenContent = useMemo(
    () => <StUsdsAmountSummary flow={flow} amount={debouncedAmount} stUsdsAmount={quotedStUsds} />,
    [flow, debouncedAmount, quotedStUsds]
  );

  return {
    isConnected,
    isSupply,
    decimals: DECIMALS,
    value: displayValue,
    amount: debouncedAmount,
    available,
    isZero,
    insufficient,
    blocked,
    debouncePending,
    amountReady,
    rate,
    position: stUsdsData?.userSuppliedUsds ?? 0n,
    engineParams,
    providerSelection,
    priceImpactBps,
    needsImpactAcknowledgement,
    impactAccepted,
    setImpactAccepted,
    needsRiskAcknowledgement,
    riskAccepted,
    acceptRisk,
    toast,
    transactionScreenContent,
    onInput,
    setMaxAmount,
    setPercentAmount
  };
}
