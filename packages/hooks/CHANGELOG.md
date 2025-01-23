# @jetstreamgg/hooks

## 3.2.1

### Patch Changes

- 9875ab3: fix trade_tokens decimal inconsistency
- 9875ab3: account for new ilk.rate

## 3.2.0

### Minor Changes

- 28638b0: Deps updates: major versions, Vite, Lingui, Vitest

### Patch Changes

- Updated dependencies [28638b0]
  - @jetstreamgg/utils@2.2.0

## 3.1.14

### Patch Changes

- e83e99d: add debt ceiling check to the seal widget
- Updated dependencies [e83e99d]
  - @jetstreamgg/utils@2.1.7

## 3.1.13

### Patch Changes

- cdbe578: Dependency updates
- Updated dependencies [a46d912]
  - @jetstreamgg/utils@2.1.6

## 3.1.12

### Patch Changes

- 57061ca: add rounding for decimals to the base trade widget
- Updated dependencies [57061ca]
  - @jetstreamgg/utils@2.1.5

## 3.1.11

### Patch Changes

- e000abd: fix for fixed susds output trade
- Updated dependencies [97f48aa]
- Updated dependencies [e000abd]
  - @jetstreamgg/utils@2.1.4

## 3.1.10

### Patch Changes

- c27a0eb: add a usePsmLiquidity hook
- 3f845a5: use the previewSwap functions from the psm
- f911234: Add referralCode to the necessary widgets and hooks

## 3.1.9

### Patch Changes

- 4ca94c6: add sUsds to balances widget, don't always exclude sUsds from base trade history
- f45b465: Update savings chart data hook to use correct total TVL value
- e1f5e7a: fix useSavingsData nstBalance on base

## 3.1.8

### Patch Changes

- ca87f6f: Add savings TVL to overall data hook
- 3e1c4b5: update ethereum savings history to include token

## 3.1.7

### Patch Changes

- Updated dependencies [fd126c3]
  - @jetstreamgg/utils@2.1.3

## 3.1.6

### Patch Changes

- 48883bd: history updates

## 3.1.5

### Patch Changes

- eb222fd: Add Tenderly Base chain to Base contracts

## 3.1.4

### Patch Changes

- 753f3cf: Add Basescan link and use dynamic name'
- 753f3cf: Add config for base networks
- 753f3cf: Add PSM hooks
- Updated dependencies [753f3cf]
  - @jetstreamgg/utils@2.1.2

## 3.1.3

### Patch Changes

- 6e428c4: Add Basescan link and use dynamic name'
- 6e428c4: Add config for base networks
- 6e428c4: add base support for trade widget
- 6e428c4: Add PSM hooks
- Updated dependencies [6e428c4]
- Updated dependencies [6e428c4]
  - @jetstreamgg/utils@2.1.1

## 3.1.2

### Patch Changes

- 163606a: add liquidationRatio to simulatedVault

## 3.1.1

### Patch Changes

- 64e1983: dust check fix in seal

## 3.1.0

### Minor Changes

- 03b4329: Add SKY to Seal engine

### Patch Changes

- Updated dependencies [03b4329]
  - @jetstreamgg/utils@2.1.0

## 3.0.41

### Patch Changes

- 7413772: Refactor risk slider logic to hook, add max borrow data point

## 3.0.40

### Patch Changes

- b812280: Remove refCode from savings supply hook to save gas

## 3.0.39

### Patch Changes

- a18529a: fixes a false positive error

## 3.0.38

### Patch Changes

- 2a9df12: Check for Safe wallet transaction hashes

## 3.0.37

### Patch Changes

- 0b1a463: fix SRR text

## 3.0.36

### Patch Changes

- 41b648a: Allow the useSealHistory to filter by urn index

## 3.0.35

### Patch Changes

- 54a6916: Add min collateral amount for dust to the useSimulatedVault hook
- 54a6916: Add min collateral amount for dust to the useSimulatedVault hook and the associated widget

## 3.0.34

### Patch Changes

