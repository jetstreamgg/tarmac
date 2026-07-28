import { type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { NetworkFeeLabel } from '@/modules/ui/components/NetworkFeeLabel';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import {
  NetworkFeeValue,
  useBundlePromoVisible,
  useCanBundle
} from '@/modules/ui/components/NetworkFeeValue';
import { type Token } from '@/hooks';
import { formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { useNetworkFee } from '@/hooks';
import { useRewardsLaunch, type RewardsLaunchFlow } from '../hooks/useRewardsLaunch';
import { useRewardsTransactionForm, type RewardsModalPreset } from '../hooks/useRewardsTransactionForm';

export type { RewardsModalPreset } from '../hooks/useRewardsTransactionForm';

const NO_VALUE = '–';

type ModalRow = { label: ReactNode; value: ReactNode };

function Row({ label, value }: ModalRow) {
  return (
    <div className="flex items-center justify-between">
      <Text className="text-textSecondary text-sm">{label}</Text>
      <Text className="text-text text-sm font-medium">{value}</Text>
    </div>
  );
}

/**
 * Editable body for the rewards "Supply to / Withdraw from {farm}" modals,
 * mounted as the shared modal's entry screen — the rewards analogue of
 * `VaultModalForm`. One body, two flows. The form model
 * (`useRewardsTransactionForm`) is shared; this is the presentation: the amount
 * input + Max + the folded review rows (Rate / Rewards in / Est. earnings /
 * Product / Withdrawal / Network fee).
 *
 * Like the savings/vault modals, the review rows are folded into this editable
 * entry (the TransactionContext machinery supports one first screen); the wallet
 * screen shows the amount summary + the stepped Approve/Supply indicator.
 *
 * Confirm fires the engine `execute` from `useRewardsLaunch` directly (the modal
 * is already open); gating/steps/wallet-content/toast are kept live via
 * `updateModalContent` so the body never remounts (input stays focused).
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
  /** Product title shown in the review "Product" row (e.g. "SPK Rewards"). */
  displayName: string;
  /** Reward-token symbol for the "Rewards in" row; omit for point farms. */
  rewardTokenSymbol?: string;
  /** Reward rate as a decimal fraction (e.g. 0.045) for the Rate + projected rows. */
  rate?: number;
  preset?: RewardsModalPreset;
}) {
  const form = useRewardsTransactionForm({ flow, contractAddress, supplyToken, preset });
  const {
    isConnected,
    isSupply,
    decimals,
    value,
    amount,
    available,
    insufficient,
    amountReady,
    engineParams,
    toast,
    transactionScreenContent,
    onInput,
    setMaxAmount
  } = form;

  const { execute, steps, prepared, calls, isBatch } = useRewardsLaunch(engineParams);
  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const { data: networkFee } = useNetworkFee({ calls, shouldUseBatch: isBatch, enabled: amountReady });

  const canBundle = useCanBundle(calls.length);
  const promoVisible = useBundlePromoVisible(canBundle, networkFee?.batchSaving);
  const disabled = !amountReady || !prepared;

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

  // Derived from the parsed engine `amount` (not the raw input) so the preview
  // matches what's submitted. USD ≈ amount for the $1-pegged supply token (USDS).
  const amountUsd = parseFloat(formatUnits(amount, decimals));
  const rateValue = rate !== undefined ? formatDecimalPercentage(rate) : NO_VALUE;
  const rows: ModalRow[] = isSupply
    ? [
        { label: <Trans>Rate</Trans>, value: rateValue },
        ...(rewardTokenSymbol
          ? [{ label: <Trans>Rewards in</Trans>, value: rewardTokenSymbol } satisfies ModalRow]
          : []),
        {
          label: <Trans>Est. earnings (1Y)</Trans>,
          value: `$${formatNumber(projectAnnualEarnings(amountUsd, rate), { maxDecimals: 2 })}`
        },
        { label: <Trans>Product</Trans>, value: displayName },
        { label: <Trans>Withdrawal</Trans>, value: <Trans>Anytime</Trans> },
        {
          label: <NetworkFeeLabel />,
          value: <NetworkFeeValue fee={networkFee} callCount={calls.length} promoVisible={promoVisible} />
        }
      ]
    : [
        {
          label: <Trans>You&apos;ll receive</Trans>,
          value: `${formatNumber(amountUsd, { maxDecimals: 2 })} ${supplyToken.symbol}`
        },
        { label: <Trans>Product</Trans>, value: displayName },
        {
          label: <NetworkFeeLabel />,
          value: <NetworkFeeValue fee={networkFee} callCount={calls.length} promoVisible={promoVisible} />
        }
      ];

  const body = (
    <div className="flex flex-col gap-3" data-testid={`rewards-modal-${flow}-form`}>
      <div className="bg-panel flex items-center justify-between gap-2 rounded-xl p-3">
        <input
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={e => onInput(e.target.value)}
          disabled={!isConnected}
          aria-label={isSupply ? t`Supply amount` : t`Withdraw amount`}
          data-testid="rewards-modal-amount-input"
          className="text-text placeholder:text-textSecondary w-full min-w-0 bg-transparent text-2xl font-medium outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="text-text flex shrink-0 items-center gap-1.5" data-testid="rewards-modal-asset">
          <TokenIcon
            token={{ symbol: supplyToken.symbol }}
            width={20}
            showChainIcon={false}
            className="h-5 w-5"
          />
          <Text className="font-medium">{supplyToken.symbol}</Text>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Text className="text-textSecondary text-sm">
          <Trans>Balance</Trans>:{' '}
          {isConnected
            ? formatNumber(parseFloat(formatUnits(available, decimals)), { maxDecimals: 2 })
            : NO_VALUE}
        </Text>
        <button
          type="button"
          onClick={setMaxAmount}
          className="text-textEmphasis text-sm font-medium"
          data-testid="rewards-modal-amount-max"
        >
          <Trans>Max</Trans>
        </button>
      </div>

      {insufficient && (
        <Text className="text-error text-sm" data-testid="rewards-modal-amount-error">
          {isSupply ? <Trans>Insufficient balance</Trans> : <Trans>Amount exceeds your position</Trans>}
        </Text>
      )}

      <div className="flex flex-col gap-3 pt-1">
        {rows.map((row, index) => (
          <Row key={index} label={row.label} value={row.value} />
        ))}
      </div>

      {promoVisible && <BundleSavingsPromo saving={networkFee!.batchSaving!} />}
    </div>
  );

  return renderInSlot(body);
}
