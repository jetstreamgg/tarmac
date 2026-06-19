import { useState } from 'react';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatBigInt, formatNumber } from '@/utils';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { useSavingsLaunch, type SavingsLaunchFlow } from '../hooks/useSavingsLaunch';
import { useSavingsTransactionForm } from '../hooks/useSavingsTransactionForm';
import { SavingsOriginSelect } from './SavingsOriginSelect';
import { SavingsSupplyReview } from './SavingsSupplyReview';

const NO_VALUE = '–';

/**
 * Inline supply/withdraw input for the redesigned Savings detail page (D3).
 * Replaces "Supply/Withdraw opens a modal hosting the legacy SavingsWidget" —
 * amount entry and the supply/withdraw choice happen inline, and confirming hands
 * off to the shared review modal via `useSavingsLaunch().launch()`.
 *
 * The form model (amount/Max/token state, the balance + L2 PSM reads, and the spend
 * gate) lives in `useSavingsTransactionForm`, shared with the editable modal body
 * (`SavingsModalForm`); this component is the inline *presentation* over it: the
 * optional Supply/Withdraw tabs, the amount input, the supply projection rows, and a
 * full-width CTA that opens the review modal. Calldata is unchanged across surfaces.
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
   * card and the editable modal). Omit it for the interim has-position card, which
   * keeps its own tab state.
   */
  flow?: SavingsLaunchFlow;
  /**
   * Render the inline "Supply" card projection rows (`You'll receive`,
   * `1Y projected earnings`). Mainnet supply only — L2 surfaces its own min-out
   * row. `1Y projected earnings` is stubbed pending a projection source.
   */
  projection?: boolean;
}) {
  const [flowState, setFlowState] = useState<SavingsLaunchFlow>('supply');
  const controlled = flowProp !== undefined;
  const flow = flowProp ?? flowState;

  const form = useSavingsTransactionForm({ flow, enablePreview: projection });
  const {
    isConnected,
    isSupply,
    isL2,
    originSymbol,
    originOptions,
    originToken,
    originDecimals,
    value,
    available,
    isZero,
    insufficient,
    amountReady,
    apyDisplay,
    previewShares,
    engineParams,
    transactionScreenContent,
    onInput,
    setMaxAmount,
    switchOrigin,
    clearAmount,
    resetToUsds
  } = form;

  const { launch, prepared } = useSavingsLaunch({
    ...engineParams,
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
    transactionScreenContent,
    onSuccess: () => {
      clearAmount();
      onSuccess?.();
    }
  });

  const disabled = !amountReady || !prepared;

  const switchFlow = (next: SavingsLaunchFlow) => {
    setFlowState(next);
    // Withdraw is USDS-only; reset the origin so re-entering supply starts on USDS.
    resetToUsds();
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
            ? formatNumber(parseFloat(formatUnits(available, originDecimals)), { maxDecimals: 2 })
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
            {formatBigInt(engineParams.minAmountOut ?? 0n, { unit: 18, maxDecimals: 2 })} sUSDS
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
