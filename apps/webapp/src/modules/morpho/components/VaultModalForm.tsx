import { type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { NetworkFeeLabel } from '@/modules/ui/components/NetworkFeeLabel';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import { NetworkFeeValue, useBundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import { type Token, type VaultProvider } from '@/hooks';
import { formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { useNetworkFee } from '@/hooks';
import { useVaultLaunch, type VaultLaunchFlow } from '../hooks/useVaultLaunch';
import { useVaultTransactionForm, type VaultModalPreset } from '../hooks/useVaultTransactionForm';

export type { VaultModalPreset } from '../hooks/useVaultTransactionForm';

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
 * Editable body for the vault "Supply to / Withdraw from {vault}" modals, mounted
 * as the shared modal's entry screen — the vault analogue of `SavingsModalForm`.
 * One body, two flows. The form model (`useVaultTransactionForm`) is shared; this
 * is the presentation: the amount input + Max + the folded review rows (You'll
 * receive / APY / Est. earnings / Product / Withdrawal / Network fee).
 *
 * NOTE: the design draws a distinct "Review supply" screen between input and the
 * wallet step, but the TransactionContext machinery supports only one first
 * screen (entry OR review) before the wallet/status screen. So — like the savings
 * modal — the review rows are folded into this editable entry; the wallet screen
 * shows the amount summary + the stepped Approve/Supply indicator.
 *
 * Confirm fires the engine `execute` from `useVaultLaunch` directly (the modal is
 * already open); gating/steps/wallet-content/toast are kept live via
 * `updateModalContent` so the body never remounts (input stays focused).
 */
export function VaultModalForm({
  sessionId,
  flow,
  vaultAddress,
  assetToken,
  vaultName,
  provider = 'morpho',
  netRate,
  preset
}: {
  sessionId: string;
  flow: VaultLaunchFlow;
  vaultAddress: `0x${string}`;
  assetToken: Token;
  vaultName: string;
  provider?: VaultProvider;
  /** Net APY as a decimal fraction (e.g. 0.0445) for the APY + projected-earnings rows. */
  netRate?: number;
  preset?: VaultModalPreset;
}) {
  const form = useVaultTransactionForm({ flow, vaultAddress, assetToken, provider, preset });
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

  const { execute, steps, prepared, calls, isBatch } = useVaultLaunch(engineParams);
  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const { data: networkFee } = useNetworkFee({ calls, shouldUseBatch: isBatch, enabled: amountReady });

  const bundleState = useBundleFeeState(calls.length, networkFee);
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
  // matches what's submitted — an input that normalizes to 0n previews 0 too.
  // USD ≈ amount for the $1-pegged vault assets (USDC/USDS/USDT).
  const amountUsd = parseFloat(formatUnits(amount, decimals));
  const apy = netRate !== undefined ? formatDecimalPercentage(netRate) : NO_VALUE;
  const receiveRow: ModalRow = {
    label: <Trans>You&apos;ll receive</Trans>,
    value: `${formatNumber(amountUsd, { maxDecimals: 2 })} ${assetToken.symbol}`
  };
  const rows: ModalRow[] = isSupply
    ? [
        receiveRow,
        { label: <Trans>APY</Trans>, value: apy },
        {
          label: <Trans>Est. earnings (1Y)</Trans>,
          value: `$${formatNumber(projectAnnualEarnings(amountUsd, netRate), { maxDecimals: 2 })}`
        },
        { label: <Trans>Product</Trans>, value: vaultName },
        { label: <Trans>Withdrawal</Trans>, value: <Trans>Anytime</Trans> },
        {
          label: <NetworkFeeLabel />,
          value: <NetworkFeeValue fee={networkFee} state={bundleState} />
        }
      ]
    : [
        receiveRow,
        { label: <Trans>Product</Trans>, value: vaultName },
        {
          label: <NetworkFeeLabel />,
          value: <NetworkFeeValue fee={networkFee} state={bundleState} />
        }
      ];

  const body = (
    <div className="flex flex-col gap-3" data-testid={`vault-modal-${flow}-form`}>
      <div className="bg-panel flex items-center justify-between gap-2 rounded-xl p-3">
        <input
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={e => onInput(e.target.value)}
          disabled={!isConnected}
          aria-label={isSupply ? t`Supply amount` : t`Withdraw amount`}
          data-testid="vault-modal-amount-input"
          className="text-text placeholder:text-textSecondary w-full min-w-0 bg-transparent text-2xl font-medium outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="text-text flex shrink-0 items-center gap-1.5" data-testid="vault-modal-asset">
          <TokenIcon
            token={{ symbol: assetToken.symbol }}
            width={20}
            showChainIcon={false}
            className="h-5 w-5"
          />
          <Text className="font-medium">{assetToken.symbol}</Text>
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
          data-testid="vault-modal-amount-max"
        >
          <Trans>Max</Trans>
        </button>
      </div>

      {insufficient && (
        <Text className="text-error text-sm" data-testid="vault-modal-amount-error">
          {isSupply ? <Trans>Insufficient balance</Trans> : <Trans>Amount exceeds your position</Trans>}
        </Text>
      )}

      <div className="flex flex-col gap-3 pt-1">
        {rows.map((row, index) => (
          <Row key={index} label={row.label} value={row.value} />
        ))}
      </div>

      {bundleState.promoVisible && <BundleSavingsPromo saving={networkFee!.batchSaving!} />}
    </div>
  );

  return renderInSlot(body);
}
