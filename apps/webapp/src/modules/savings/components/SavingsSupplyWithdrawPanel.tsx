import { useState } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  TOKENS,
  useTokenBalance,
  useSavingsData,
  useOverallSkyData,
  useReadSavingsUsds,
  getTokenDecimals,
  usePreviewSwapExactIn,
  usePreviewSwapExactOut
} from '@/hooks';
import { formatBigInt, formatNumber, formatDecimalPercentage, isL2ChainId } from '@/utils';
import { REFERRAL_CODE } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { useSavingsLaunch, type SavingsLaunchFlow } from '../hooks/useSavingsLaunch';
import { useSavingsSupplyMinAmountOut } from '../hooks/useSavingsSupplyMinAmountOut';
import {
  ORIGIN_TOKENS,
  MAINNET_SUPPLY_ORIGINS,
  L2_SUPPLY_ORIGINS,
  L2_WITHDRAW_ORIGINS,
  SavingsOriginSelect,
  type OriginSymbol
} from './SavingsOriginSelect';
import { SavingsSupplyReview } from './SavingsSupplyReview';
import { SavingsAmountSummary } from './SavingsAmountSummary';

const NO_VALUE = '–';

// Parse the raw input to a bigint at the origin token's decimals (USDC is 6 on
// L2); partial/invalid input → 0.
function parseAmount(value: string, decimals: number): bigint {
  if (!value) return 0n;
  try {
    return parseUnits(value, decimals);
  } catch {
    return 0n;
  }
}

/**
 * Inline supply/withdraw input for the redesigned Savings detail page (D3).
 * Replaces "Supply/Withdraw opens a modal hosting the legacy SavingsWidget" —
 * amount entry and the supply/withdraw choice happen inline, and confirming hands
 * off to the shared review modal via `useSavingsLaunch().launch()`.
 *
 * Mainnet: supply draws from the wallet balance of the selected origin token
 * (USDS or DAI — DAI upgrades to USDS then deposits), withdraw from the savings
 * position. A withdraw "Max" flags the engine to redeem the whole position via
 * `maxWithdraw(owner)` (no dust), rather than passing a stale displayed balance.
 *
 * L2: supply/withdraw swap through the PSM. Supply takes USDS/USDC and surfaces the
 * sUSDS slippage floor; withdraw swaps sUSDS back to the chosen destination token —
 * a "Max" swaps the whole sUSDS balance out (swapExactIn), otherwise a specific
 * amount caps the sUSDS in (swapExactOut). The PSM min-out / max-in bounds are
 * computed here and handed to the orchestrator.
 */
