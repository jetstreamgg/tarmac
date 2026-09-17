import { type Token } from '@/hooks';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { useEarnModal, type UseEarnModalOptions } from '@/modules/ui/hooks/useEarnModal';
import { VaultModalForm, type VaultModalPreset } from '../components/VaultModalForm';

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

const form: UseEarnModalOptions<VaultModalArgs, VaultModalPreset>['form'] = ({
  flow,
  args,
  preset,
  onSuccess
}) => (
  <VaultModalForm
    flow={flow}
    onSuccess={onSuccess}
    vaultAddress={args.vaultAddress}
    assetToken={args.assetToken}
    vaultName={args.vaultName}
    netRate={args.netRate}
    preset={preset}
  />
);

type UseVaultModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the editable vault supply/withdraw modal. Vaults are
 * many, so the per-vault inputs are passed to `openSupply`/`openWithdraw` at
 * call time — the same launcher can open the modal for any vault. Morpho/Sky
 * vaults are mainnet-only — the modal is guarded off any L2 (APP-528).
 */
export function useVaultModal({ onSuccess }: UseVaultModalOptions = {}) {
  return useEarnModal<VaultModalArgs, VaultModalPreset>({
    supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
    form,
    onSuccess
  });
}
