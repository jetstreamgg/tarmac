import { useConnect, useConnection } from 'wagmi';
import { createPortal } from 'react-dom';
import { mockWagmiConfig } from '@/data/wagmi/config/config.e2e';
import { JSX } from 'react';

// Dev/e2e-only. The mock buttons don't fit the mobile Topbar (M2), so below
// the desktop tier they float above the bottom Navbar instead; they stay
// visible and clickable there for Playwright's text selectors.
const mockButtonClasses =
  'max-w-40 truncate rounded-lg bg-white px-2 py-1 text-xs text-black desktop:max-w-none desktop:px-4 desktop:py-2 desktop:text-sm';

export function MockConnectButton(): JSX.Element {
  const { connect } = useConnect();
  const { isConnected, address } = useConnection();

  const buttons = !isConnected ? (
    <>
      <button
        className={mockButtonClasses}
        onClick={() =>
          connect({
            connector: mockWagmiConfig.connectors[0]
          })
        }
      >
        {'Connect Mock Wallet'}
      </button>
      <button
        className={mockButtonClasses}
        onClick={() =>
          connect({
            connector: mockWagmiConfig.connectors[1]
          })
        }
      >
        {'Connect Batch Mock Wallet'}
      </button>
    </>
  ) : (
    <button className={mockButtonClasses}>{address}</button>
  );

  // Two mounts, one visible per tier (display:none keeps the hidden copy out
  // of role queries). The mobile float is portaled to body because its natural
  // parent — the frosted header bar — carries a backdrop-filter, which makes
  // the bar the containing block for fixed descendants: `bottom-28` would
  // resolve against the ~72px bar and park the buttons above the viewport.
  return (
    <>
      <div className="desktop:flex hidden flex-row items-center gap-3">{buttons}</div>
      {createPortal(
        <div className="desktop:hidden fixed right-3 bottom-28 z-40 flex flex-col items-end gap-1">
          {buttons}
        </div>,
        document.body
      )}
    </>
  );
}
