import { useCallback, useId, type ReactNode } from 'react';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionConfig } from '@/modules/ui/context/transactionContract';

export type EarnModalFlow = 'supply' | 'withdraw';

export interface UseEarnModalOptions<Args, Preset> {
  /** Where the product runs; the chain guard fires off any other chain (APP-528). */
  supportedChainIds: TransactionConfig['supportedChainIds'];
  /** The flow: a form that renders `TransactionModal` from its own state. */
  form: (props: { flow: EarnModalFlow; args: Args; preset?: Preset; onSuccess?: () => void }) => ReactNode;
  /** Fires after a successful supply/withdraw — refetch the position/balances. */
  onSuccess?: () => void;
}

export interface EarnModalOpeners<Args, Preset> {
  openSupply: (args: Args, preset?: Preset) => void;
  openWithdraw: (args: Args, preset?: Preset) => void;
}

/**
 * The supply/withdraw openers every earn product exposes: one session per
 * flow so sibling modals never cross-talk, and a launch that hands the
 * provider the product's form as the flow component.
 */
export function useEarnModal<Args = void, Preset = never>({
  supportedChainIds,
  form,
  onSuccess
}: UseEarnModalOptions<Args, Preset>): EarnModalOpeners<Args, Preset> {
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  const open = useCallback(
    (flow: EarnModalFlow, args: Args, preset?: Preset) => {
      const sessionId = flow === 'supply' ? supplySessionId : withdrawSessionId;
      launch({ sessionId, supportedChainIds, render: () => form({ flow, args, preset, onSuccess }) });
    },
    [launch, supplySessionId, withdrawSessionId, supportedChainIds, form, onSuccess]
  );

  const openSupply = useCallback((args: Args, preset?: Preset) => open('supply', args, preset), [open]);
  const openWithdraw = useCallback((args: Args, preset?: Preset) => open('withdraw', args, preset), [open]);

  return { openSupply, openWithdraw };
}
