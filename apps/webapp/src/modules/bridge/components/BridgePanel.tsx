import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { useBridgeForm } from '../hooks/useBridgeForm';
import { useBridgeLaunch } from '../hooks/useBridgeLaunch';
import { useCctpResumeLaunch } from '../hooks/useCctpResumeLaunch';
import { useDestinationActionLaunch } from '../hooks/useDestinationActionLaunch';
import { BridgeCard } from './BridgeCard';
import { CctpClaimLookup } from './CctpClaimLookup';
import { PendingBridges } from './PendingBridges';

type RecipientHintProps = { reason: ReturnType<typeof useBridgeForm>['recipientReason'] };

export function RecipientHint({ reason }: RecipientHintProps) {
  switch (reason) {
    case 'other-family':
      return <Trans>Add a Solana address to receive the funds.</Trans>;
    case 'safe-not-on-destination':
      return <Trans>Your Safe is not deployed on the destination network. Add a recipient address.</Trans>;
    case 'safe-differs':
      return (
        <Trans>Your Safe has different owners on the destination network. Add a recipient address.</Trans>
      );
    case 'contract-not-on-destination':
      return (
        <Trans>
          Your wallet is a smart contract that doesn&apos;t exist on the destination network. Add a recipient
          address.
        </Trans>
      );
    case 'contract-unverified':
      return <Trans>We couldn&apos;t check your wallet. Add a recipient address.</Trans>;
    default:
      return <Trans>We couldn&apos;t check your Safe. Add a recipient address.</Trans>;
  }
}

type RecipientProblemMessageProps = { problem: ReturnType<typeof useBridgeForm>['recipientProblem'] };

function RecipientProblemMessage({ problem }: RecipientProblemMessageProps) {
  switch (problem) {
    case 'system-contract':
      return (
        <Trans>This address is a token or bridge contract and can&apos;t receive funds. Change it.</Trans>
      );
    case 'contract-not-on-destination':
      return (
        <Trans>
          This address is a smart contract that doesn&apos;t exist on the destination network. Funds sent
          there can&apos;t be recovered. Change it.
        </Trans>
      );
    default:
      return <Trans>We couldn&apos;t check the recipient address. Try again in a moment.</Trans>;
  }
}

type BlockedMessageProps = { reason: ReturnType<typeof useBridgeForm>['blockedReason'] };

function BlockedMessage({ reason }: BlockedMessageProps) {
  switch (reason) {
    case 'over-limit':
      return <Trans>This amount is over the bridge limit. Try a smaller amount.</Trans>;
    case 'no-liquidity':
      return <Trans>Not enough liquidity on the destination for this amount. Try a smaller amount.</Trans>;
    case 'facts-error':
      return <Trans>We couldn&apos;t check this route. Try again in a moment.</Trans>;
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
  const onBridged = () => {
    form.refetchBalances();
    form.reset();
  };
  const { launch, locked, restore } = useBridgeLaunch(form, onBridged);
  const launchOrConnect = useConnectThenAct(launch);
  const {
    launch: launchAction,
    launchIn: launchActionIn,
    canLaunch: canLaunchAction,
    actionHint,
    locked: actionLocked
  } = useDestinationActionLaunch();
  const { launch: continueBridge } = useCctpResumeLaunch(onBridged);

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
        ) : form.sourceUnavailable ? (
          <Text className="text-error text-sm" dataTestId="bridge-source-unavailable">
            <Trans>Bridging from this network isn&apos;t available yet.</Trans>
          </Text>
        ) : form.balanceUnknown ? (
          <Text className="text-error text-sm" dataTestId="bridge-balance-unknown">
            <Trans>We couldn&apos;t load your USDS balance. Try again in a moment.</Trans>
          </Text>
        ) : form.insufficient ? (
          <Text className="text-error text-sm" dataTestId="bridge-error">
            <Trans>Insufficient funds</Trans>
          </Text>
        ) : form.blockedReason && form.blockedReason !== 'facts-loading' ? (
          <Text className="text-error text-sm" dataTestId="bridge-blocked">
            <BlockedMessage reason={form.blockedReason} />
          </Text>
        ) : form.safeCheckFailed ? (
          <Text className="text-error text-sm" dataTestId="bridge-safe-unknown">
            <Trans>We couldn&apos;t check your wallet type. Try again in a moment.</Trans>
          </Text>
        ) : form.recipientInvalid ? (
          <Text className="text-error text-sm" dataTestId="bridge-recipient-invalid">
            <Trans>The recipient address doesn&apos;t match the destination network. Change it.</Trans>
          </Text>
        ) : form.recipientProblem ? (
          !form.recipientChecking && (
            <Text className="text-error text-sm" dataTestId="bridge-recipient-blocked">
              <RecipientProblemMessage problem={form.recipientProblem} />
            </Text>
          )
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

      <PendingBridges
        onAction={launchAction}
        onActionIn={launchActionIn}
        canAction={canLaunchAction}
        actionHint={actionHint}
        actionLocked={actionLocked}
        onContinue={continueBridge}
      />

      <CctpClaimLookup />
    </div>
  );
}
