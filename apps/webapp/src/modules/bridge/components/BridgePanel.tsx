import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { useBridgeForm } from '../hooks/useBridgeForm';
import { useBridgeLaunch } from '../hooks/useBridgeLaunch';
import { useDestinationActionLaunch } from '../hooks/useDestinationActionLaunch';
import { BridgeCard } from './BridgeCard';
import { PendingBridges } from './PendingBridges';

function RecipientHint({ reason }: { reason: ReturnType<typeof useBridgeForm>['recipientReason'] }) {
  switch (reason) {
    case 'other-family':
      return <Trans>Add a Solana address to receive the funds.</Trans>;
    case 'safe-not-on-destination':
      return <Trans>Your Safe is not deployed on the destination network. Add a recipient address.</Trans>;
    case 'safe-differs':
      return (
        <Trans>Your Safe has different owners on the destination network. Add a recipient address.</Trans>
      );
    default:
      return <Trans>We could not check your Safe on the destination network. Add a recipient address.</Trans>;
  }
}

function BlockedMessage({ reason }: { reason: ReturnType<typeof useBridgeForm>['blockedReason'] }) {
  switch (reason) {
    case 'over-limit':
      return <Trans>This amount is over the bridge limit. Try a smaller amount.</Trans>;
    case 'no-liquidity':
      return <Trans>Not enough liquidity on the destination for this amount. Try a smaller amount.</Trans>;
    default:
      return <Trans>This route is temporarily unavailable.</Trans>;
  }
}

// Same CTA geometry as the Swap tab.
const CTA_CLASSES =
  'h-12 w-full text-sm leading-4 tracking-[-0.28px] md:h-14 md:text-base md:leading-[18px] md:tracking-[-0.32px]';

/** The Bridge tab body: form card, Review CTA, then the pending bridges list. */
export function BridgePanel() {
  const form = useBridgeForm();
  const { launch, locked, restore } = useBridgeLaunch(form, form.reset);
  const launchOrConnect = useConnectThenAct(launch);
  const { launch: launchAction, locked: actionLocked } = useDestinationActionLaunch();

  const reviewDisabled = form.isConnected && form.reviewBlocked;

  return (
    <div className="flex w-full flex-col gap-8" data-testid="bridge-panel">
      <div className="flex w-full flex-col gap-4">
        <div inert={locked} className={locked ? 'opacity-50' : undefined} data-testid="bridge-form">
          <BridgeCard form={form} />
        </div>

        {locked ? (
          <Text className="text-textSecondary text-sm" dataTestId="bridge-locked">
            <Trans>A transaction is in progress. Open it to continue.</Trans>
          </Text>
        ) : form.insufficient ? (
          <Text className="text-error text-sm" dataTestId="bridge-error">
            <Trans>Insufficient funds</Trans>
          </Text>
        ) : form.blockedReason ? (
          <Text className="text-error text-sm" dataTestId="bridge-blocked">
            <BlockedMessage reason={form.blockedReason} />
          </Text>
        ) : form.safeCheckFailed ? (
          <Text className="text-error text-sm" dataTestId="bridge-safe-unknown">
            <Trans>We couldn&apos;t check your wallet. Try again in a moment.</Trans>
          </Text>
        ) : (
          form.isConnected &&
          form.needsRecipient &&
          !form.recipientChecking && (
            <Text className="text-textSecondary text-sm" dataTestId="bridge-recipient-hint">
              <RecipientHint reason={form.recipientReason} />
            </Text>
          )
        )}

        <Button
          variant="primary"
          size="xl"
          className={CTA_CLASSES}
          disabled={!locked && reviewDisabled}
          onClick={locked ? restore : launchOrConnect}
          data-testid={locked ? 'bridge-open-transaction' : 'bridge-review-cta'}
        >
          {locked ? <Trans>Open transaction</Trans> : <Trans>Review</Trans>}
        </Button>
      </div>

      <PendingBridges onAction={launchAction} actionLocked={actionLocked} />
    </div>
  );
}
