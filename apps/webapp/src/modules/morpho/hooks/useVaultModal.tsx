import { useCallback, useId } from 'react';
import { t } from '@lingui/core/macro';
import { type Token, type VaultProvider } from '@/hooks';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { VaultModalForm, type VaultModalPreset } from '../components/VaultModalForm';

/** Per-vault inputs the launcher needs to open the modal for a specific vault. */
export type VaultModalArgs = {
  vaultAddress: `0x${string}`;
  /** The vault's underlying asset (e.g. TOKENS.usdc). */
  assetToken: Token;
  /** Display name shown in titles + the review "Product" row (e.g. "USDC Risk Capital"). */
  vaultName: string;
  provider?: VaultProvider;
  /** Net APY (decimal fraction) for the modal's APY + 1Y projected-earnings rows. */
  netRate?: number;
};

type UseVaultModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the editable vault supply/withdraw modal — the vault
 * analogue of `useSavingsModal`. Any surface (the vault position card, the
 * Portfolio cards, …) calls this instead of re-declaring the launch config. Each
 * opener mints its own session so sibling modals never cross-talk.
 *
 * Unlike savings (a singleton product), vaults are many, so the per-vault inputs
 * are passed to `openSupply`/`openWithdraw` at call time (not hook time) — the
 * same launcher can open the modal for any vault.
 */
export function useVaultModal({ onSuccess }: UseVaultModalOptions = {}) {
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  const openSupply = useCallback(
    (args: VaultModalArgs, preset?: VaultModalPreset) => {
      launch({
        title: t`Supply to ${args.vaultName}`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          loading: t`Your supply is being processed on the blockchain. Please wait.`,
          success: t`You've successfully supplied to ${args.vaultName}.`,
          error: t`An error occurred while supplying to ${args.vaultName}.`
        },
        sessionId: supplySessionId,
        reviewTitle: t`Review supply`,
        entry: { confirmLabel: t`Review`, confirmDisabled: true },
        confirmLabel: t`Confirm`,
        // The editable body lives outside the dialog (hidden host) so its in-flight
        // hook survives minimize; it portals its inputs into the modal's entry slot.
        backgroundContent: (
          <VaultModalForm
            sessionId={supplySessionId}
            flow="supply"
            vaultAddress={args.vaultAddress}
            assetToken={args.assetToken}
            vaultName={args.vaultName}
            provider={args.provider}
            netRate={args.netRate}
            preset={preset}
          />
        ),
        onConfirm: () => {},
        onSuccess
      });
    },
    [launch, supplySessionId, onSuccess]
  );

  const openWithdraw = useCallback(
    (args: VaultModalArgs, preset?: VaultModalPreset) => {
      launch({
        title: t`Withdraw from ${args.vaultName}`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          loading: t`Your withdrawal is being processed on the blockchain. Please wait.`,
          success: t`You've successfully withdrawn from ${args.vaultName}.`,
          error: t`An error occurred while withdrawing from ${args.vaultName}.`
        },
        sessionId: withdrawSessionId,
        reviewTitle: t`Review withdrawal`,
        entry: { confirmLabel: t`Review`, confirmDisabled: true },
        confirmLabel: t`Confirm`,
        backgroundContent: (
          <VaultModalForm
            sessionId={withdrawSessionId}
            flow="withdraw"
            vaultAddress={args.vaultAddress}
            assetToken={args.assetToken}
            vaultName={args.vaultName}
            provider={args.provider}
            netRate={args.netRate}
            preset={preset}
          />
        ),
        onConfirm: () => {},
        onSuccess
      });
    },
    [launch, withdrawSessionId, onSuccess]
  );

  return { openSupply, openWithdraw };
}