- 5490ee8: Update mainnet ilk name value
- 7ee0297: Fix issue in seal history hook that threw an error when selected delegate was null

## 3.0.33

### Patch Changes

- 72e413f: Fix logic routing and copy for approve and repay flow
- b362787: Add mainnet merkle distributor contract

## 3.0.32

### Patch Changes

- a576424: Add P1C mainnet contracts

## 3.0.31

### Patch Changes

- 2797519: Fix logic routing and copy for approve and repay flow

## 3.0.30

### Patch Changes

- a7be775: improve sealed activation inputs
- d1803b7: Update calculations in useSimulatedVault

## 3.0.29

### Patch Changes

- 596e1f9: Add historic seal data hook

## 3.0.28

### Patch Changes

- 1328ffa: Add supplied assets cards to balances widget
- 5da96e2: Add liquidation link

## 3.0.27

### Patch Changes

- 0b10130: Add rewards claiming flow to seal module
- d6d5107: add delegate metadata and jazzicons

## 3.0.26

### Patch Changes

- b260acd: Fix onSealUrnChange callback

## 3.0.25

### Patch Changes

- 9334469: Add hook to get the list of positions that are at risk of liquidation
- bd1fa4b: Move boosted rewards claim flow to rewards module
- 5527c5e: Update packages and fix peer deps issues
- dac8e75: Add hooks to fetch and claim boosted rewards
- bc97bb9: Add delegate info
- dac8e75: Add boosted rewards claim flow to widget
- 35e7567: only fetch v2 hooks for seal module
- Updated dependencies [5527c5e]
  - @jetstreamgg/utils@2.0.6

## 3.0.24

### Patch Changes

- 877de887: Add the double token input for the Seal module'

## 3.0.23

### Patch Changes

- d8bd94f5: Fetch Seal module exit fee from contract
- 2353b92a: Update Tenderly testnet
- Updated dependencies [d8bd94f5]
- Updated dependencies [2353b92a]
  - @jetstreamgg/utils@2.0.5

## 3.0.22

### Patch Changes

- 6be44a86: store calldata and use for multicall transaction in seal module
- 0de48ec2: update namings
- Updated dependencies [0de48ec2]
  - @jetstreamgg/utils@2.0.4

## 3.0.21

### Patch Changes

- 4a37604c: Export seal module contract address
- 5d218a92: Add Seal module history hook
- 9b755b6c: Add hook to fetch details about a single Seal module position

## 3.0.20

### Patch Changes

- 3022e163: Make cost warning account for the relative fee amount
- 20e72b31: update seal module hooks
- Updated dependencies [20e72b31]
  - @jetstreamgg/utils@2.0.3

## 3.0.19

### Patch Changes

- 8de17349: Update default mainnet subgraph to prod

## 3.0.18

### Patch Changes

- 050b5611: Add savings suppliers count

## 3.0.17

### Patch Changes

- e113b47e: Add quote parameters needed for EthFlow orders
- Updated dependencies [17946103]
- Updated dependencies [86487184]
  - @jetstreamgg/utils@2.0.2

## 3.0.16

### Patch Changes

- b6f99f87: Add sUSDS trades back

## 3.0.15

### Patch Changes

- d226a303: Handle native cow price

## 3.0.14

### Patch Changes

- 71d118a6: handle scientific notation from ba labs

## 3.0.13

### Patch Changes

- 5fae7e40: Only provide gas for savings hooks in tenderly
- 40d93b8a: Fix trade history not showing all records on mainnet

## 3.0.12

### Patch Changes

- 8515cdb1: Update default token configs, subgraph URL

## 3.0.11

### Patch Changes

- 930a0945: Handle 0 totals, fix recent rate search
- 930a0945: Add mainnet contract addresses

## 3.0.10

### Patch Changes

- 51e2f4a2: Add mainnet contract addresses

## 3.0.9

### Patch Changes

- f589a6cc: Add optional prop for subgraph URL

## 3.0.8

### Patch Changes

