import { useConnect, useConnection } from 'wagmi';
import { mockWagmiConfig } from '@/data/wagmi/config/config.e2e';
import { JSX } from 'react';

export function MockConnectButton(): JSX.Element {
  const { connect } = useConnect();
  const { isConnected, address } = useConnection();

  return (
    <>
      {!isConnected ? (
        <>
          <button
            className="rounded-lg bg-white px-4 py-2"
            onClick={() =>
              connect({
                connector: mockWagmiConfig.connectors[0]
              })
            }
          >
            {'Connect Mock Wallet'}
          </button>
          <button
            className="rounded-lg bg-white px-4 py-2"
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
        <button className="rounded-lg bg-white px-4 py-2">{address}</button>
      )}
    </>
  );
}
