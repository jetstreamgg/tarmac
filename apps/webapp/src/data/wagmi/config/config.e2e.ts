import { http } from 'viem';
import { createConfig } from 'wagmi';
import { getTestTenderlyChains } from './testTenderlyChain';
import { mock } from 'wagmi/connectors';

const [tenderlyMainnet, tenderlyBase, tenderlyArbitrum] = getTestTenderlyChains();

//this address is able to send transactions on the tenderly vnet via the wagmi mock
const TEST_WALLET_ADDRESS = '0xFebC63589D8a3bc5CD97E86C174A836c9caa6DEe';

export const mockWagmiConfig = createConfig({
  chains: [tenderlyMainnet, tenderlyBase, tenderlyArbitrum],
  connectors: [
    mock({
      accounts: [TEST_WALLET_ADDRESS],
      features: {
        reconnect: true
      }
    })
  ],
  transports: {
    [tenderlyMainnet.id]: http(),
    [tenderlyBase.id]: http(),
    [tenderlyArbitrum.id]: http()
  }
});
