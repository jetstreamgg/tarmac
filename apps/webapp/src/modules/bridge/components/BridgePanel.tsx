import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { useBridgeForm } from '../hooks/useBridgeForm';
import { useBridgeLaunch } from '../hooks/useBridgeLaunch';
import { useClaimLaunch } from '../hooks/useClaimLaunch';
import { usePendingBridges } from '../hooks/usePendingBridges';
import { BridgeCard } from './BridgeCard';
import { PendingBridges } from './PendingBridges';

// Same CTA geometry as the Swap tab.
const CTA_CLASSES =
  'h-12 w-full text-sm leading-4 tracking-[-0.28px] md:h-14 md:text-base md:leading-[18px] md:tracking-[-0.32px]';

/** The Bridge tab body: form card, Review CTA, then the pending bridges list. */
export function BridgePanel() {
  const form = useBridgeForm();
  const { launch, locked, restore } = useBridgeLaunch(form, form.reset);
  const launchOrConnect = useConnectThenAct(launch);
  const claim = useClaimLaunch();
  const pending = usePendingBridges();

  const reviewDisabled = form.isConnected && (form.isZero || form.insufficient || form.needsRecipient);

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
        ) : (
          form.isConnected &&
          form.needsRecipient && (
            <Text className="text-textSecondary text-sm" dataTestId="bridge-recipient-hint">
              <Trans>Add a Solana address to receive the funds.</Trans>
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

      <PendingBridges bridges={pending} onClaim={claim} />
    </div>
  );
}
