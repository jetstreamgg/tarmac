import { useConnect, useConnection } from 'wagmi';
import { mockWagmiConfig } from '@/data/wagmi/config/config.e2e';
import { JSX } from 'react';

// Dev/e2e-only. The mock buttons don't fit the mobile Topbar (M2), so below
// the desktop tier they float above the bottom Navbar instead; they stay
// visible and clickable there for Playwright's text selectors.
const mockButtonClasses =
  'max-w-40 truncate rounded-lg bg-white px-2 py-1 text-xs desktop:max-w-none desktop:px-4 desktop:py-2 desktop:text-sm';

export function MockConnectButton(): JSX.Element {
  const { connect } = useConnect();
  const { isConnected, address } = useConnection();

  return (
    <div className="desktop:static desktop:flex-row desktop:items-center desktop:gap-3 fixed right-3 bottom-28 z-40 flex flex-col items-end gap-1">
      {!isConnected ? (
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
      )}
    </div>
  );
}
