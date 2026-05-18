import { Toggle } from '@/widgets/components/ui/toggle';
import { Zap } from '../../icons/Icons';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';

export function BatchTransactionsToggle() {
  const [batchEnabled, setBatchEnabled] = useBatchToggle();

  return (
    <Toggle
      variant="singleSwitcher"
      className="hidden h-10 w-10 rounded-xl p-0 md:flex"
      pressed={batchEnabled}
      onPressedChange={setBatchEnabled}
      aria-label="Toggle details"
    >
      <Zap width={28} height={28} background={false} />
    </Toggle>
  );
}
