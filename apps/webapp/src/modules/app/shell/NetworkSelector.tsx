import { ChainModal } from '@/modules/ui/components/ChainModal';

/** Drawer-embedded network control. Presentation wrapper only — switching logic stays in ChainModal. */
export function NetworkSelector({ compact = false }: { compact?: boolean }) {
  // The M4.6 mobile panel pairs the 32px total with the DS Network XS pill.
  //
  // The pill sits on the header's brand gradient, which is dark in both themes,
  // so its label and chevron take fg-text-consistent-light (Figma 1030:138802)
  // rather than the Dropdown variant's theme-following text-text — that one
  // flips to the dark #2f2d40 in light mode and all but disappears here.
  return (
    <ChainModal
      dataTestId="wallet-drawer-network"
      size={compact ? 'xs' : 'm'}
      triggerClassName="text-fgConsistent"
      labelClassName="text-fgConsistent"
    />
  );
}
