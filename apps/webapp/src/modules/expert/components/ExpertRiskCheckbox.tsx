import { Trans } from '@lingui/react/macro';
import { AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/modules/layout/components/Typography';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';

export function ExpertRiskCheckbox() {
  const { expertRiskAcknowledged, setExpertRiskAcknowledged } = useConfigContext();

  return (
    <div className="mb-4">
      <div className="mb-2 flex gap-2">
        <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-yellow-500" />
        <Text variant="medium" className="text-text" dataTestId="expert-risk-disclaimer">
          <Trans>
            These modules carry higher risk and are intended for experienced users. Please review and
            understand the risks before continuing.
          </Trans>
        </Text>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="risk-acknowledgment"
          checked={expertRiskAcknowledged}
          onCheckedChange={checked => setExpertRiskAcknowledged(!!checked)}
          data-testid="expert-risk-checkbox"
        />
        <label htmlFor="risk-acknowledgment" className="cursor-pointer">
          <Text variant="medium" className="text-text">
            <Trans>I understand and accept the associated risks.</Trans>
          </Text>
        </label>
      </div>
    </div>
  );
}
