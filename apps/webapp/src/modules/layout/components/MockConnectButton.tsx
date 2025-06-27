import { useConnect, useAccount } from 'wagmi';
import { mockWagmiConfig } from '@/data/wagmi/config/config.e2e';
import { JSX } from 'react';

export function MockConnectButton(): JSX.Element {
  const { connect } = useConnect();
  const { isConnected, address } = useAccount();

  return (
    <button
      className="rounded-lg bg-white px-4 py-2"
      onClick={() =>
        connect({
          connector: mockWagmiConfig.connectors[0]
        })
      }
    >
      {isConnected ? address : 'Connect Mock Wallet'}
    </button>
  );
}
