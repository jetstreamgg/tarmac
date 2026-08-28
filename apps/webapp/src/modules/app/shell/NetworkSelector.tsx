import { NetworkFilterSelect } from '@/components/product/NetworkFilterSelect';

/**
 * Drawer-embedded network control. This used to be a `ChainModal` — the app's
 * one global chain *switcher*. It is now the app-wide network *filter*, the
 * same control (and the same value) the Portfolio header, the transactions
 * toolbar and the Earn toolbar carry, and the drawer's asset total follows it.
 * Switching the connected chain is contextual now: a product page or a
 * transaction modal, where a chain actually decides something.
 */
export function NetworkSelector({ compact = false }: { compact?: boolean }) {
  // The M4.6 mobile panel pairs the 32px total with the smaller pill.
  //
  // The pill sits on the header's brand gradient, which is dark in both themes,
  // so its label and chevron take fg-text-consistent-light (Figma 1030:138802)
  // rather than the Dropdown variant's theme-following text-text — that one
  // flips to the dark #2f2d40 in light mode and all but disappears here.
  //
  // It wears the Portfolio header's treatment — the overlapped chain discs on
  // the "All networks" label rather than the toolbars' globe. The two are the
  // page-level statements of the same filter; the globe belongs to the table
  // toolbars, where it reads as one of a row of three domain filters.
  return (
    <NetworkFilterSelect
      testId="wallet-drawer-network"
      size={compact ? 's' : 'm'}
      allLabelStyle="stack"
      triggerClassName="text-fgConsistent [&>svg]:text-fgConsistent"
    />
  );
}
