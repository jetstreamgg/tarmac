# Sky Ecosystem Hooks

## Installation

```
npm install @jetstreamgg/sky-hooks
```

## Example Usage

```tsx
import { useRestrictedAddressCheck } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useRestrictedAddressCheck({
    address: '0x123...',
    authUrl: 'https://auth.example.com',
    enabled: true
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{data?.addressAllowed ? 'Address is allowed' : 'Address is not allowed'}</div>;
}
```

## Hook Types

Hooks in this package can be categorized into two main types: `ReadHook` and `WriteHook`.

### ReadHook

A `ReadHook` is used for fetching and reading data. It typically includes the following properties:

- `error`: `Error | null`
  - Any error that occurred during the data fetching process.
- `isLoading`: `boolean`
  - Indicates whether the data is currently being loaded.
- `mutate`: `() => void`
  - A function to trigger a re-fetch of the data.
- `dataSources`: `DataSource[]`
  - An array of data sources used in the hook.

### WriteHook

A `WriteHook` is used for writing or mutating data. It typically includes the following properties:

- `data`: `WriteContractReturnType | undefined`
  - The response data from the write operation.
- `error`: `Error | null`
  - Any error that occurred during the write operation.
- `isLoading`: `boolean`
  - Indicates whether the write operation is currently in progress.
- `execute`: `() => void`
  - A function to execute the write operation.
- `retryPrepare`: `() => void`
  - A function to retry the preparation of the write operation.
- `prepareError`: `Error | SimulateContractErrorType | null`
  - Any error that occurred during the preparation of the write operation.
- `prepared`: `boolean`
  - Indicates whether the write operation is prepared and ready to be executed.

## Available Hooks

### Authentication

- [useRestrictedAddressCheck](./src/authentication/useRestrictedAddressCheck.md): Hook for checking if an address is restricted based on certain criteria.
- [useVpnCheck](./src/authentication/useVpnCheck.md): Hook for checking if a user is connected via a VPN.

### Blocks

- [useBlocksFromTimestamps](./src/blocks/useBlocksFromTimestamps.md): Hook for fetching block entities for a given array of timestamps.

### Delegates

- [useDelegates](./src/delegates/useDelegates.md): Hook for fetching delegate information based on various parameters.
- [useUserDelegates](./src/delegates/useUserDelegates.md): Hook for fetching user-specific delegate information based on various parameters.

### Decentralized Storage

- [useIpfsStorage](./src/storage/useIpfsStorage.md): Hook for interacting with IPFS storage.
- [useEnsContent](./src/storage/useEnsContent.md): Hook for fetching content from ENS domains.

### DSProxy

- [useDsProxyData](./src/dsProxy/useDsProxyData.md): Hook for fetching DS Proxy data for a given owner address.
- [useDsProxyBuild](./src/dsProxy/useDsProxyBuild.md): Hook for building a DS Proxy for a given account.

### Rewards

- [useAvailableTokenRewardContracts](./src/rewards/useAvailableTokenRewardContracts.md): Hook for fetching available token reward contracts.
- [useRewardContractInfo](./src/rewards/useRewardContractInfo.md): Hook for fetching information about a specific reward contract.
- [useRewardContractsInfo](./src/rewards/useRewardContractsInfo.md): Hook for fetching information about multiple reward contracts.
- [useRewardUserHistory](./src/rewards/useRewardUserHistory.md): Hook for fetching a user's history with a specific reward contract.
- [useAllRewardsUserHistory](./src/rewards/useAllRewardsUserHistory.md): Hook for fetching a user's history with all reward contracts.
- [useRewardChartInfo](./src/rewards/useRewardChartInfo.md): Hook for fetching chart information for a specific reward contract.
- [useRewardContractTokens](./src/rewards/useRewardContractTokens.md): Hook for fetching tokens associated with a specific reward contract.
- [useUserRewardsBalance](./src/rewards/useUserRewardsBalance.md): Hook for fetching rewards data for a specific reward contract.

### Seal Module

- useOpenUrn
- useCurrentUrnIndex
- useUrnAddress
- useSelectRewardContract
- useSelectVoteDelegate
- useUrnSelectedRewardContract
- useUrnSelectedVoteDelegate
- useLockMkr
- useLockSky
- useFreeMkr
- useFreeSky
- useSaMkrAllowance
- useSaNgtAllowance
- useSaNstAllowance
- useSaMkrApprove
- useSaNgtApprove
- useSaNstApprove
- useClaimRewards
- useDrawUsds
- useSaMulticall
- useUrnsInfo
- useWipe
- useWipeAll
- useSaUserDelegates
- useSaRewardContracts

### Oracles

- [useOracle](./src/oracles/useOracle.md): Hook for fetching data from a specific oracle.
- [useOracles](./src/oracles/useOracles.md): Hook for fetching data from multiple oracles.

### Prices

- [usePrices](./src/prices/usePrices.md): Hook for fetching token price data from the BA Labs API.
- [useLsMkrPrice](./src/prices/useLsMkrPrice.md): Hook for fetching the price of the Lockstake MKR token from the Sky Ecosystem contracts.

### Savings