- 75064841: add hook to get total number of ssr suppliers
- a7d4a49e: Add CoW Vault Relayer address for mainnet

## 3.0.7

### Patch Changes

- afafe6f2: Update savings rate source
- 376ca256: Fix typo in hooks README
- d355bff5: Add hook to fetch rewards data from endpoint
- Updated dependencies [afafe6f2]
  - @jetstreamgg/utils@2.0.1

## 3.0.6

### Patch Changes

- 57fa4a9b: Fix BA labs rewards endpoint URL

## 3.0.5

### Patch Changes

- 153e4d03: copy and chronicle updates
- 6b192f8d: Increase the gas used by the deposit and withdraw savings functions

## 3.0.4

### Patch Changes

- 1993d037: Update READMEs and fix tests

## 3.0.3

### Patch Changes

- 95aa2942: Update gql queries

## 3.0.2

### Patch Changes

- 4c83b9cd: Add slippage input validation and separate the slippage, one for each flow type

## 3.0.1

### Patch Changes

- 4e663978: Address trade QA items

## 3.0.0

### Major Changes

- 2a15c2e6: Update names and references

### Patch Changes

- Updated dependencies [2a15c2e6]
  - @jetstreamgg/utils@2.0.0

## 2.0.5

### Patch Changes

- 23023a17: Add powered by cowswap, update copy
- 23023a17: Fix native ETH trade

## 2.0.4

### Patch Changes

- 5585246a: Add powered by cowswap, update copy

## 2.0.3

### Patch Changes

- 7921f458: QA fixes, renaming, formatting

## 2.0.2

### Patch Changes

- 1a80af65: Balances, rewards, savings copy updates, other fixes

## 2.0.1

### Patch Changes

- d4e10cd9: Trade widget fixes
- 911be016: Update graphql upgrade queries
- f6ea91c5: Add customTokenList prop for wallet, unify Token type

## 2.0.0

### Major Changes

- e634d54f: Updates for new contracts, testnet

### Patch Changes

- Updated dependencies [e634d54f]
  - @jetstreamgg/utils@1.0.0

## 1.0.35

### Patch Changes

- 3010c0db: Use correct amounts in trade history
- Updated dependencies [3010c0db]
  - @jetstreamgg/utils@0.3.5

## 1.0.34

### Patch Changes

- 74605c5b: Add ETH trade flow
- Updated dependencies [74605c5b]
  - @jetstreamgg/utils@0.3.4

## 1.0.33

### Patch Changes

- e90fc9bf: Add cost warning
- a6def931: Add appData to trades
- 5e836810: Added support in useQuoteTrade for obtaining quotes independently of wallet connection status.
- beeb79e0: Add order cancellation

## 1.0.32

### Patch Changes

- 6a354234: Fixed issue in useQuoteTrade hook: Trade quote now correctly recalculates when slippage changes.
- cfb63a33: Set default subgraph, remove deprecated property
- e3649ccc: Use ba labs prices for trade
- 92ec19ae: Add hooks docs, rename useLockstakeMkrPrice

## 1.0.31

### Patch Changes

- 2b270644: Switch the trade widget to use the Cow protocol API instead of Unitrade

## 1.0.30

### Patch Changes

- 80911314: create changese4t
- 554c12bb: Switch the trade widget to use the Cow protocol API instead of Unitrade
- d882879d: add generated addresses
- Updated dependencies [80911314]
- Updated dependencies [d882879d]
  - @jetstreamgg/utils@0.3.3

## 1.0.30-beta.2

### Patch Changes

- add generated addresses
- Updated dependencies
  - @jetstreamgg/utils@0.3.3-beta.1

## 1.0.30-beta.1

### Patch Changes

- create changese4t
- Updated dependencies
  - @jetstreamgg/utils@0.3.3-beta.0

## 1.0.30-beta.0

### Patch Changes

- 554c12bb: Switch the trade widget to use the Cow protocol API instead of Unitrade

## 1.0.29

### Patch Changes

- 9ff03d39: Update subgraph URL