export function SavingsSupplyWithdrawPanel({
  onSuccess,
  flow: flowProp,
  projection = false
}: {
  onSuccess?: () => void;
  /**
   * Controlled flow. When provided, the in-panel Supply/Withdraw tab toggle is
   * hidden and the body renders single-flow (the redesigned no-position "Supply"
   * card and, from slice 02, the editable modal). Omit it for the interim
   * has-position card, which keeps its own tab state.
   */
  flow?: SavingsLaunchFlow;
  /**
   * Render the inline "Supply" card projection rows (`You'll receive`,
   * `1Y projected earnings`). Mainnet supply only — L2 surfaces its own min-out
   * row. `1Y projected earnings` is stubbed pending a projection source.
   */
  projection?: boolean;
}) {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const { data: savingsData } = useSavingsData();
  const { data: overall } = useOverallSkyData();
  // Canonical Sky Savings Rate APY — the same source as the page headline + the
  // Details grid (skySavingsRatecRate), NOT useSavingsData().savingsRate (the DSR,
  // a different number).
  const apyDisplay = overall?.skySavingsRatecRate
    ? formatDecimalPercentage(parseFloat(overall.skySavingsRatecRate))
    : NO_VALUE;

  const isL2 = isL2ChainId(chainId);
  const [flowState, setFlowState] = useState<SavingsLaunchFlow>('supply');
  const controlled = flowProp !== undefined;
  const flow = flowProp ?? flowState;
  const [originSymbol, setOriginSymbol] = useState<OriginSymbol>('USDS');
  const [value, setValue] = useState('');
  const [max, setMax] = useState(false);

  const isSupply = flow === 'supply';
  // Supply always offers an origin choice (USDS/DAI mainnet, USDS/USDC L2).
  // Withdraw offers a destination choice only on L2 (USDS/USDC); mainnet withdraw
  // is USDS-only.
  const showOriginSelect = isSupply || isL2;
  const origins = isSupply ? (isL2 ? L2_SUPPLY_ORIGINS : MAINNET_SUPPLY_ORIGINS) : L2_WITHDRAW_ORIGINS;
  // The token-selector options: the flow's origins when a choice exists, else a
  // single static USDS chip (mainnet withdraw).
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

  // L2 PSM supply slippage floor (chi-projected sUSDS out). The orchestrator hands
  // this straight to the engine; it's ignored on the mainnet / withdraw paths.
  const minAmountOut = useSavingsSupplyMinAmountOut({ amount, originToken });

  // Inline "Supply" card preview: mainnet origin (USDS/DAI, both wad) → sUSDS
  // shares via the vault's ERC-4626 convertToShares. Read-only; the actual
  // supply still routes through useSavingsLaunch. L2 has its own min-out row.
  const { data: previewSharesData } = useReadSavingsUsds({
    functionName: 'convertToShares',
    args: [amount],
    // No chainId — the read uses the connected chain and is gated to mainnet
    // supply below, where the sUSDS vault address resolves.
    query: { enabled: projection && flow === 'supply' && !isL2 && amount > 0n }
  });
  const previewShares = typeof previewSharesData === 'bigint' ? previewSharesData : undefined;

  // L2 PSM withdraw previews (mirror the legacy L2 widget; no-ops on mainnet):
  //  - convert the whole sUSDS balance to the destination token → max-withdraw
  //    floor + the withdrawable balance shown to the user
  //  - the sUSDS in needed to take exactly `amount` destination token out → the
  //    specific-withdraw ceiling
  const convertedBalance = usePreviewSwapExactIn(susdsBalance?.value ?? 0n, TOKENS.susds, originToken);
  const { value: maxAmountInForWithdraw } = usePreviewSwapExactOut(amount, TOKENS.susds, originToken);

  // Supply draws from the origin token's wallet balance; withdraw from the
  // position (mainnet: the USDS-denominated savings balance; L2: the sUSDS balance
  // converted to the destination token).
  const sourceBalance = isSupply
    ? (walletBalance?.value ?? 0n)
    : isL2
      ? convertedBalance.value
      : (savingsData?.userSavingsBalance ?? 0n);
  const isZero = amount === 0n;
  const insufficient = isConnected && !max && amount > sourceBalance;

  const { launch, prepared } = useSavingsLaunch({
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
    maxAmountInForWithdraw,
    transactionContent: (
      <SavingsSupplyReview
        amount={value ? formatNumber(parseFloat(value), { maxDecimals: 2 }) : '0'}
        symbol={originToken.symbol}
        // USD value ≈ the token amount for the $1-pegged origins (USDS/DAI/USDC).
        usd={value ? formatNumber(parseFloat(value), { maxDecimals: 2 }) : undefined}
        youReceive={
          previewShares !== undefined
            ? `${formatBigInt(previewShares, { unit: 18, maxDecimals: 2 })} sUSDS`
            : `${NO_VALUE} sUSDS`
        }
        apy={apyDisplay}
      />
    ),
    // Compact summary shown on the wallet/status screen in place of the full
    // breakdown (Figma "Confirm in the wallet").
    transactionScreenContent: (
      <SavingsAmountSummary
        label={isSupply ? t`Supply amount` : t`Withdrawal amount`}
        amount={value ? formatNumber(parseFloat(value), { maxDecimals: 2 }) : '0'}
        symbol={originToken.symbol}
        usd={value ? formatNumber(parseFloat(value), { maxDecimals: 2 }) : undefined}
        dataTestId="savings-confirm-summary"
      />
    ),
    onSuccess: () => {
      setValue('');
      setMax(false);
      onSuccess?.();
    }
  });

  const disabled = !isConnected || !prepared || (!max && (isZero || insufficient));

  const switchFlow = (next: SavingsLaunchFlow) => {
    setFlowState(next);
    // Withdraw is USDS-only; reset the origin so re-entering supply starts on USDS.
    setOriginSymbol('USDS');
    setValue('');
    setMax(false);
  };

  const switchOrigin = (next: OriginSymbol) => {
    setOriginSymbol(next);
    setValue('');
    setMax(false);
  };

  const onInput = (raw: string) => {
    setValue(raw.replace(/[^0-9.]/g, ''));
    // Typing overrides a previous max selection.
    setMax(false);
  };

  const setMaxAmount = () => {
    setValue(formatUnits(sourceBalance, originDecimals));
    // Flag a max only for withdraw; supply just deposits exactly the input.
    setMax(!isSupply);
  };

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg py-2 text-sm font-medium ${active ? 'bg-background text-text' : 'text-textSecondary'}`;

  return (
    <div className="flex flex-col gap-3" data-testid="savings-supply-withdraw-panel">
      {/* Supply/Withdraw tabs only in the uncontrolled (interim has-position)
          mount. A controlled `flow` renders single-flow with no tab toggle. */}
      {!controlled && (
        <div className="bg-panel flex gap-1 rounded-xl p-1">
          <button
            type="button"
            onClick={() => switchFlow('supply')}
            aria-pressed={isSupply}
            data-testid="savings-tab-supply"
            className={tabClass(isSupply)}
          >
            <Trans>Supply</Trans>
          </button>
          <button
            type="button"
            onClick={() => switchFlow('withdraw')}
            aria-pressed={!isSupply}
            data-testid="savings-tab-withdraw"
            className={tabClass(!isSupply)}
          >
            <Trans>Withdraw</Trans>
          </button>
        </div>
      )}

      {/* Amount label + balance·MAX above the input (Figma 527:7404): "Amount" on
          the left, the wallet balance with a clickable MAX on the right. */}
      <div className="flex items-center justify-between">
        <Text className="text-textSecondary text-sm">
          <Trans>Amount</Trans>
        </Text>
        <button
          type="button"
          onClick={setMaxAmount}
          disabled={!isConnected}
          className="text-textSecondary text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="savings-amount-max"
        >
          {isConnected
            ? formatNumber(parseFloat(formatUnits(sourceBalance, originDecimals)), { maxDecimals: 2 })
            : NO_VALUE}{' '}
          <span className="text-textEmphasis">
            <Trans>MAX</Trans>
          </span>
        </button>
      </div>

      {/* Origin/destination token selector (Figma `USDS ▾`), inline in the amount
          row. Supply: USDS deposits/swaps directly; DAI upgrades to USDS first
          (mainnet); USDC swaps through the PSM (L2). Withdraw (L2 only): the
          destination token the sUSDS is swapped out to. A single option renders a
          static chip (mainnet withdraw). Switching resets the amount + Max. */}
      <div className="bg-panel flex items-center justify-between gap-2 rounded-xl p-3">
        <input
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={e => onInput(e.target.value)}
          disabled={!isConnected}
          aria-label={isSupply ? t`Supply amount` : t`Withdraw amount`}
          data-testid="savings-amount-input"
          className="text-text placeholder:text-textSecondary w-full min-w-0 bg-transparent text-2xl font-medium outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <SavingsOriginSelect
          value={originSymbol}
          options={originOptions}
          onChange={switchOrigin}
          disabled={!isConnected}
        />
      </div>

      {/* L2 PSM supply surfaces the slippage floor (min sUSDS out). */}
      {isL2 && isSupply && !isZero && (
        <div className="flex items-center justify-between" data-testid="savings-min-amount-out">
          <Text className="text-textSecondary text-sm">
            <Trans>Receive at least</Trans>
          </Text>
          <Text className="text-text text-sm font-medium">
            {formatBigInt(minAmountOut, { unit: 18, maxDecimals: 2 })} sUSDS
          </Text>
        </div>
      )}

      {/* Inline "Supply" card projection rows (Figma 527:7404). Mainnet shows the
          sUSDS you'll receive; 1Y projected earnings is stubbed (no projection
          source yet). On L2 the "Receive at least" row above covers the preview. */}
      {projection && isSupply && !isL2 && (
        <div className="flex items-center justify-between" data-testid="savings-supply-receive">
          <Text className="text-textSecondary text-sm">
            <Trans>You&apos;ll receive</Trans>
          </Text>
          <Text className="text-text text-sm font-medium">
            {previewShares !== undefined
              ? `${formatBigInt(previewShares, { unit: 18, maxDecimals: 2 })} sUSDS`
              : `${NO_VALUE} sUSDS`}
          </Text>
        </div>
      )}
      {projection && isSupply && (
        <div className="flex items-center justify-between" data-testid="savings-supply-projected-earnings">
          <Text className="text-textSecondary text-sm">
            <Trans>1Y projected earnings</Trans>
          </Text>
          <Text className="text-text text-sm font-medium">{NO_VALUE}</Text>
        </div>
      )}

      {insufficient && (
        <Text className="text-error text-sm" data-testid="savings-amount-error">
          {isSupply ? <Trans>Insufficient balance</Trans> : <Trans>Amount exceeds your position</Trans>}
        </Text>
      )}

      <Button
        variant="primary"
        className="w-full"
        disabled={disabled}
        onClick={launch}
        data-testid={isSupply ? 'position-supply' : 'position-withdraw'}
      >
        {isSupply ? <Trans>Supply</Trans> : <Trans>Withdraw</Trans>}
      </Button>
    </div>
  );
}