- [useSavingsData](./src/savings/useSavingsData.md): Hook for fetching and managing savings data.
- [useSavingsSupply](./src/savings/useSavingsSupply.md): Hook for supplying into the savings contract.
- [useSavingsWithdraw](./src/savings/useSavingsWithdraw.md): Hook for withdrawing from the savings contract.
- [useSavingsAllowance](./src/savings/useSavingsAllowance.md): Hook for checking the savings contract allowance.
- [useSavingsApprove](./src/savings/useSavingsApprove.md): Hook for approving the savings contract.
- [useSavingsHistory](./src/savings/useSavingsHistory.md): Hook for fetching the savings contract transaction history.
- [useSavingsChartInfo](./src/savings/useSavingsChartInfo.md): Hook for fetching and transforming the savings chart information from the BA Labs API.
- [useReadSavingsUsds](./src/savings/useReadSavingsUsds.md): Hook for reading data from the Savings USDS contract using the proxy address and implementation ABI.
- [useTotalSavingsSuppliers](./src/savings/useTotalSavingsSuppliers.md): Hook for fetching the total number of unique suppliers in the savings contract.

### Shared

- useCombinedHistory
- useUsdsDaiData

### Rewards

- useRewardsSupply
- useRewardsWithdraw
- useRewardsClaim
- useRewardsRewardsBalance
- useRewardsSuppliedBalance
- useRewardsTotalSupplied
- useRewardsRate
- useRewardsPeriodFinish

### Trade

- useTradeHistory
- useQuoteTrade
- useSignAndCreateTradeOrder
- useTradeAllowance
- useTradeApprove
- useTradeCosts

### Tokens

- useTokenAllowance
- useApproveToken
- useTokens
- useTokenBalance
- useTokenBalances
- useTokenChartInfo

### Upgrade

- useUsdsToDai
- useDaiToUsds
- useMkrToSky
- useSkyToMkr
- useMkrToSkyApprove
- useDaiUsdsApprove
- useUpgradeHistory
- useUpgradeTotals

### Vaults

- useVault
- useCollateralData
- useSimulatedVault

## Running tests

Testing the hooks package involves the following steps:

1. Forking and deleting a virtual network (vnet).
2. Modifying the Wagmi configuration to use the Tenderly chain instead of the hardhat network in the hooks package.
3. Adding evm_snapshot and evm_revert calls before and after each test to ensure consistent network conditions for each test. A gas parameter is added to write hooks to allow passing a custom gas value for tests.

To run these tests locally, follow the steps below:

1. Ensure you are running Node.js v20.6.0 or higher as it supports environment files when running node scripts.

2. Create a .env file at the root of the project and add the Tenderly API key to it. You can find the working key in Bitwarden.

3. Run the test coverage command from the project's root directory:

```

pnpm test:coverage

```

This command will:

- Execute the script that forks the vnet and store the newly created vnet's ID and RPC url in the `./tenderlyTestnetData.json` file (which is gitignored).
- Run the testing suite.
- Execute the script that deletes the new vnet, using the vnet ID stored in the `./tenderlyTestnetData.json` file.

Please note that the values for tests have been adjusted to match the new network conditions.

#### Node version

Please ensure you are using Node.js version 20.6.0 or higher to execute the tests accurately. If you need to manage multiple Node.js versions, we recommend using nvm (Node Version Manager).

## Contracts

This package contains files with the contract addresses used by the hooks. The contracts have addresses for mainnet and tenderly vnet, when applicable.

You can access the address in several ways, for example with a chain ID:

```

const chainId = useChainId();

const address = mcdVatAddress[chainId];

```

or by the contract itself:

```

const contract = getMcdVat(chainId);

const address = contract.address;

```

### Wagmi CLI

We use the [Wagmi CLI](https://wagmi.sh/cli/getting-started) to generate hooks primitives that can be composed to create more complex hooks.

### Adding new contracts

Use the Wagmi CLI to generate the types for the contracts and fetch the lates ABI from Etherscan.

You will need to have `@wagmi/cli` installed globally.

```

npm install -g @wagmi/cli

```

Please, add the environment variable: `ETHERSCAN_V2_API_KEY` with your Etherscan v2 API key.
This is used to fetch the latest ABI from Etherscan and create the contracts file.

To generate the contracts file, run:

```

wagmi generate

```

or alternatively:

```

pnpm -F hooks generate

```

The settings are defined on the `wagmi.config.ts` file.

For more information, please, check the [wagmi documentation](https://wagmi.sh/cli/getting-started).

## Adding New Rewards

First add the relevant contract addresses to the contracts file (eg `contracts.ts`). For example you may have up to 3 contracts to add:

1. The reward contract itself (eg. `rewardsMyReward`)
1. The reward token
1. The supply token

Note: the reward and supply tokens may already be added depending on the reward contract.

Then run the generate command, from the root, the command is:

```

pnpm -F hooks generate

```

This will add the new contracts to the `generated.ts` file so they can be used throughout the app.

Next, if you added new tokens you need to update the `TOKENS` constant with the new ones that were added. The file is located in `/tokens/tokens.constants.ts`. Update it with the following properties:

```js
usds: {
    address: nstConfig.address, // This address will now be available to import from generated.ts
    name: 'USDS',
    symbol: 'USDS',
    color: '#1AAB9B' // Choose a color value that can be used for accents in the frontend
  },
```

Finally, update the `useAvailableTokenRewardContracts` hook to return the reward contract address & associated tokens. The metadata is used in various places throughout the app.

```js
    {
        supplyToken: TOKENS.usds,
        rewardToken: TOKENS.sky,
        contractAddress: usdsSkyRewardAddress[chainId as keyof typeof usdsSkyRewardAddress],
        chainId: chainId,
        name: 'USDS/SKY',
        description: 'Supply USDS, get SKY',
        externalLink: 'https://usds.sky',
        logo: 'https://via.placeholder.com/400x400/04d19a/ffffff?text=SKY',
        featured: false
    },
```