## 1.0.28

### Patch Changes

- da60597c: adds cron reward contract to available reward contracts and generated hooks
- c0f75af8: Add hook to fetch LSMKR on-chain price, and apply new styles to Sealed Activation reward contracts and delegate cards
- 5accdc82: Replace hosted service subgraphs for their decentralized versions

## 1.0.27

### Patch Changes

- c6bf7b09: Export risk level thresholds
- 1a4051f4: Implement new design for SA summary step
- a2679f69: add generate calldata file
- a2679f69: Add useDelegates, useUserDelegates and useSaUserDelegates hooks
- 11afd2f7: Add prices endpoint
- f7df6a13: Replace write contract flow for a hook to handle it
- a2679f69: add vault hooks
- Updated dependencies [a2679f69]
- Updated dependencies [11afd2f7]
- Updated dependencies [a2679f69]
  - @jetstreamgg/utils@0.3.2

## 1.0.26

### Patch Changes

- 4230ff5b: return null instead of undefined from queryFn

## 1.0.25

### Patch Changes

- ceb05f8e: Fix hooks return data types

## 1.0.24

### Patch Changes

- 5a44e890: Update SKY and SYD token names

## 1.0.23

### Patch Changes

- 384ac4a9: Update subgraph URL

## 1.0.22

### Patch Changes

- 689f0055: Add enabled prop to useQuotePoolTrade hook.
  Fix trade widget quotes.
- 2e16374c: Updates for new tenderly testnet
- Updated dependencies [2e16374c]
  - @jetstreamgg/utils@0.3.1

## 1.0.21

### Patch Changes

- 9838434d: fix token sort, remove sdai

## 1.0.20

### Patch Changes

- 13b13251: Add RewardChartInfoParsed type to exports

## 1.0.19

### Patch Changes

- 79521e98: Remove JSBI dependency and duplicate query clients
- 8fbc735a: better handle mainnet with ba labs endpoints

## 1.0.18

### Patch Changes

- 003dd353: Add new useRewardContractsInfo hook to retrieve multiple reward contracts data

## 1.0.17

### Patch Changes

- syncing versions

## 1.0.16

### Patch Changes

- bump packges past main

## 1.0.15

### Patch Changes

- bumping packages

## 1.0.14

### Patch Changes

- a6389564: add custom navigation to trade widget
- 94a9f8ec: "custom navigation beta"
- a779330f: debugging statements
- 23734022: changed some props

## 1.0.14-beta.3

### Patch Changes

- add custom navigation to trade widget

## 1.0.14-beta.2

### Patch Changes

- debugging statements

## 1.0.14-beta.1

### Patch Changes

- changed some props

## 1.0.14-beta.0

### Patch Changes

- "custom navigation beta"

## 1.0.15

### Patch Changes

- 9282b9cf: Remove gas estimation when quoting a trade

## 1.0.14

### Patch Changes

- c9374175: Fix bug that was preventing USDT transactions and approvals
- cd682df6: Create new lock file

## 1.0.13

### Patch Changes

- 7fcb2569: widget state callbacks

## 1.0.12

### Patch Changes

- c4ce738d: disable savings withdraw if 0 amount

## 1.0.11

### Patch Changes

- c6a1b14e: prevent connector not connected error

## 1.0.10

### Patch Changes

- 3dd9ff4e: add auth key to ba labs endpoint

## 1.0.10-beta.0

### Patch Changes

- 3dd9ff4e: add auth key to ba labs endpoint

## 1.0.9

### Patch Changes

- e2ffe349: return all errors in tx hooks
- e2ffe349: handle simulate errors better
- e2ffe349: add token allowance to validation for rewards supply hook"

## 1.0.8

### Patch Changes

- 64f75818: Add USDT, USDC to token list

## 1.0.7

### Patch Changes

- e0b4bc7b: return all errors in tx hooks

## 1.0.6

### Patch Changes

- dd292f1: Allow to use all available query options in useRestrictedAddressCheck

## 1.0.5

### Patch Changes

