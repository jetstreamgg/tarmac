import { useCallback, useId, type ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionConfig } from '@/modules/ui/context/transactionContract';

export type EarnModalFlow = 'supply' | 'withdraw';

export interface UseEarnModalOptions<Args, Preset> {
  /** Names the product in the titles: "Supply to {name}" / "Withdraw from {name}". */
  productName: (args: Args) => string;
  /** Where the product runs; the chain guard fires off any other chain (APP-528). */
  supportedChainIds: TransactionConfig['supportedChainIds'];
  /** The editable body: rendered in the hidden host, portalled into the entry slot. */
  form: (props: { sessionId: string; flow: EarnModalFlow; args: Args; preset?: Preset }) => ReactNode;
  /** Per-flow additions to the launch config (a review subtitle, a title override). */
  extra?: (flow: EarnModalFlow, args: Args) => Partial<TransactionConfig>;
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
}

export interface EarnModalOpeners<Args, Preset> {
  openSupply: (args: Args, preset?: Preset) => void;
  openWithdraw: (args: Args, preset?: Preset) => void;
}

/**
 * The three-screen supply/withdraw modal every earn product opens (Figma
 * 859:36036 → 859:36154 → 859:36214). A product supplies its name, chains and
 * form; this owns the shared launch config and one session per opener. The
 * body replaces the placeholder `onConfirm` and the 0 `usdValue` as soon as it
 * mounts (`useModalEntryBody`). No `analytics` here by design: attribution
 * live-merges from the body or is a separate sign-off-gated slice.
 */
export function useEarnModal<Args = void, Preset = never>({
  productName,
  supportedChainIds,
  form,
  extra,
  onSuccess
}: UseEarnModalOptions<Args, Preset>): EarnModalOpeners<Args, Preset> {
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  const open = useCallback(
    (flow: EarnModalFlow, args: Args, preset?: Preset) => {
      const name = productName(args);
      const sessionId = flow === 'supply' ? supplySessionId : withdrawSessionId;
      launch({
        title: flow === 'supply' ? t`Supply to ${name}` : t`Withdraw from ${name}`,
        reviewTitle: flow === 'supply' ? t`Review supply` : t`Review withdrawal`,
        transactionTitle: t`Confirm in the wallet`,
        sessionId,
        entry: { confirmLabel: t`Review`, confirmDisabled: true },
        usdValue: 0,
        supportedChainIds,
        confirmLabel: t`Confirm`,
        backgroundContent: form({ sessionId, flow, args, preset }),
        onConfirm: () => {},
        onSuccess,
        ...extra?.(flow, args)
      });
    },
    [launch, supplySessionId, withdrawSessionId, productName, supportedChainIds, form, extra, onSuccess]
  );

  const openSupply = useCallback((args: Args, preset?: Preset) => open('supply', args, preset), [open]);
  const openWithdraw = useCallback((args: Args, preset?: Preset) => open('withdraw', args, preset), [open]);

  return { openSupply, openWithdraw };
}
