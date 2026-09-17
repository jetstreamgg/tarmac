import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import type { TransactionConfig, TransactionContextValue } from '@/modules/ui/context/transactionContract';
import { TxStatus } from '@/modules/ui/lib/txStatus';
// The legacy msgid generators double as e2e anchors — reused, not forked
// (UI Spec §3). They survive F7 by relocation, not deletion.
import { getStakeTitle, StakeFlow } from '../lib/constants';

/** The per-flow half of a stake modal launch — what `launchStakeModal` does not fix. */
type StakeLaunchOverrides = Pick<
  TransactionConfig,
  | 'usdValue'
  | 'title'
  | 'toast'
  | 'sessionId'
  | 'transactionContent'
  | 'transactionScreenContent'
  | 'steps'
  | 'onConfirm'
  | 'onSuccess'
> & {
  /** The legacy stakeData analytics payload (useStakeTransactionCallbacks shape). */
  stakeData: Record<string, unknown>;
};

/**
 * `TransactionContext.launch()` for the open and manage seams — the config
 * both share, with the flow picking the wallet-screen title (the legacy
 * msgid) and the analytics flow. The launch is `skipReview`: the takeover /
 * sheet already served as the review (Design QA 2800:91832), so the modal
 * opens on the wallet screen and the gate runs at once; `title` is the
 * minimized-toast fallback only. Staking is mainnet-only, so the modal is
 * guarded off any L2 (APP-528).
 */
export function launchStakeModal(
  launchModal: TransactionContextValue['launch'],
  flow: StakeFlow,
  { stakeData, ...overrides }: StakeLaunchOverrides
) {
  launchModal({
    ...overrides,
    supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
    skipReview: true,
    transactionTitle: i18n._(getStakeTitle(TxStatus.INITIALIZED, flow)),
    confirmLabel: t`Confirm`,
    analytics: {
      widgetName: 'stake',
      flow,
      action: 'multicall',
      data: stakeData
    }
  });
}
