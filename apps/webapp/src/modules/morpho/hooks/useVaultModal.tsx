import { useCallback, useId } from 'react';
import { type Token } from '@/hooks';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { VaultFlow, type VaultModalPreset } from '../components/VaultFlow';

/** Per-vault inputs the launcher needs to open the modal for a specific vault. */
export type VaultModalArgs = {
  vaultAddress: `0x${string}`;
  /** The vault's underlying asset (e.g. TOKENS.usdc). */
  assetToken: Token;
  /** Display name shown in titles + the review "Product" row (e.g. "USDC Risk Capital"). */
  vaultName: string;
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
 * Portfolio cards, …) calls this.
 *
 * Unlike savings (a singleton product), vaults are many, so the per-vault inputs
 * are passed to `openSupply`/`openWithdraw` at call time (not hook time) — the
 * same launcher can open the modal for any vault.
 */
export function useVaultModal({ onSuccess }: UseVaultModalOptions = {}) {
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  const open = useCallback(
    (flow: 'supply' | 'withdraw', sessionId: string, args: VaultModalArgs, preset?: VaultModalPreset) =>
      launch({
        sessionId,
        // Morpho/Sky vaults are mainnet-only — guard the modal off any L2 (APP-528).
        supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
        flow: (
          <VaultFlow
            flow={flow}
            vaultAddress={args.vaultAddress}
            assetToken={args.assetToken}
            vaultName={args.vaultName}
            netRate={args.netRate}
            preset={preset}
            onSuccess={onSuccess}
          />
        )
      }),
    [launch, onSuccess]
  );

  const openSupply = useCallback(
    (args: VaultModalArgs, preset?: VaultModalPreset) => open('supply', supplySessionId, args, preset),
    [open, supplySessionId]
  );
  const openWithdraw = useCallback(
    (args: VaultModalArgs, preset?: VaultModalPreset) => open('withdraw', withdrawSessionId, args, preset),
    [open, withdrawSessionId]
  );

  return { openSupply, openWithdraw };
}
