import { useCallback, useId } from 'react';
import { t } from '@lingui/core/macro';
import { type Token } from '@/hooks';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { RewardsModalForm, type RewardsModalPreset } from '../components/RewardsModalForm';

/** Per-contract inputs the launcher needs to open the modal for a specific farm. */
export type RewardsModalArgs = {
  contractAddress: `0x${string}`;
  /** The token staked into the reward contract (USDS for every current farm). */
  supplyToken: Token;
  /** Display title shown in modal titles + the review "Product" row (e.g. "SPK Rewards"). */
  displayName: string;
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
 * Portfolio cards, …) calls this instead of re-declaring the launch config. Each
 * opener mints its own session so sibling modals never cross-talk.
 *
 * Like vaults, reward farms are many, so the per-contract inputs are passed to
 * `openSupply`/`openWithdraw` at call time (not hook time) — the same launcher
 * can open the modal for any farm. Analytics-free by design, matching
 * `useSavingsModal`/`useVaultModal` (attribution is a separate slice).
 */
export function useRewardsModal({ onSuccess }: UseRewardsModalOptions = {}) {
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  const openSupply = useCallback(
    (args: RewardsModalArgs, preset?: RewardsModalPreset) => {
      launch({
        title: t`Supply to ${args.displayName}`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          loading: t`Your supply is being processed on the blockchain. Please wait.`,
          success: t`You've successfully supplied to ${args.displayName}.`,
          error: t`An error occurred while supplying to ${args.displayName}.`
        },
        sessionId: supplySessionId,
        entry: { confirmLabel: t`Supply`, confirmDisabled: true },
        // The editable body lives outside the dialog (hidden host) so its in-flight
        // hook survives minimize; it portals its inputs into the modal's entry slot.
        backgroundContent: (
          <RewardsModalForm
            sessionId={supplySessionId}
            flow="supply"
            contractAddress={args.contractAddress}
            supplyToken={args.supplyToken}
            displayName={args.displayName}
            rewardTokenSymbol={args.rewardTokenSymbol}
            rate={args.rate}
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
    (args: RewardsModalArgs, preset?: RewardsModalPreset) => {
      launch({
        title: t`Withdraw from ${args.displayName}`,
        transactionTitle: t`Confirm in the wallet`,
        subtitles: {
          loading: t`Your withdrawal is being processed on the blockchain. Please wait.`,
          success: t`You've successfully withdrawn from ${args.displayName}.`,
          error: t`An error occurred while withdrawing from ${args.displayName}.`
        },
        sessionId: withdrawSessionId,
        entry: { confirmLabel: t`Withdraw`, confirmDisabled: true },
        backgroundContent: (
          <RewardsModalForm
            sessionId={withdrawSessionId}
            flow="withdraw"
            contractAddress={args.contractAddress}
            supplyToken={args.supplyToken}
            displayName={args.displayName}
            rewardTokenSymbol={args.rewardTokenSymbol}
            rate={args.rate}
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
