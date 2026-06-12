import { ChainModal } from '@/modules/ui/components/ChainModal';

/** Drawer-embedded network control. Presentation wrapper only — switching logic stays in ChainModal. */
export function NetworkSelector() {
  return <ChainModal dataTestId="wallet-drawer-network" />;
}
