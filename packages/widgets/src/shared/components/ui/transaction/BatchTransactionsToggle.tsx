import { Toggle } from '@widgets/components/ui/toggle';
import { Zap } from '../../icons/Icons';

export function BatchTransactionsToggle({
  batchEnabled,
  setBatchEnabled
}: {
  batchEnabled: boolean;
  setBatchEnabled: (enabled: boolean) => void;
}) {
  const handleToggle = (checked: boolean) => {
    setBatchEnabled(checked);
  };

  return (
    <Toggle
      variant="singleSwitcher"
      className="hidden h-10 w-10 rounded-xl p-0 md:flex"
      pressed={batchEnabled}
      onPressedChange={handleToggle}
      aria-label="Toggle details"
    >
      <Zap width={28} height={28} background={false} />
    </Toggle>
  );
}
