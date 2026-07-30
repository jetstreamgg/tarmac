import { useMemo } from 'react';
import type { Call } from 'viem';
import { useConnection, useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import {
  daiUsdsAddress,
  mcdDaiAddress,
  mkrAddress,
  mkrSkyAddress,
  useBatchUpgrade,
  useIsBatchSupported,
  useTokenAllowance,
  type UpgradeSourceToken
} from '@/hooks';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';

/** Fixed upgrade pairs: each source token has exactly one target. */
export const UPGRADE_TARGET: Record<UpgradeSourceToken, 'USDS' | 'SKY'> = {
  DAI: 'USDS',
  MKR: 'SKY'
};

export interface UseUpgradeLaunchResult {
  /** Fires the engine call directly (txCallbacks already spread in). */
  execute: () => void;
  /** Step labels matching the engine's call count (approve elided when covered). */
  steps: TransactionStep[];
  /** Whether the engine hook is ready to execute. */
  prepared: boolean;
  isLoading: boolean;
  error: Error | null;
  /** The routed engine's calls, for estimating the flow's network fee. */
  calls: Call[];
  /** Whether those calls go out bundled — the batch costs less than the sequence. */
  isBatch: boolean;
}

/**
 * The seam between the upgrade modal and the (unmodified) `useBatchUpgrade`
 * engine — the upgrade analogue of `useStUsdsLaunch`: spreads the context's
 * `txCallbacks` into the engine, honours the batch toggle, and derives the
 * step labels. The allowance read here is READ ONLY and only labels the
 * approve step (TanStack dedupes it with the engine's own read).
 */
export function useUpgradeLaunch({
  token,
  amount
}: {
  token: UpgradeSourceToken;
  amount: bigint;
}): UseUpgradeLaunchResult {
  const { txCallbacks } = useTransaction();
  const { address } = useConnection();
  const chainId = useChainId();

  // Honour the user's batch toggle: bundle approve+upgrade into one EIP-5792
  // call only when opted in AND supported. useTransactionFlow additionally
  // gates on calls.length > 1, so a no-approval upgrade stays a single
  // signature regardless of this flag.
  const [batchEnabled] = useBatchToggle();
  const { data: batchSupported } = useIsBatchSupported();
  const shouldUseBatch = !!batchEnabled && !!batchSupported;

  const isDai = token === 'DAI';
  const target = UPGRADE_TARGET[token];

  // READ ONLY — labels the approve step only. Same read as the engine's own.
  const { data: allowance } = useTokenAllowance({
    chainId,
    contractAddress: isDai
      ? mcdDaiAddress[chainId as keyof typeof mcdDaiAddress]
      : mkrAddress[chainId as keyof typeof mkrAddress],
    owner: address,
    spender: isDai
      ? daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
      : mkrSkyAddress[chainId as keyof typeof mkrSkyAddress]
  });
  const needsAllowance = allowance === undefined || allowance < amount;

  const upgrade = useBatchUpgrade({
    token,
    amount,
    shouldUseBatch,
    ...txCallbacks
  });

  // Step labels mirror the engine's call count so the indicator advances in
  // lockstep (the savings DAI-supply labelling convention).
  const steps = useMemo<TransactionStep[]>(() => {
    const upgradeStep = t`Upgrade ${token} to ${target}`;
    return needsAllowance ? [{ label: t`Approve`, tokenSymbol: token }, upgradeStep] : [upgradeStep];
  }, [needsAllowance, token, target]);

  return {
    execute: upgrade.execute,
    steps,
    prepared: upgrade.prepared,
    isLoading: upgrade.isLoading,
    error: upgrade.error,
    calls: upgrade.calls ?? [],
    isBatch: !!upgrade.isBatch
  };
}
