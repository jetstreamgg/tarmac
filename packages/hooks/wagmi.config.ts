import { defineConfig, loadEnv } from '@wagmi/cli';
import { etherscan, /*fetch as fetchPlugin,*/ react } from '@wagmi/cli/plugins';
import { mainnet, sepolia, base } from 'wagmi/chains';

import { contracts, /*tenderlyContracts,*/ sepoliaContracts, l2Contracts } from './src';

export default defineConfig(() => {
  const hookNames: string[] = [];

  const env = loadEnv({
    mode: process.env.NODE_ENV,
    envDir: process.cwd()
  });
  return {
    out: 'src/generated.ts',
    plugins: [
      react({
        getHookName({ contractName, itemName, type }) {
          const formattedType = type.slice(0, 1).toUpperCase() + type.slice(1);
          const hookName = `use${formattedType}${contractName}${itemName || ''}`;

          // Workaround to fix error caused by duplicate hook names
          if (hookNames.includes(hookName)) {
            return (hookName + '_2') as `use${string}`;
          } else {
            hookNames.push(hookName);
            return hookName as `use${string}`;
          }
        }
      }),
      // The etherscan plugin fetches ABIs for contracts which have a mainnet deployment
      etherscan({
        apiKey: env.ETHERSCAN_V2_API_KEY,
        chainId: mainnet.id,
        contracts: contracts
      }),
      // This etherscan plugin fetches ABIs for contracts which have a sepolia deployment
      etherscan({
        apiKey: env.ETHERSCAN_V2_API_KEY,
        chainId: sepolia.id,
        contracts: sepoliaContracts
      }),
      // This etherscan plugin fetches ABIs for L2 contracts which have a base deployment
      etherscan({
        apiKey: env.ETHERSCAN_V2_API_KEY,
        chainId: base.id,
        contracts: l2Contracts
      })
      // // This fetch plugin fetches ABIs for contracts deployed on the tenderly testnet
      // fetchPlugin({
      //   contracts: tenderlyContracts,
      //   request(contract) {
      //     if (!contract.address) throw new Error('address is required');
      //     const address =
      //       typeof contract.address === 'string' ? contract.address : Object.values(contract.address)[0];

      //     return {
      //       url: `https://api.tenderly.co/api/v1/account/pullup-labs/project/endgame-0/testnet/c8bf3399-e510-4836-9ab1-4112e8b93aad/verified-contract/${address}`,
      //       init: {
      //         headers: {
      //           'Content-Type': 'application/json',
      //           'X-Access-Key': `${env.TENDERLY_API_KEY}`
      //         }
      //       }
      //     };
      //   },
      //   async parse({ response }) {
      //     const json = await response.json();
      //     if (json.status === '0') throw new Error(json.message);
      //     return json.data.raw_abi;
      //   }
      // })
    ]
  };
});
