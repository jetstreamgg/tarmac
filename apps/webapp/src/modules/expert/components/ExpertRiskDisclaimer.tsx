import { AlertTriangle, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { useState } from 'react';

const DISCLAIMER_DISMISSED_KEY = 'expert-risk-disclaimer-dismissed';

export function ExpertRiskDisclaimer() {
  const [expertRiskDisclaimerDismissed, setExpertRiskDisclaimerDismissed] = useState(
    window.localStorage.getItem(DISCLAIMER_DISMISSED_KEY) === 'true'
  );

  const { setExpertRiskDisclaimerShown, expertRiskDisclaimerShown } = useConfigContext();

  // Set the disclaimer as shown during render if not already set
  // This avoids race conditions with useEffect
  if (!expertRiskDisclaimerShown) {
    setExpertRiskDisclaimerShown(true);
  }

  const onDismissDisclaimer = () => {
    window.localStorage.setItem(DISCLAIMER_DISMISSED_KEY, 'true');
    setExpertRiskDisclaimerShown(true);
    setExpertRiskDisclaimerDismissed(true);
  };

  if (expertRiskDisclaimerDismissed) return null;

  return (
    <Card className="relative bg-black/65 p-5">
      <button
        onClick={onDismissDisclaimer}
        className="text-textSecondary hover:text-text absolute right-4 top-4 transition-colors"
        aria-label="Dismiss risk warning"
        data-testid="expert-risk-dismiss"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="pr-8">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
          <div className="flex-1">
            <Text variant="medium" dataTestId="expert-risk-disclaimer">
              Expert modules are intended for experienced users and may function differently than modules to
              which ordinary users are accustomed. Please be sure you understand the unique features and the
              associated risks of any Expert Module before proceeding. Be sure to review the FAQs and{' '}
              <ExternalLink
                href="https://docs.sky.money/user-risks"
                showIcon={false}
                className="text-textEmphasis"
              >
                User Risks
              </ExternalLink>
              .
            </Text>
          </div>
        </div>
      </div>
    </Card>
  );
}
