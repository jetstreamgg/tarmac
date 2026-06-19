import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { t } from '@lingui/core/macro';
import {
  getTokenDecimals,
  TOKENS,
  useOverallSkyData,
  usePreviewSwapExactIn,
  usePreviewSwapExactOut,
  useReadSavingsUsds,
  useSavingsData,
  useTokenBalance,
  type Token
} from '@/hooks';
import { formatDecimalPercentage, formatNumber, isL2ChainId } from '@/utils';
import { REFERRAL_CODE } from '@/lib/constants';
import { SavingsAmountSummary } from '../components/SavingsAmountSummary';
import {
  ORIGIN_TOKENS,
  MAINNET_SUPPLY_ORIGINS,
  L2_SUPPLY_ORIGINS,
  L2_WITHDRAW_ORIGINS,
  type OriginSymbol
} from '../components/SavingsOriginSelect';
import { useSavingsSupplyMinAmountOut } from './useSavingsSupplyMinAmountOut';
import { type SavingsLaunchFlow, type UseSavingsLaunchParams } from './useSavingsLaunch';

const NO_VALUE = '–';

/** Seeds the form's initial amount/token (e.g. a Portfolio quick-deposit shortcut). */
export type SavingsModalPreset = {
  /** Raw amount string to seed the input (e.g. '100'). */
  amount?: string;
  /** Origin/destination token to preselect; must be valid for the flow/chain. Defaults to USDS. */
  token?: OriginSymbol;
};

/** Minimized-toast titles, amount-aware (e.g. "10,000.00 USDS supplied!"). */
export type SavingsToastTitles = { loading: string; success: string; error: string };

/** The subset of `useSavingsLaunch` params the form derives — spread into the engine by each surface. */
export type SavingsEngineParams = Pick<
  UseSavingsLaunchParams,
  | 'flow'
  | 'originToken'
  | 'amount'
  | 'max'
  | 'referralCode'
  | 'minAmountOut'
  | 'sUsdsBalance'
  | 'minAmountOutForWithdrawAll'
  | 'maxAmountInForWithdraw'
>;

export interface SavingsTransactionForm {
  // Connection / network / flow
  isConnected: boolean;
  isL2: boolean;
  isSupply: boolean;

  // Token selection
  originSymbol: OriginSymbol;
  originOptions: OriginSymbol[];
  originToken: Token;
  originDecimals: number;

  // Amount state + gating
  value: string;
  amount: bigint;
  max: boolean;
  /** Source balance for the active flow (wallet for supply; position / converted sUSDS for withdraw). */
  available: bigint;
  isZero: boolean;
  insufficient: boolean;
  /** True when the amount/connection gate is satisfied; combine with the engine's `prepared` for the submit gate. */
  amountReady: boolean;

  // Display
  /** USDS-denominated savings balance (position). */
  position: bigint;
  /** Canonical Sky Savings Rate APY, formatted (e.g. "6.50%"). */
  apyDisplay: string;
  /** Mainnet supply preview: sUSDS shares for the entered amount (when `enablePreview`). */
  previewShares?: bigint;

  // Engine + shared transaction content
  engineParams: SavingsEngineParams;
  /** Compact wallet/status-screen summary — identical across surfaces, so the form owns it. */
  transactionScreenContent: ReactNode;
  /** Amount-aware minimized-toast titles for the active flow. */
  toast: SavingsToastTitles;

  // Handlers
  onInput: (raw: string) => void;
  setMaxAmount: () => void;
  switchOrigin: (next: OriginSymbol) => void;
  /** Clear the amount + Max (keeps the selected token) — for a post-success reset. */
  clearAmount: () => void;
  /** Reset the amount, Max, and token back to USDS — for a flow (Supply/Withdraw) switch. */
  resetToUsds: () => void;
}

// Parse the raw input to a bigint at the origin token's decimals (USDC is 6 on
// L2); partial/invalid input → 0.
function parseAmount(raw: string, decimals: number): bigint {
  if (!raw) return 0n;
  try {
    return parseUnits(raw, decimals);
  } catch {
    return 0n;
  }
}

/**
 * The shared supply/withdraw form model for Sky Savings — the single source of
 * truth behind both savings supply surfaces: the inline no-position card
 * (`SavingsSupplyWithdrawPanel`) and the editable has-position modal body
 * (`SavingsModalForm`). It owns amount/Max/token state, resolves the origin token
 * and its options for the flow + network, runs the wallet/sUSDS balance and L2 PSM
 * preview reads, derives the spend gate, and maps all of it to the `useSavingsLaunch`
 * engine params. Surfaces stay thin: they render their own chrome and call
 * `useSavingsLaunch({ ...form.engineParams, ...surface content })`.
 *
 * Token choice (Figma `USDS ▾`):
 *  - mainnet supply   → USDS / DAI (DAI routes to upgrade-and-supply, calldata unchanged)
 *  - mainnet withdraw → USDS-only (static chip)
 *  - L2 supply        → USDS / USDC (USDC swaps through the PSM)
 *  - L2 withdraw      → USDS / USDC destination choice (sUSDS swaps out to the picked token)
 *
 * Supply spends the wallet balance of the origin token; withdraw spends the position
 * (mainnet: the USDS savings balance; L2: the sUSDS balance converted to the chosen
 * destination token). A withdraw Max sets the `max` flag so the engine redeems the
 * whole position with no dust; the UI never computes the redeem amount. The L2 PSM
 * bounds (`minAmountOut` / `sUsdsBalance` / `minAmountOutForWithdrawAll` /
 * `maxAmountInForWithdraw`) are computed here and handed straight to the orchestrator;
 * they are no-ops on mainnet.
 */