- 09aa82d: better handle tx reverting
- d5d615a: Extend ReadHookParams with UseQueryOptions; use refetchInterval instead of gcTime

## 1.0.4

### Patch Changes

- fbdfd7c: Add additional data points to reward chart hook

## 1.0.3

### Patch Changes

- 5526091: Add useTokenChartInfo

## 1.0.2

### Patch Changes

- be54210: add country code to useVpnCheck

## 1.0.1

### Patch Changes

- c5b9f44: Update endpoint URL

## 1.0.0

### Major Changes

- d11deae: Add sky dai data hook

### Patch Changes

- d11deae: Fix balance dispaly issues

## 0.4.2

### Patch Changes

- 034be71: Display warnings in the trade widget when the price impact for the trade is high

## 0.4.1

### Patch Changes

- 70c7d60: update subgraph url

## 0.4.0

### Minor Changes

- 8406103: Migrate trade hooks and widget from auto routing to pool routing

### Patch Changes

- e7f3ef8: Make trade addresses dependant on chain
- b9b5386: update subgraph url
- 12eda03: Remove mock data
- ef08a8b: minor history changes
- 98b33f2: Remove ethers v5 dependency
- d237ac2: Organize folder structure
- e2dbca2: Update wallet history and balances
- 6f3c671: Remove support for goerli and localhost chains
- Updated dependencies [98b33f2]
- Updated dependencies [8406103]
- Updated dependencies [e2dbca2]
- Updated dependencies [6f3c671]
  - @jetstreamgg/utils@0.3.0

## 0.3.12

### Patch Changes

- ac38687: Add module and type enums

## 0.3.11

### Patch Changes

- d164b94: Deprecate hooks package useChainId hook

## 0.3.10

### Patch Changes

- 18b262e: add useTokenBalances (2nd time)

## 0.3.9

### Patch Changes

- 6f3744f: revert useTokenBalances PR

## 0.3.8

### Patch Changes

- 31ead65: add useTokenBalances hook, use in wallet widget

## 0.3.7

### Patch Changes

- 7130dd1: Wallet styles, oracles updates

## 0.3.6

### Patch Changes

- fe178e7: fix upgrade totals

## 0.3.5

### Patch Changes

- 4093808: Add USD prices to token input selector
- 7564e44: Update tenderly subgraph URL

## 0.3.4

### Patch Changes

- 917951b: Rename project tokens and replace token icons

## 0.3.3

### Patch Changes

- dd9ceea: adds hook to fetch the savings assets data from BA labs

## 0.3.2

### Patch Changes

- 1ef7bdd: fetch from BA labs reward endpoint

## 0.3.1

### Patch Changes

- d9b9ff0: Export oracle data type

## 0.3.0

### Minor Changes

- 293591f: Adds oracle hooks with mock data

### Patch Changes

- 662e62e: Add tenderly network config

## 0.2.5

### Patch Changes

- d2041ea: TokenInput improvements

## 0.2.4

### Patch Changes

- 0ebf052: Add gas parameter to write hooks
- 584f35f: Update reward contracts info, add selected reward contract prop validation to rewards widget

## 0.2.3

### Patch Changes

- 4102574: Update unitrade packages

## 0.2.2

### Patch Changes

- 751c5b1: Loosen peer dep reqs for react query
- Updated dependencies [751c5b1]
  - @jetstreamgg/utils@0.2.2

## 0.2.1

### Patch Changes

- 9f161e5: Add `onSuccess` and `onError` callback handlers to write hooks
- Updated dependencies [9f161e5]
  - @jetstreamgg/utils@0.2.1

## 0.2.0

### Minor Changes

- 4050a0e: Upgrade Vite to v5
- 99a2fd3: Upgrade wagmi and viem to v2, upgrade react-query to v5

### Patch Changes

- e6f3877: add useUpgradeTotals hook
- 0440b8e: Updates to history types, history hooks, wallet widget
- Updated dependencies [4050a0e]
- Updated dependencies [99a2fd3]
  - @jetstreamgg/utils@0.2.0

