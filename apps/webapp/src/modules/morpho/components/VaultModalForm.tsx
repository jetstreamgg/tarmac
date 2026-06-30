import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { type Token, type VaultProvider } from '@/hooks';
import { formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useTransaction, useEntrySlot } from '@/modules/ui/context/TransactionContext';
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
  const { updateModalContent } = useTransaction();
  const entrySlot = useEntrySlot();

  const form = useVaultTransactionForm({ flow, vaultAddress, assetToken, provider, preset });
  const {
    isConnected,
    isSupply,
    decimals,
    value,
    available,
    insufficient,
    amountReady,
    engineParams,
    toast,
    transactionScreenContent,
    onInput,
    setMaxAmount
  } = form;

  const { execute, steps, prepared } = useVaultLaunch(engineParams);
  const disabled = !amountReady || !prepared;

  // `execute` is rebuilt every render; read the latest from a ref so `onConfirm`
  // need never be re-pushed (which would loop the sync below).
  const executeRef = useRef(execute);
  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);
  const onConfirm = useCallback(() => executeRef.current(), []);

  // Keep the shared modal's confirm gating + handler + step labels + wallet-screen
  // summary + minimized-toast titles in sync. Merged (not replacing entry content),
  // so the body never remounts.
  useEffect(() => {
    updateModalContent(sessionId, {
      entry: { confirmDisabled: disabled },
      onConfirm,
      steps,
      transactionScreenContent,
      toast
    });
  }, [sessionId, disabled, steps, onConfirm, transactionScreenContent, toast, updateModalContent]);

  // USD ≈ amount for the $1-pegged vault assets (USDC/USDS/USDT).
  const amountUsd = parseFloat(value || '0');
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
        { label: <Trans>Network fee</Trans>, value: NO_VALUE }
      ]
    : [
        receiveRow,
        { label: <Trans>Product</Trans>, value: vaultName },
        { label: <Trans>Network fee</Trans>, value: NO_VALUE }
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
    </div>
  );

  // Display inside the dialog when its entry slot is mounted; otherwise render
  // inline in the hidden host (keeps the body — and its engine hook — mounted).
  return entrySlot ? createPortal(body, entrySlot) : body;
}
