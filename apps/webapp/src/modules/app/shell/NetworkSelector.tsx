import { ChainModal } from '@/modules/ui/components/ChainModal';

/** Drawer-embedded network control. Presentation wrapper only — switching logic stays in ChainModal. */
export function NetworkSelector({ compact = false }: { compact?: boolean }) {
  // The M4.6 mobile panel pairs the 32px total with the DS Network XS pill.
  return <ChainModal dataTestId="wallet-drawer-network" size={compact ? 'xs' : 'm'} />;
}