## 0.1.19

### Patch Changes

- 9d64947: Remove CJS builds
- Updated dependencies [9d64947]
  - @jetstreamgg/utils@0.1.10

## 0.1.18

### Patch Changes

- c15b3bb: remove vaults, oracles, delegates hooks

## 0.1.17

### Patch Changes

- 89fddd0: update peer dependencies
- Updated dependencies [047f70a]
- Updated dependencies [89fddd0]
  - @jetstreamgg/utils@0.1.9

## 0.1.16

### Patch Changes

- d01698d: Patch @unitrade/smart-order-router

## 0.1.15

### Patch Changes

- 74e33c4: update dependencies in hooks package

## 0.1.14

### Patch Changes

- 45c44cc: New ReadHookParams type in hooks package.
- 0e7f0cb: Bump wagmi to 1.4.4, Move vite and vitest from peer deps to dev deps, Move contents into hooks package
- Updated dependencies [0e7f0cb]
  - @jetstreamgg/utils@0.1.8

## 0.1.13

### Patch Changes

- 3ce0bd6: Add restricted region to VPN check, rename useAuth
- 8937d33: Add auth wrapper to components
- 8d72f5d: Expose `react-query` configuration options for `useRestrictedAddressCheck` and `useVpnCheck`

## 0.1.12

### Patch Changes

- 79dbef1: rebuild

## 0.1.11

### Patch Changes

- 7bb611f: Remove test wrapper export

## 0.1.10

### Patch Changes

- b39133d: Update monorepo package links
- 42ebf41: Update org name
- Updated dependencies [b39133d]
- Updated dependencies [42ebf41]
  - @jetstreamgg/contracts@0.1.7
  - @jetstreamgg/utils@0.1.7

## 0.1.9

### Patch Changes

- e612837: update error type in vpn/auth check, make cache time configurable in vpn check
- 59e6f81: Upgrade dependencies
- Updated dependencies [59e6f81]
  - @jetstreamgg/contracts@0.1.6
  - @jetstreamgg/utils@0.1.6

## 0.1.8

### Patch Changes

- ac8ca3a: Default address auth to false on error

## 0.1.7

### Patch Changes

- cd5bd18: Externalize package dependencies to reduce bundle size
- Updated dependencies [cd5bd18]
  - @jetstreamgg/contracts@0.1.5
  - @jetstreamgg/utils@0.1.5

## 0.1.6

### Patch Changes

- 404bb31: Add react-query as peer dep, add provider, specify version

## 0.1.5

### Patch Changes

- 8b9b1cc: Update package entries
- Updated dependencies [8b9b1cc]
  - @jetstreamgg/contracts@0.1.4
  - @jetstreamgg/utils@0.1.4

## 0.1.4

### Patch Changes

- 54d36a1: Update package config

## 0.1.3

### Patch Changes

- 0f81cd1: reorganize contracts in wagmi config and integrate auth check endpoints
- 5fb1ad0: Update dependency versions
- Updated dependencies [0f81cd1]
- Updated dependencies [5fb1ad0]
  - @jetstreamgg/contracts@0.1.3
  - @jetstreamgg/utils@0.1.3

## 0.1.2

### Patch Changes

- 61d17b8: Remove publish command from packages
- Updated dependencies [61d17b8]
  - @jetstreamgg/contracts@0.1.2
  - @jetstreamgg/utils@0.1.2

## 0.1.1

### Patch Changes

- f5409a7: Add publish scripts
- 2a49094: Patch version
- b103d6e: Rename packages
- Updated dependencies [f5409a7]
- Updated dependencies [2a49094]
- Updated dependencies [b103d6e]
  - @jetstreamgg/contracts@0.1.1
  - @jetstreamgg/utils@0.1.1

## 0.1.0

### Minor Changes

- Pre release version

### Patch Changes

- Updated dependencies
  - @jetstreamgg/contracts@0.1.0
  - @jetstreamgg/utils@0.1.0