export function useSavingsTransactionForm({
  flow,
  preset,
  enablePreview = false
}: {
  flow: SavingsLaunchFlow;
  /** Seeds the initial amount/token (e.g. a Portfolio quick-deposit). Read once on mount. */
  preset?: SavingsModalPreset;
  /** Run the mainnet-supply sUSDS preview read (the inline card's "You'll receive" projection). */
  enablePreview?: boolean;
}): SavingsTransactionForm {
  const isSupply = flow === 'supply';
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const { data: savingsData } = useSavingsData();
  const { data: overall } = useOverallSkyData();
  const isL2 = isL2ChainId(chainId);

  // Seeded from `preset` on mount.
  const [value, setValue] = useState(preset?.amount ?? '');
  // Withdraw-only: set by Max so the engine redeems the whole position (no dust).
  // Cleared the moment the user edits the amount.
  const [max, setMax] = useState(false);
  const [originSymbol, setOriginSymbol] = useState<OriginSymbol>(preset?.token ?? 'USDS');

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

  // Mainnet supply preview: origin (USDS/DAI, both wad) → sUSDS shares via the vault's
  // ERC-4626 convertToShares. Read-only; the supply still routes through the engine.
  // Gated off in the modal (no consumer there) and on L2 (its min-out row covers it).
  const { data: previewSharesData } = useReadSavingsUsds({
    functionName: 'convertToShares',
    args: [amount],
    query: { enabled: enablePreview && isSupply && !isL2 && amount > 0n }
  });
  const previewShares = typeof previewSharesData === 'bigint' ? previewSharesData : undefined;

  // Supply is capped by the wallet balance of the origin token; withdraw by the
  // position (mainnet: the USDS savings balance; L2: sUSDS converted to the
  // destination token).
  const available = isSupply
    ? (walletBalance?.value ?? 0n)
    : isL2
      ? convertedBalance.value
      : position;
  const isZero = amount === 0n;
  // A max withdraw bypasses the amount check — the redeem is driven by the flag, not
  // the displayed (rounded) value.
  const insufficient = isConnected && !max && amount > available;
  const amountReady = isConnected && !(!max && (isZero || insufficient));

  const engineParams: SavingsEngineParams = {
    flow,
    originToken,
    amount,
    // `max` only applies to withdraw — it routes to maxWithdraw(owner) on mainnet
    // or swapExactIn(whole sUSDS balance) on L2.
    max: !isSupply && max,
    referralCode: REFERRAL_CODE,
    minAmountOut,
    sUsdsBalance: susdsBalance?.value,
    minAmountOutForWithdrawAll: convertedBalance.value,
    maxAmountInForWithdraw
  };

  // Compact summary for the wallet/status screen (Figma "Confirm in the wallet").
  // Identical across surfaces, so the form owns it; memoised on the amount/token/flow
  // so the modal's `updateModalContent` sync stays bounded.
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
  const toast = useMemo<SavingsToastTitles>(() => {
    const display = value ? formatNumber(parseFloat(value), { maxDecimals: 2 }) : '0';
    const label = `${display} ${originToken.symbol}`;
    return isSupply
      ? { loading: t`Supplying ${label}`, success: t`${label} supplied!`, error: t`Supply failed` }
      : { loading: t`Withdrawing ${label}`, success: t`${label} withdrawn!`, error: t`Withdrawal failed` };
  }, [isSupply, value, originToken.symbol]);

  const apyDisplay = overall?.skySavingsRatecRate
    ? formatDecimalPercentage(parseFloat(overall.skySavingsRatecRate))
    : NO_VALUE;

  const onInput = useCallback((raw: string) => {
    // Typing overrides a previous Max selection.
    setMax(false);
    setValue(raw.replace(/[^0-9.]/g, ''));
  }, []);

  const setMaxAmount = useCallback(() => {
    // Flag a max only for withdraw; supply just deposits exactly the input.
    setMax(!isSupply);
    setValue(formatUnits(available, originDecimals));
  }, [isSupply, available, originDecimals]);

  // Switching the origin token resets the amount + Max (the previous amount was
  // denominated in the old token's balance/decimals).
  const switchOrigin = useCallback((next: OriginSymbol) => {
    setOriginSymbol(next);
    setMax(false);
    setValue('');
  }, []);

  const clearAmount = useCallback(() => {
    setMax(false);
    setValue('');
  }, []);

  const resetToUsds = useCallback(() => {
    setOriginSymbol('USDS');
    setMax(false);
    setValue('');
  }, []);

  return {
    isConnected,
    isL2,
    isSupply,
    originSymbol,
    originOptions,
    originToken,
    originDecimals,
    value,
    amount,
    max,
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
    setMaxAmount,
    switchOrigin,
    clearAmount,
    resetToUsds
  };
}
