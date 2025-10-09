import { defineConfig, loadEnv } from '@wagmi/cli';
import { etherscan, /*fetch as fetchPlugin,*/ react } from '@wagmi/cli/plugins';
import { mainnet, base } from 'wagmi/chains';

// --- Add imports for your local ABI files here ---
// import LockstakeEngineAbi from './abis/LockstakeEngine.json';
// import LockstakeMigratorAbi from './abis/LockstakeMigrator.json';
// import LockstakeSkyAbi from './abis/LockstakeSky.json';
// --- End ABI imports ---

import { contracts, /*tenderlyContracts,*/ l2Contracts } from './src';

export default defineConfig(() => {
  const hookNames: string[] = [];

  const env = loadEnv({
    mode: process.env.NODE_ENV,
    envDir: process.cwd()
  });
  return {
    out: 'src/generated.ts',
    // --- Local contracts ---
    // contracts: [
    //   {
    //     name: 'stakeModule',
    //     abi: LockstakeEngineAbi.abi as any
    //   },
    //   {
    //     name: 'lsMigrator',
    //     abi: LockstakeMigratorAbi.abi as any
    //   },
    //   {
    //     name: 'lsSky',
    //     abi: LockstakeSkyAbi.abi as any
    //   }
    // ],
    // --- End local contracts ---
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
        contracts
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

      //     console.log('Fetching contract:', contract.name, '--', address);

      //     return {
      //       url: `https://api.tenderly.co/api/v1/account/pullup-labs/project/endgame-0/testnet/da404f7a-d40d-4c75-928f-308835f9e0e3/verified-contract/${address}`,
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
