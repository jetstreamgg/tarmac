import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';

export function PsmConversionHistory() {
  return (
    <Text className="text-textSecondary" variant="small">
      {t`No 1:1 Conversion transactions found yet.`}
    </Text>
  );
}
