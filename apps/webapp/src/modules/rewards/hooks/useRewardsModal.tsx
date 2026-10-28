import { useCallback, useId } from 'react';
import { type Token } from '@/hooks';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { RewardsFlow, type RewardsModalPreset } from '../components/RewardsFlow';

/** Per-contract inputs the launcher needs to open the modal for a specific farm. */
export type RewardsModalArgs = {
  contractAddress: `0x${string}`;
  /** The token staked into the reward contract (USDS for every current farm). */
  supplyToken: Token;
  /** Display title shown in modal titles + the review "Product" row (e.g. "SPK Rewards"). */
  displayName: string;
  /** Registry `contract.name`, reported as the analytics `product` (legacy parity). */
  productName: string;
  /** Reward-token symbol for the "Rewards in" row; omit for point farms (CLE). */
  rewardTokenSymbol?: string;
  /** Reward rate (decimal fraction) for the modal's Rate + 1Y projected-earnings rows. */
  rate?: number;
};

type UseRewardsModalOptions = {
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
};

/**
 * Reusable trigger for the editable rewards supply/withdraw modal — the rewards
 * analogue of `useVaultModal`. Any surface (the rewards position card, the
 * Portfolio cards, …) calls this.
 *
 * Like vaults, reward farms are many, so the per-contract inputs are passed to
 * `openSupply`/`openWithdraw` at call time (not hook time) — the same launcher
 * can open the modal for any farm.
 */
export function useRewardsModal({ onSuccess }: UseRewardsModalOptions = {}) {
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  const open = useCallback(
    (flow: 'supply' | 'withdraw', sessionId: string, args: RewardsModalArgs, preset?: RewardsModalPreset) =>
      launch({
        sessionId,
        // Reward farms are mainnet-only — guard the modal off any L2 (APP-528).
        supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
        flow: (
          <RewardsFlow
            flow={flow}
            contractAddress={args.contractAddress}
            supplyToken={args.supplyToken}
            displayName={args.displayName}
            productName={args.productName}
            rewardTokenSymbol={args.rewardTokenSymbol}
            rate={args.rate}
            preset={preset}
            onSuccess={onSuccess}
          />
        )
      }),
    [launch, onSuccess]
  );

  const openSupply = useCallback(
    (args: RewardsModalArgs, preset?: RewardsModalPreset) => open('supply', supplySessionId, args, preset),
    [open, supplySessionId]
  );
  const openWithdraw = useCallback(
    (args: RewardsModalArgs, preset?: RewardsModalPreset) =>
      open('withdraw', withdrawSessionId, args, preset),
    [open, withdrawSessionId]
  );

  return { openSupply, openWithdraw };
}
