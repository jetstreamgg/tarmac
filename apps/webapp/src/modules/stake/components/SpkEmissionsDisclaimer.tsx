import { ModuleDisclaimer } from '@/modules/ui/components/ModuleDisclaimer';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { Text } from '@/modules/layout/components/Typography';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';

const GOVERNANCE_PROPOSAL_URL =
  'https://vote.sky.money/executive/template-executive-vote-reduce-rewards-emissions-complete-guni-vault-offboardings-whitelist-keel-subproxy-to-send-cross-chain-messages-adjust-grove-dc-iam-parameters-delegate-compensation-star-agent-proxy-spells-january-15-2026';

export function SpkEmissionsDisclaimer() {
  const { spkEmissionsDisclaimerDismissed, setSpkEmissionsDisclaimerDismissed } = useConfigContext();

  return (
    <ModuleDisclaimer
      dataTestId="spk-emissions-disclaimer"
      dismissButtonTestId="spk-emissions-dismiss"
      type="info"
      text={
        <Text variant="medium">
          SPK reward emissions have been reduced via the latest{' '}
          <ExternalLink
            href={GOVERNANCE_PROPOSAL_URL}
            showIcon={false}
            className="text-textEmphasis underline"
          >
            governance proposal
          </ExternalLink>
          .
        </Text>
      }
      isDismissed={spkEmissionsDisclaimerDismissed}
      onDismiss={() => setSpkEmissionsDisclaimerDismissed(true)}
    />
  );
}
