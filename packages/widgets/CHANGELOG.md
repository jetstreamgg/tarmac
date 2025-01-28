# @jetstreamgg/widgets

## 3.3.0

### Minor Changes

- 3886a15: Add support for Safe wallet trades

### Patch Changes

- Updated dependencies [3886a15]
  - @jetstreamgg/hooks@3.3.0
  - @jetstreamgg/utils@2.3.0

## 3.2.1

### Patch Changes

- 9875ab3: disable opening new position when debt ceiling reached
- 9875ab3: account for new ilk.rate
- Updated dependencies [9875ab3]
- Updated dependencies [9875ab3]
  - @jetstreamgg/hooks@3.2.1

## 3.2.0

### Minor Changes

- 28638b0: Deps updates: major versions, Vite, Lingui, Vitest

### Patch Changes

- Updated dependencies [28638b0]
  - @jetstreamgg/hooks@3.2.0
  - @jetstreamgg/utils@2.2.0

## 3.1.26

### Patch Changes

- 23596a7: disable opening new position when debt ceiling reached

## 3.1.25

### Patch Changes

- e83e99d: add debt ceiling check to the seal widget
- 5f6a9ac: include image when watching asset
- e47bf2d: Remove Storybook from widgets package
- Updated dependencies [e83e99d]
  - @jetstreamgg/hooks@3.1.14
  - @jetstreamgg/utils@2.1.7

## 3.1.24

### Patch Changes

- 0739496: Fix issue on Base Savings widget that prevented balances from being refetched after deposit/withdraw

## 3.1.23

### Patch Changes

- 8f66cc9: call the onInput callback when the percentage buttons are clicked

## 3.1.22

### Patch Changes

- c4adca5: Update dependencies
- a5d09db: Copy updates for P1D
- 7712eba: disable trade when no amounts
- a46d912: fixes issue when toggling tokens
- Updated dependencies [cdbe578]
- Updated dependencies [a46d912]
  - @jetstreamgg/hooks@3.1.13
  - @jetstreamgg/utils@2.1.6

## 3.1.21

### Patch Changes

- 57061ca: add rounding for decimals to the base trade widget
- Updated dependencies [57061ca]
  - @jetstreamgg/hooks@3.1.12
  - @jetstreamgg/utils@2.1.5

## 3.1.20

### Patch Changes

- 97f48aa: savings supply min amount fix
- 1b7508e: fix base savings disable issue, update base tenderly config
- abe3c87: Add disallowedTokens prop to the Base Savings widget
- e000abd: fix for fixed susds output trade
- Updated dependencies [97f48aa]
- Updated dependencies [e000abd]
  - @jetstreamgg/utils@2.1.4
  - @jetstreamgg/hooks@3.1.11

## 3.1.19

### Patch Changes

- badbdee: Display unsupported wallet message for Safe wallets in Trade
- 6733d83: fix base savings amount reset on tab toggle

## 3.1.18

### Patch Changes

- 4c6042e: increase page size for delegate query

## 3.1.17

### Patch Changes

- 3f845a5: use the previewSwap functions from the psm
- f911234: Add referralCode to the necessary widgets and hooks
- Updated dependencies [c27a0eb]
- Updated dependencies [3f845a5]
- Updated dependencies [f911234]
  - @jetstreamgg/hooks@3.1.10

## 3.1.16

### Patch Changes

- e30b2e6: Update Base bridge docs link
- b22afe4: Add check to disable boosted rewards after December 31st
- 440d1d2: add base history icons
- e1f5e7a: rename to savings balance
- 4ca94c6: add sUsds to balances widget, don't always exclude sUsds from base trade history
- 2183f7f: Rename refs to Base that aren't references the Base network to Core
- Updated dependencies [4ca94c6]
- Updated dependencies [f45b465]
- Updated dependencies [e1f5e7a]
  - @jetstreamgg/hooks@3.1.9

## 3.1.15

### Patch Changes

- 65c1509: Fix savings widget button being disabled in Base after approving and after a successful withdrawal
- 3e1c4b5: ethereum savings history fix
- Updated dependencies [ca87f6f]
- Updated dependencies [3e1c4b5]
  - @jetstreamgg/hooks@3.1.8

## 3.1.14

### Patch Changes

- e0d3582: Fix token amount formatting on notifications
- bd7094f: Parse initial state from URL params for Base widgets
- a6d5340: Add external link handler to widget header linking to Base docs
- 6a78c89: Refetch token image when switching networks

## 3.1.13

### Patch Changes

- a30aa73: fix max withdraw base savings
- fd126c3: update token switching logic
- Updated dependencies [fd126c3]
  - @jetstreamgg/utils@2.1.3
  - @jetstreamgg/hooks@3.1.7

## 3.1.12

### Patch Changes

- Updated dependencies [48883bd]
  - @jetstreamgg/hooks@3.1.6

## 3.1.11

### Patch Changes

- eb222fd: Add Tenderly Base chain to Base contracts
- Updated dependencies [eb222fd]
  - @jetstreamgg/hooks@3.1.5

## 3.1.10

### Patch Changes

- e6d5ebf: fix bug with approvals

## 3.1.9

### Patch Changes

- 753f3cf: Add Basescan link and use dynamic name'
- 753f3cf: Add config for base networks
- 753f3cf: Add PSM hooks
- Updated dependencies [753f3cf]
- Updated dependencies [753f3cf]
- Updated dependencies [753f3cf]
  - @jetstreamgg/hooks@3.1.4
  - @jetstreamgg/utils@2.1.2

## 3.1.8

### Patch Changes

- 6e428c4: Add Basescan link and use dynamic name'
- 6e428c4: Add config for base networks
- 6e428c4: add base support for trade widget
- 6e428c4: Add PSM hooks
- Updated dependencies [6e428c4]
- Updated dependencies [6e428c4]
- Updated dependencies [6e428c4]
- Updated dependencies [6e428c4]
  - @jetstreamgg/hooks@3.1.3
  - @jetstreamgg/utils@2.1.1

## 3.1.7

### Patch Changes

- 3392485: Updates to module balance rates, seal reward rate display

## 3.1.6

### Patch Changes

- 4b83589: Display seal supplied module card
- 028ff68: show borrow rate, cleanup position summary

## 3.1.5

### Patch Changes

- f1ad96f: add tooltips to transaction overview and position summary
- 4a6be39: fix history pagination, and update seal reward claim tx status

## 3.1.4

### Patch Changes

- b63a0a2: assets -> funds
- 32ba6f5: handle no delegate case
- 163606a: add liquidationRatio to simulatedVault
- b9e55bb: copy updates
- 256301f: messages
- dcfe646: update usds approval text
- Updated dependencies [163606a]
  - @jetstreamgg/hooks@3.1.2

## 3.1.3

### Patch Changes

- 8607799: show delegate metadata in transaction overview
- 41cd056: add tooltip to mkr/sky switcher

## 3.1.2

### Patch Changes

- 4065924: Update seal toggle
- 4065924: Add toggle to urns list, urn detail

## 3.1.1

### Patch Changes

- 19df807: Add toggle to urns list, urn detail
- 64e1983: dust check fix in seal
- Updated dependencies [64e1983]
  - @jetstreamgg/hooks@3.1.1

## 3.1.0

### Minor Changes

- 03b4329: Add SKY to Seal engine

### Patch Changes

- Updated dependencies [03b4329]
  - @jetstreamgg/hooks@3.1.0
  - @jetstreamgg/utils@2.1.0

## 3.0.62

### Patch Changes

- 3befe43: Sort the unseal calldata after repaying to avoid unsafe position conditions
- 1c85135: Fix scrollbar appearing over widget content and button alignment

## 3.0.61

### Patch Changes

- 82b1134: Handle index urn external state param in the Seal widget
- 7413772: Refactor risk slider logic to hook, add max borrow data point
- Updated dependencies [7413772]
  - @jetstreamgg/hooks@3.0.41

## 3.0.60

### Patch Changes

- 48edd2c: Round up 1 wei the amount of USDS to approve when calling wipeAll
- 08390ba: Display exit fee amount and percentage even if not unsealing collateral
- 48edd2c: Approve a 0.5% extra when calling wipeAll to allow for a time margin before the transaction fails
- Updated dependencies [b812280]
  - @jetstreamgg/hooks@3.0.40

## 3.0.59

### Patch Changes

- 6792bbf: Sort delegate list by total MKR delegated descending
- cd9a65f: Round up 1 wei the amount of USDS to approve when calling wipeAll
- 8abfaf6: Fix error in the Seal borrow token input where the wrong max borrowable amount was display

## 3.0.58

### Patch Changes

- Updated dependencies [a18529a]
  - @jetstreamgg/hooks@3.0.39

## 3.0.57

### Patch Changes

- Updated dependencies [2a9df12]
  - @jetstreamgg/hooks@3.0.38

## 3.0.56

### Patch Changes

- da0afd1: i18n update

## 3.0.55

### Patch Changes

- 0b1a463: fix SRR text
- Updated dependencies [0b1a463]
  - @jetstreamgg/hooks@3.0.37

## 3.0.54

### Patch Changes

- 7d25055: Update LSMKR reference to MKR

## 3.0.53

### Patch Changes

- Updated dependencies [41b648a]
  - @jetstreamgg/hooks@3.0.36

## 3.0.52

### Patch Changes

- efbefcb: add tooltips

## 3.0.51

### Patch Changes

- 28c2332: show exit fee
- 28c2332: Pass terms link as a prop to seal widget
- 8a400f8: update layout on transaction screen

## 3.0.50

### Patch Changes

- 89709ce: Reset state after updating a seal position

## 3.0.49

### Patch Changes

- 27ea05b: Remove bonus term
- 54a6916: Add min collateral amount for dust to the useSimulatedVault hook and the associated widget
- 5a0f61f: update repay input
- ca1a9dc: delegate select continue update
- Updated dependencies [54a6916]
- Updated dependencies [54a6916]
  - @jetstreamgg/hooks@3.0.35

## 3.0.48

### Patch Changes

- 7ee0297: Update balance history to show undelegations
- 5c5ed82: Hide supplied assets cards on error
- c6f07f9: Update back button rendering logic to not be displayed while transactions are in progress
- 84f3e46: check that we have MKR to free before showing error message
- 5490ee8: Update mainnet ilk name value
- fff5196: updates tx status screen
- 82e8799: increase approval amount to ensure wipeAll success
- 3733497: Style select delegate section and remove SKY references
- 7af0955: RiskSlider shows right value when liquidation risk is 100 percent
- Updated dependencies [5490ee8]
- Updated dependencies [7ee0297]
  - @jetstreamgg/hooks@3.0.34

## 3.0.47

### Patch Changes

- 74f5e19: Allow to select no delegate in the Seal module
- 72e413f: Fix logic routing and copy for approve and repay flow
- 9f0b3e6: Sort calldatas to prevent execution errors
- a580291: Fix back to seal button being disabled after a successful transaction
- e789583: Handle title and subtile for the transaction status in the Seal module based on the current flow
- f983a1d: Make seal and borrow labels dynamic based on whether the user is sealing/unsealing/borrowing/repaying
- 72e413f: improve free and repay inputs
- Updated dependencies [72e413f]
- Updated dependencies [b362787]
  - @jetstreamgg/hooks@3.0.33

## 3.0.46

### Patch Changes

- c5c7150: Redirect to manage flow after completing a transaction
- 76a59e6: Add Seal history items to the balance widget
- 07b8edb: Fix seal position summary style
- Updated dependencies [a576424]
  - @jetstreamgg/hooks@3.0.32

## 3.0.45

### Patch Changes

- 2797519: Fix logic routing and copy for approve and repay flow
- 2e9ea0e: Styles updates
- Updated dependencies [2797519]
  - @jetstreamgg/hooks@3.0.31

## 3.0.44

### Patch Changes

- 78c3c06: Fix max borrowable value in the seal position overview
- b363602: Handle no debt position detail
- 540f03b: Remove the stepper from the transaction screen in the Seal module
- 09af2d1: Add unconnected state
- 7ece430: Add new before and after values for the seal and unseal tabs when managing a position

## 3.0.43

### Patch Changes

- 7c1e854: move stepper to widget content to make it full width
- 64e3b31: update skip disabling logic
- d1803b7: Update borrowable limit calculation
- e513f54: Fix transaction errors
- a7be775: improve sealed activation inputs
- Updated dependencies [a7be775]
- Updated dependencies [d1803b7]
  - @jetstreamgg/hooks@3.0.30

## 3.0.42

### Patch Changes

- 4e082f6: Add spacing between seal inputs
- Updated dependencies [596e1f9]
  - @jetstreamgg/hooks@3.0.29

## 3.0.41

### Patch Changes

- 1328ffa: Add supplied assets cards to balances widget
- 5da96e2: Add liquidation link
- Updated dependencies [1328ffa]
- Updated dependencies [5da96e2]
  - @jetstreamgg/hooks@3.0.28

## 3.0.40

### Patch Changes

- 0b10130: Add rewards claiming flow to seal module
- d6d5107: add delegate metadata and jazzicons
- 95b1ef6: Prevent Seal module scroll to remain at the bottom between navigation steps
- 58af10e: Make RiskSlider informational only when in the manage flow
- aa84f0c: Reset input when navigating back in the seal module
- acd25a8: Update position summary
- eddad0c: Remove unsupported token from token input selector in Seal module
- 8d66007: Disable delegate sort on click
- Updated dependencies [0b10130]
- Updated dependencies [d6d5107]
  - @jetstreamgg/hooks@3.0.27

## 3.0.39

### Patch Changes

- dcc6b70: Reset active urn when nav back

## 3.0.38

### Patch Changes

- b260acd: Fix onSealUrnChange callback
- Updated dependencies [b260acd]
  - @jetstreamgg/hooks@3.0.26

## 3.0.37

### Patch Changes

- c782b53: - Fix multiple Seal issues

  - Fix "Open a new position" button appearing disabled
  - Remove back button when viewing all positions after navigating through position management
  - Remove disabled back button on approve tx status screen
  - Fix connect button appearing disabled
  - Fix crash when selected delegate in a managed position is the ZERO address
  - Enforce exit fee checkbox acceptance in open/manage flow
  - Reset accepted exit fee checkbox between positions

- e0e6fcd: Add onSealUrnChange callback

## 3.0.36

### Patch Changes

- bd1fa4b: Move boosted rewards claim flow to rewards module
- 0cde479: Add allowances for multiple tokens in Seal module
- 5527c5e: Update packages and fix peer deps issues
- bc97bb9: Add delegate info
- 3c5ab0e: Add boosted rewards claim transaction flow
- fa49e14: adds support for wipe all
- a1c53de: minor widget button and delegate loading updates
- dac8e75: Add boosted rewards claim flow to widget
- Updated dependencies [9334469]
- Updated dependencies [bd1fa4b]
- Updated dependencies [5527c5e]
- Updated dependencies [dac8e75]
- Updated dependencies [bc97bb9]
- Updated dependencies [dac8e75]
- Updated dependencies [35e7567]
  - @jetstreamgg/hooks@3.0.25
  - @jetstreamgg/utils@2.0.6

## 3.0.35

### Patch Changes

- 877de887: Add the double token input for the Seal module'
- Updated dependencies [877de887]
  - @jetstreamgg/hooks@3.0.24

## 3.0.34

### Patch Changes

- d8bd94f5: Fetch Seal module exit fee from contract
- 2353b92a: Update Tenderly testnet
- Updated dependencies [d8bd94f5]
- Updated dependencies [2353b92a]
  - @jetstreamgg/hooks@3.0.23
  - @jetstreamgg/utils@2.0.5

## 3.0.33

### Patch Changes

- 6be44a86: store calldata and use for multicall transaction in seal module
- 0de48ec2: update namings
- Updated dependencies [6be44a86]
- Updated dependencies [0de48ec2]
  - @jetstreamgg/hooks@3.0.22
  - @jetstreamgg/utils@2.0.4

## 3.0.32

### Patch Changes

- Updated dependencies [4a37604c]
- Updated dependencies [5d218a92]
- Updated dependencies [9b755b6c]
  - @jetstreamgg/hooks@3.0.21

## 3.0.31

### Patch Changes

- 3022e163: Make cost warning account for the relative fee amount
- 20e72b31: update seal module hooks
- 43f7f16f: Prevent negative values when we deduct the gas buffer for eth trades
- Updated dependencies [3022e163]
- Updated dependencies [20e72b31]
  - @jetstreamgg/hooks@3.0.20
  - @jetstreamgg/utils@2.0.3

## 3.0.30

### Patch Changes

- 2f84cf0f: Add Seal module export constants to widgets package exports
- Updated dependencies [8de17349]
  - @jetstreamgg/hooks@3.0.19

## 3.0.29

### Patch Changes

- Updated dependencies [050b5611]
  - @jetstreamgg/hooks@3.0.18

## 3.0.28

### Patch Changes

- 55b3bc49: Fix suppliers count

## 3.0.27

### Patch Changes

- 25a56ed4: Allow to deduct an amount from the balance for gas costs in TokenInput and apply it to the TradeWidget when origin token is ETH.

## 3.0.26

### Patch Changes

- df479975: Fix claim rewards button not showing amounts under 0.01

## 3.0.25

### Patch Changes

- f397c717: undo collisions token input change

## 3.0.24

### Patch Changes

- 1b8e4e65: show action fix in balances widget

## 3.0.23

### Patch Changes

- 300cae33: Add collision prevention to the token input token dropdown
- 3e1380ce: Make rate popover scrollable
- 17946103: copy updates
- d307e7b5: Fix an issue that caused the ETH balance and price to take longer to fetch than other tokens
- 86487184: balance actions fixes, token input truncation update
- Updated dependencies [17946103]
- Updated dependencies [e113b47e]
- Updated dependencies [86487184]
  - @jetstreamgg/utils@2.0.2
  - @jetstreamgg/hooks@3.0.17

## 3.0.22

### Patch Changes

- fbd41d01: Add sUSDS to balances config
- b6f99f87: Add sUSDS trades back
- Updated dependencies [b6f99f87]
  - @jetstreamgg/hooks@3.0.16

## 3.0.21

### Patch Changes

- 279e73f0: fix rewards supplied sum when one is 0
- 5237cf31: format executed amounts

## 3.0.20

### Patch Changes

- 57776347: fix executed amounts being undefined
- 629b0ed0: Handle price impact values smaller than 5% and fix transparent text
- Updated dependencies [d226a303]
  - @jetstreamgg/hooks@3.0.15

## 3.0.19

### Patch Changes

- 6223e8cc: Stop propagation in token input clicks
- d7232be7: handle 0% price impact
- Updated dependencies [71d118a6]
  - @jetstreamgg/hooks@3.0.14

## 3.0.18

### Patch Changes

- e5975cdc: Add executed amounts to state callback
- 32dc207f: Update CoW protocol name
- Updated dependencies [5fae7e40]
- Updated dependencies [40d93b8a]
  - @jetstreamgg/hooks@3.0.13

## 3.0.17

### Patch Changes

- 5d71aba8: Fix layout issue on hover in the Balances widget cards
- a9dab83b: Pass onExternalLinkClick

## 3.0.16

### Patch Changes

- ffad9a34: Copy updates

## 3.0.15

### Patch Changes

- 4bf493a6: reset reward widget if you go back in the middle of a tx flow
- 4dd4ab75: trade disable fix with price impact
- 8515cdb1: Update default token configs, subgraph URL
- Updated dependencies [8515cdb1]
  - @jetstreamgg/hooks@3.0.12

## 3.0.14

### Patch Changes

- 930a0945: Handle 0 totals, fix recent rate search
- Updated dependencies [930a0945]
- Updated dependencies [930a0945]
  - @jetstreamgg/hooks@3.0.11

## 3.0.13

### Patch Changes

- Updated dependencies [51e2f4a2]
  - @jetstreamgg/hooks@3.0.10

## 3.0.12

### Patch Changes

- 36038a05: Allow to configure which tokens are allowed in the Upgrade widget
- Updated dependencies [f589a6cc]
  - @jetstreamgg/hooks@3.0.9

## 3.0.11

### Patch Changes

- 09e4eb5c: claim success screen fix
- Updated dependencies [75064841]
- Updated dependencies [a7d4a49e]
  - @jetstreamgg/hooks@3.0.8

## 3.0.10

### Patch Changes

- afafe6f2: Update savings rate source
- ef76b56e: Add warning about USDT allowance in Sepolia for the Trade widget
- Updated dependencies [afafe6f2]
- Updated dependencies [376ca256]
- Updated dependencies [d355bff5]
  - @jetstreamgg/hooks@3.0.7
  - @jetstreamgg/utils@2.0.1

## 3.0.9

### Patch Changes

- 700d83d1: Fix revert error
- 700d83d1: update copy
- 700d83d1: minor copy update

## 3.0.8

### Patch Changes

- 3a68723d: Reset the cost warning checkbox in trade widget if the user changes the trade
- 9e04ac3f: Fix revert error
- 8a896d5d: update copy
- Updated dependencies [57fa4a9b]
  - @jetstreamgg/hooks@3.0.6

## 3.0.7

### Patch Changes

- 3dc2c450: Add unsupported on chain wallet warning when connection through WalletConnect is detected
- 7ef15455: Add external link handler to CoW url
- 3426f9fd: Fix revertd typo
- 81c0312d: Update balances history to differentiate rewards vs savings actions
- bdac00d1: Perform division before formatting

## 3.0.6

### Patch Changes

- 153e4d03: copy and chronicle updates
- 8bcb475d: Remove most trade disallowed pairs and sort target token list to highlight Sky related tokens
- Updated dependencies [153e4d03]
- Updated dependencies [6b192f8d]
  - @jetstreamgg/hooks@3.0.5

## 3.0.5

### Patch Changes

- 0629ccf2: Add optional onExternalLinkClick prop
- 680cefe9: add rate popovers
- 1993d037: Update READMEs and fix tests
- Updated dependencies [1993d037]
  - @jetstreamgg/hooks@3.0.4

## 3.0.4

### Patch Changes

- 95aa2942: Update supply approval label
- Updated dependencies [95aa2942]
  - @jetstreamgg/hooks@3.0.3

## 3.0.3

### Patch Changes

- 32b5411b: Show the right token in the status screen when supplying or withdrawing from the Rewards widget
- 3e91634c: Update insufficient savings balance error when withdrawing
- 693f149c: Fix reward contract validation function

## 3.0.2

### Patch Changes

- 0df0b5c7: Fix Trade QA items
- 4c83b9cd: Add slippage input validation and separate the slippage, one for each flow type
- fd748e3c: Fix typos, other minor text issues
- Updated dependencies [4c83b9cd]
  - @jetstreamgg/hooks@3.0.2

## 3.0.1

### Patch Changes

- 4e663978: Update trade token list
- 4e663978: Address trade QA items
- Updated dependencies [4e663978]
  - @jetstreamgg/hooks@3.0.1

## 3.0.0

### Major Changes

- 2a15c2e6: Update names and references

### Patch Changes

- Updated dependencies [2a15c2e6]
  - @jetstreamgg/hooks@3.0.0
  - @jetstreamgg/utils@2.0.0

## 2.0.5

### Patch Changes

- 23023a17: Add powered by cowswap, update copy
- 23023a17: Fix native ETH trade
- Updated dependencies [23023a17]
- Updated dependencies [23023a17]
  - @jetstreamgg/hooks@2.0.5

## 2.0.4

### Patch Changes

- 5585246a: Add powered by cowswap, update copy
- Updated dependencies [5585246a]
  - @jetstreamgg/hooks@2.0.4

## 2.0.3

### Patch Changes

- 7921f458: QA fixes, renaming, formatting
- Updated dependencies [7921f458]
  - @jetstreamgg/hooks@2.0.3

## 2.0.2

### Patch Changes

- 1a80af65: Balances, rewards, savings copy updates, other fixes
- b6dfdfdb: Update trade token list
- Updated dependencies [1a80af65]
  - @jetstreamgg/hooks@2.0.2

## 2.0.1

### Patch Changes

- d4e10cd9: Trade widget fixes
- 911be016: Update graphql upgrade queries
- f6ea91c5: Add customTokenList prop for wallet, unify Token type
- Updated dependencies [d4e10cd9]
- Updated dependencies [911be016]
- Updated dependencies [f6ea91c5]
  - @jetstreamgg/hooks@2.0.1

## 2.0.0

### Major Changes

- e634d54f: Updates for new contracts, testnet

### Patch Changes

- Updated dependencies [e634d54f]
  - @jetstreamgg/hooks@2.0.0
  - @jetstreamgg/utils@1.0.0

## 1.3.45

### Patch Changes

- 3010c0db: Use correct amounts in trade history
- Updated dependencies [3010c0db]
  - @jetstreamgg/hooks@1.0.35
  - @jetstreamgg/utils@0.3.5

## 1.3.44

### Patch Changes

- 74605c5b: Add ETH trade flow
- Updated dependencies [74605c5b]
  - @jetstreamgg/hooks@1.0.34
  - @jetstreamgg/utils@0.3.4

## 1.3.43

### Patch Changes

- beeb79e0: Add cancel button to WidgetButtons
- 0ed13486: Update the copy in all widgets
- 1f982c72: Override default config token list if custom is provided
- e90fc9bf: Add cost warning
- 878c00bb: Enhanced TradeWidget to display quote details when user has insufficient balance
- beeb79e0: Add order cancellation
- Updated dependencies [e90fc9bf]
- Updated dependencies [a6def931]
- Updated dependencies [5e836810]
- Updated dependencies [beeb79e0]
  - @jetstreamgg/hooks@1.0.33

## 1.3.42

### Patch Changes

- abf6a33b: Add widgets docs
- 15093133: Improved TokenInput component: Stabilized layout of token list items by preventing text movement during token icon loading.
- Updated dependencies [6a354234]
- Updated dependencies [cfb63a33]
- Updated dependencies [e3649ccc]
- Updated dependencies [92ec19ae]
  - @jetstreamgg/hooks@1.0.32

## 1.3.41

### Patch Changes

- c10ac493: notify target token

## 1.3.40

### Patch Changes

- 2b270644: Switch the trade widget to use the Cow protocol API instead of Uniswap
- Updated dependencies [2b270644]
  - @jetstreamgg/hooks@1.0.31

## 1.3.39

### Patch Changes

- 80911314: create changese4t
- 554c12bb: Switch the trade widget to use the Cow protocol API instead of Uniswap
- d882879d: add generated addresses
- Updated dependencies [80911314]
- Updated dependencies [554c12bb]
- Updated dependencies [d882879d]
  - @jetstreamgg/hooks@1.0.30
  - @jetstreamgg/utils@0.3.3

## 1.3.39-beta.2

### Patch Changes

- add generated addresses
- Updated dependencies
  - @jetstreamgg/hooks@1.0.30-beta.2
  - @jetstreamgg/utils@0.3.3-beta.1

## 1.3.39-beta.1

### Patch Changes

- create changese4t
- Updated dependencies
  - @jetstreamgg/hooks@1.0.30-beta.1
  - @jetstreamgg/utils@0.3.3-beta.0

## 1.3.39-beta.0

### Patch Changes

- 554c12bb: Switch the trade widget to use the Cow protocol API instead of Uniswap
- Updated dependencies [554c12bb]
  - @jetstreamgg/hooks@1.0.30-beta.0

## 1.3.38

### Patch Changes

- e7fdddb7: Remove hardcoded wallet widget balances
- de186bd0: Use png image if svg token icon is not present

## 1.3.37

### Patch Changes

- c79e71bf: Prefetch AssetBalance action image
- aa841cbf: Send a notification after a successful upgrade or trade
- dce5ec4b: Center arrow on hover actions
- Updated dependencies [9ff03d39]
  - @jetstreamgg/hooks@1.0.29

## 1.3.36

### Patch Changes

- 2c96b4ad: widget button data-testid
- 986f8bc3: fix token sorting

## 1.3.35

### Patch Changes

- da60597c: adds cron reward contract to available reward contracts and generated hooks
- c0f75af8: Add hook to fetch LSMKR on-chain price, and apply new styles to SA reward contract and delegate cards
- 0a6b40bb: Prevent generic tailwind groups from triggering card group actions
- 191c34cd: Send notification in Rewards and Savings widget when a balance error occurs
- Updated dependencies [da60597c]
- Updated dependencies [c0f75af8]
- Updated dependencies [5accdc82]
  - @jetstreamgg/hooks@1.0.28

## 1.3.34

### Patch Changes

- 7b30d605: Fix some styles in the wallet widget's savings and rewards cards
- 8928f4ba: Make actionForToken prop optional for the wallet widget

## 1.3.33

### Patch Changes

- b7b977bc: Make wallet widget's module cards interactive
- 1a4051f4: Implement new design for SA summary step
- a2679f69: add generate calldata file
- 11afd2f7: Add prices endpoint
- 10a6a775: Add interactive asset cards to the wallet widget
- c6bf7b09: Add RiskSlider component
- Updated dependencies [c6bf7b09]
- Updated dependencies [1a4051f4]
- Updated dependencies [a2679f69]
- Updated dependencies [a2679f69]
- Updated dependencies [11afd2f7]
- Updated dependencies [a2679f69]
- Updated dependencies [f7df6a13]
- Updated dependencies [a2679f69]
  - @jetstreamgg/hooks@1.0.27
  - @jetstreamgg/utils@0.3.2

## 1.3.32

### Patch Changes

- 78d12d4e: trade widget only updates on external state change when tx is idle
- 74da0347: remove focus from widget button after clicking
- 5a44e890: Update SKY and SYD token names
- Updated dependencies [5a44e890]
  - @jetstreamgg/hooks@1.0.24

## 1.3.31

### Patch Changes

- 4601ade3: Remove Stepper Indicator from Rewards withdraw flow
- 1f769c86: Remove steps indicator in flows that don't need approvals
- 92e01ab5: fix tokens and amounts in trade progress screens

## 1.3.30

### Patch Changes

- 56594b0c: Comma separator on oracle prices
- 54c531e7: Improve Claim rewards UX in the Rewards widget
- f82cbe14: Prevent trades between eth and weth.
- 689f0055: Add enabled prop to useQuotePoolTrade hook.
  Fix trade widget quotes.
- 2e16374c: Updates for new tenderly testnet
- Updated dependencies [689f0055]
- Updated dependencies [2e16374c]
  - @jetstreamgg/hooks@1.0.22
  - @jetstreamgg/utils@0.3.1

## 1.3.29

### Patch Changes

- a8e3d610: Switch loading spinner animation approach
- fb482296: Fix error when trading tokens

## 1.3.28

### Patch Changes

- 59233fff: Trade widget reacts to external state changes
- 9838434d: fix token sort, remove sdai
- Updated dependencies [9838434d]
  - @jetstreamgg/hooks@1.0.21

## 1.3.27

### Patch Changes

- 6e5959d3: Rename initialWidgetState prop to externalWidgetState.
  React to changes in externalWidgetState prop.
- Updated dependencies [13b13251]
  - @jetstreamgg/hooks@1.0.20

## 1.3.26

### Patch Changes

- 9541a432: Add optional enabled prop

## 1.3.25

### Patch Changes

- 01089e8c: Add extra padding to widget footer to align with inputs
- 3aeb1a54: back button trade approve review

## 1.3.24

### Patch Changes

- c68d022f: Make widget container scrollable and blur content when behind footer
- 79521e98: Remove JSBI dependency and duplicate query clients
- fad34423: Prevent TokenInput from triggering unnecessary input value updates
- Updated dependencies [79521e98]
- Updated dependencies [8fbc735a]
  - @jetstreamgg/hooks@1.0.19

## 1.3.23

### Patch Changes

- 09a44e01: custom navigation and onWidgetChange callbacks added

## 1.3.22

### Patch Changes

- syncing versions
- Updated dependencies
  - @jetstreamgg/hooks@1.0.17

## 1.3.18

### Patch Changes

- bump packges past main
- Updated dependencies
  - @jetstreamgg/hooks@1.0.16

## 1.3.17

### Patch Changes

- bumping packages
- Updated dependencies
  - @jetstreamgg/hooks@1.0.15

## 1.3.16

### Patch Changes

- a6389564: add custom navigation to trade widget
- 94a9f8ec: "custom navigation beta"
- a779330f: debugging statements
- 23734022: changed some props
- Updated dependencies [a6389564]
- Updated dependencies [94a9f8ec]
- Updated dependencies [a779330f]
- Updated dependencies [23734022]
  - @jetstreamgg/hooks@1.0.14

## 1.3.16-beta.3

### Patch Changes

- add custom navigation to trade widget
- Updated dependencies
  - @jetstreamgg/hooks@1.0.14-beta.3

## 1.3.16-beta.2

### Patch Changes

- debugging statements
- Updated dependencies
  - @jetstreamgg/hooks@1.0.14-beta.2

## 1.3.16-beta.1

### Patch Changes

- changed some props
- Updated dependencies
  - @jetstreamgg/hooks@1.0.14-beta.1

## 1.3.16-beta.0

### Patch Changes

- "custom navigation beta"
- Updated dependencies
  - @jetstreamgg/hooks@1.0.14-beta.0

## 1.3.21

### Patch Changes

- cf597c5f: Fix layout shift in rewards widget title caused by double animation
- b78755f2: Remove token input layout animation

## 1.3.20

### Patch Changes

- 9282b9cf: Remove gas estimation when quoting a trade
- Updated dependencies [9282b9cf]
  - @jetstreamgg/hooks@1.0.15

## 1.3.19

### Patch Changes

- c9374175: Fix bug that was preventing USDT transactions and approvals
- cd682df6: Create new lock file
- Updated dependencies [c9374175]
- Updated dependencies [cd682df6]
  - @jetstreamgg/hooks@1.0.14

## 1.3.18

### Patch Changes

- 5de38df9: Fix savings overview when no wallet connected. Add savings test ids.

## 1.3.17

### Patch Changes

- 8461ace8: Fix supply on savings widget

## 1.3.16

### Patch Changes

- f4d67db4: Hide disconnected CTA on mobiles except for the wallet widget

## 1.3.15

### Patch Changes

- 7fcb2569: widget state callbacks
- Updated dependencies [7fcb2569]
  - @jetstreamgg/hooks@1.0.13

## 1.3.14

### Patch Changes

- c237b6c3: trade fixes - button disabling and decimal handling
- f7964054: fix rewards action setting
- c8d31b45: wait for debounce
- c4ce738d: disable savings withdraw if 0 amount
- Updated dependencies [c4ce738d]
  - @jetstreamgg/hooks@1.0.12

## 1.3.13

### Patch Changes

- a8c84266: Fix colors, spaces and sizes based on QA
- c6a1b14e: prevent connector not connected error
- Updated dependencies [c6a1b14e]
  - @jetstreamgg/hooks@1.0.11

## 1.3.12

### Patch Changes

- Updated dependencies [3dd9ff4e]
  - @jetstreamgg/hooks@1.0.10

## 1.3.12-beta.0

### Patch Changes

- Updated dependencies [3dd9ff4e]

  - @jetstreamgg/hooks@1.0.10-beta.0

- 35840350: Fix widget scroll on mobiles
- 56793a19: Minor ui changes
- Updated dependencies [3dd9ff4e]
  - @jetstreamgg/hooks@1.0.10

## 1.3.11

### Patch Changes

- 2382d509: Prevent wallet svg icon to render without colors

## 1.3.10

### Patch Changes

- 18b69c95: trade widget fixes

## 1.3.9

### Patch Changes

- c83855b6: mobile qa
- 941c841c: balance error and input handling in widgets
- 4b30a5ce: Widget footer remains fixed at the bottom of the widget container

## 1.3.8

### Patch Changes

- e2ffe349: handle simulate errors better
- e2ffe349: add token allowance to validation for rewards supply hook"
- Updated dependencies [e2ffe349]
- Updated dependencies [e2ffe349]
- Updated dependencies [e2ffe349]
  - @jetstreamgg/hooks@1.0.9

## 1.3.7

### Patch Changes

- afa314c1: Add transaction card animations: icons, text and background
- Updated dependencies [64f75818]
  - @jetstreamgg/hooks@1.0.8

## 1.3.6

### Patch Changes

- 41fb271: Add transitions when navigating through the widget flows, including line-by-line animations

## 1.3.5

### Patch Changes

- 754aaeb: Add transitions
- 64ef418: Add more styles to the widgets package components and new variant for widget button
- 754aaeb: Add animation presets, constants, and animate the transaction overview, TokenInput layout, and TokenInput dropdown list using the `framer-motion` library.
- caa0723: QA margin fixes
- 64c1ce6: Small fixes - clear inputs, fix button text

## 1.3.4

### Patch Changes

- abca4e3: Add transitions
- 09aa82d: better handle tx reverting
- Updated dependencies [09aa82d]
- Updated dependencies [d5d615a]
  - @jetstreamgg/hooks@1.0.5

## 1.3.3

### Patch Changes

- d11deae: Fix balance dispaly issues
- 200d6ad: wallet history updates
- 56ae9fe: Upgrade framer-motion
- 009949b: retry button on tx error
- 8a61df7: Fix tab state
- Updated dependencies [d11deae]
- Updated dependencies [d11deae]
  - @jetstreamgg/hooks@1.0.0

## 1.3.2

### Patch Changes

- 40d0ff4: fixes some DOM errors
- a673ab6: use debounced amount when checking to disable button, prevents button state flickering when entering values into the input

## 1.3.1

### Patch Changes

- 72b4239: Fix rewards detail card
- 075ad53: wrap widgets in error boundary component
- a4bce0c: add target token icon to upgrade tx screens"
- d4ecf82: Fix tooltip hiding when overflowing container and tooltip misalignment
- 034be71: Display warnings in the trade widget when the price impact for the trade is high
- Updated dependencies [034be71]
  - @jetstreamgg/hooks@0.4.2

## 1.3.0

### Minor Changes

- 8406103: Migrate trade hooks and widget from auto routing to pool routing

### Patch Changes

- e7f3ef8: Make trade addresses dependant on chain
- 12eda03: Remove mock data
- 7306e76: trade widget polishing
- ef08a8b: minor history changes
- 98b33f2: Remove ethers v5 dependency
- d237ac2: Organize folder structure
- e2dbca2: Update wallet history and balances
- 6f3c671: Remove support for goerli and localhost chains
- Updated dependencies [e7f3ef8]
- Updated dependencies [b9b5386]
- Updated dependencies [12eda03]
- Updated dependencies [ef08a8b]
- Updated dependencies [98b33f2]
- Updated dependencies [8406103]
- Updated dependencies [d237ac2]
- Updated dependencies [e2dbca2]
- Updated dependencies [6f3c671]
  - @jetstreamgg/hooks@0.4.0
  - @jetstreamgg/utils@0.3.0

## 1.2.24

### Patch Changes

- ac38687: Add module and type enums
- Updated dependencies [ac38687]
  - @jetstreamgg/hooks@0.3.12

## 1.2.23

### Patch Changes

- d164b94: Deprecate hooks package useChainId hook
- 85a967e: Add style to tokeninput dropdown
- Updated dependencies [d164b94]
  - @jetstreamgg/hooks@0.3.11

## 1.2.22

### Patch Changes

- a5c2baf: handle no balances

## 1.2.21

### Patch Changes

- 18b262e: add useTokenBalances (2nd time)
- Updated dependencies [18b262e]
  - @jetstreamgg/hooks@0.3.10

## 1.2.20

### Patch Changes

- a087cd8: Handle savings history amounts

## 1.2.19

### Patch Changes

- 24b0d96: Fix amounts in wallet history

## 1.2.18

### Patch Changes

- 2cb4ba1: Update conversion rate, tooltip texts, margin

## 1.2.17

### Patch Changes

- 6f3744f: revert useTokenBalances PR
- Updated dependencies [6f3744f]
  - @jetstreamgg/hooks@0.3.9

## 1.2.16

### Patch Changes

- c79831e: update in progress icon
- 31ead65: add useTokenBalances hook, use in wallet widget
- Updated dependencies [31ead65]
  - @jetstreamgg/hooks@0.3.8

## 1.2.15

### Patch Changes

- 869257d: Widget QA fixes
- 7dbec13: Fix typo in savings transaction overview

## 1.2.14

### Patch Changes

- 7130dd1: Wallet styles, oracles updates
- Updated dependencies [7130dd1]
  - @jetstreamgg/hooks@0.3.7

## 1.2.13

### Patch Changes

- 3916bee: Add skeletons, fix spacings and add mocked values
- Updated dependencies [fe178e7]
  - @jetstreamgg/hooks@0.3.6

## 1.2.12

### Patch Changes

- 4093808: Add USD prices to token input selector
- f4a461a: Fix trade flow issues
- 3512d4e: Fix trade crash, add missing margin
- 73bae39: Adds token to wallet after trade
- Updated dependencies [4093808]
- Updated dependencies [7564e44]
  - @jetstreamgg/hooks@0.3.5

## 1.2.11

### Patch Changes

- c09eafb: Add optional prop to hide module balances

## 1.2.10

### Patch Changes

- f3df2a4: Update input & tx details
- 917951b: Rename project tokens and replace token icons
- Updated dependencies [917951b]
  - @jetstreamgg/hooks@0.3.4

## 1.2.9

### Patch Changes

- 8d85b4a: Add connect wallet illustration component
- Updated dependencies [dd9ceea]
  - @jetstreamgg/hooks@0.3.3

## 1.2.8

### Patch Changes

- fba7d3d: Remove toast provider from widgets
- fba7d3d: Add notification callback to widgets
- bbd480e: QA updates: open tx overview, updates tx flows, style updates
- f6e13b6: polish wallet history cards
- bbd480e: update button loading text for upgrade

## 1.2.7

### Patch Changes

- dc37291: Remove toast provider from widgets

## 1.2.6

### Patch Changes

- e529325: Update tabs styles

## 1.2.5

### Patch Changes

- e76ca97: Fix dom nesting errors
- 6898839: Update rewards tx messaging

## 1.2.4

### Patch Changes

- 1ef7bdd: fetch from BA labs rewards endpoint
- Updated dependencies [1ef7bdd]
  - @jetstreamgg/hooks@0.3.2

## 1.2.3

### Patch Changes

- 3dfab08: Adds transparent background to switch button in the Trade widget
- 117ce2a: Add savings info card
- 457a249: Fix widget button to the bottom
- 02dde6a: wallet widget skeleton card styling
- e20bdab: Update disallowed pairs, no ETH for USDS trade

## 1.2.2

### Patch Changes

- f1b55ac: fix back button action, update styles
- d9b9ff0: Export oracle data type
- 7bc58d7: increase widget heading size
- Updated dependencies [d9b9ff0]
  - @jetstreamgg/hooks@0.3.1

## 1.2.1

### Patch Changes

- 7401376: Add loading state to buttons
- 4e62574: Update tx flows
- 1c2686c: Adds transaction overview to Savings widget
- 5acd9a7: update address card
- 662e62e: Add tenderly network config
- fe82e5b: add fonts
- bbcee20: add tx progress bars
- Updated dependencies [662e62e]
- Updated dependencies [293591f]
  - @jetstreamgg/hooks@0.3.0

## 1.2.0

### Minor Changes

- 4be0800: remove outer padding, unset background

### Patch Changes

- 8dd96d8: Update breakpoints to match designs

## 1.1.11

### Patch Changes

- 8f3f0f1: Update the transaction status steps for new design

## 1.1.10

### Patch Changes

- 7773b47: Add trade summary screen
- 39492d3: Updates to widget styling
- d2041ea: TokenInput improvements
- 8bead96: add pagination to wallet history, and update wallet widget styles
- Updated dependencies [d2041ea]
  - @jetstreamgg/hooks@0.2.5

## 1.1.9

### Patch Changes

- a351792: rewards overview fix
- a351792: fix useEffect to handle undefined selectedRewardContract

## 1.1.8

### Patch Changes

- 5d02e19: fix useEffect to handle undefined selectedRewardContract

## 1.1.7

### Patch Changes

- 99cc934: fix invalid nesting error

## 1.1.6

### Patch Changes

- 584f35f: Update rewards info, add selected rewards prop validation to rewards widget
- Updated dependencies [0ebf052]
- Updated dependencies [584f35f]
  - @jetstreamgg/hooks@0.2.4

## 1.1.5

### Patch Changes

- c807fa8: Add initial states and validation

## 1.1.4

### Patch Changes

- 7dd5801: Add callback on view all available rewards

## 1.1.3

### Patch Changes

- 4102574: Update uniswap packages
- e1bf0ff: add rightHeaderComponent to widgets
- 5746806: Add optional props to rewards widget for syncing views
- 40f966e: Fix issue that would cause a hook count error in the wallet widget
- Updated dependencies [4102574]
  - @jetstreamgg/hooks@0.2.3

## 1.1.2

### Patch Changes

- 751c5b1: Loosen peer dep reqs for react query
- Updated dependencies [751c5b1]
  - @jetstreamgg/hooks@0.2.2
  - @jetstreamgg/utils@0.2.2

## 1.1.1

### Patch Changes

- 9f161e5: Add `onSuccess` and `onError` callback handlers to write hooks
- 5303cc8: Update rewards widget to have an overview screen
- Updated dependencies [9f161e5]
  - @jetstreamgg/hooks@0.2.1
  - @jetstreamgg/utils@0.2.1

## 1.1.0

### Minor Changes

- 4050a0e: Upgrade Vite to v5
- 99a2fd3: Upgrade wagmi and viem to v2, upgrade react-query to v5

### Patch Changes

- 0440b8e: Updates to history types, history hooks, wallet widget
- Updated dependencies [4050a0e]
- Updated dependencies [e6f3877]
- Updated dependencies [0440b8e]
- Updated dependencies [99a2fd3]
  - @jetstreamgg/hooks@0.2.0
  - @jetstreamgg/utils@0.2.0

## 1.0.0

### Major Changes

- bb9e102: Replaces chakra with shadcn and tailwind

### Patch Changes

- 9d64947: Remove CJS builds
- Updated dependencies [9d64947]
  - @jetstreamgg/hooks@0.1.19
  - @jetstreamgg/utils@0.1.10

## 0.1.21

### Patch Changes

- df0bb5a: Upgrade dependencies
- 89fddd0: update peer dependencies
- Updated dependencies [047f70a]
- Updated dependencies [df0bb5a]
- Updated dependencies [89fddd0]
- Updated dependencies [aa359f3]
  - @jetstreamgg/utils@0.1.9
  - @jetstreamgg/components@0.1.20
  - @jetstreamgg/hooks@0.1.17

## 0.1.20

### Patch Changes

- d01698d: Patch @uniswap/smart-order-router
- Updated dependencies [d01698d]
  - @jetstreamgg/hooks@0.1.16

## 0.1.19

### Patch Changes

- 4e8c319: Remove icons package references
- 74e33c4: update dependencies in hooks package
- Updated dependencies [4e8c319]
- Updated dependencies [74e33c4]
  - @jetstreamgg/components@0.1.19
  - @jetstreamgg/hooks@0.1.15

## 0.1.18

### Patch Changes

- 45c44cc: New ReadHookParams type in hooks package.
- 0e7f0cb: Bump wagmi to 1.4.4, Move vite and vitest from peer deps to dev deps, Move contents into hooks package
- Updated dependencies [45c44cc]
- Updated dependencies [0e7f0cb]
  - @jetstreamgg/hooks@0.1.14
  - @jetstreamgg/components@0.1.18
  - @jetstreamgg/icons@0.1.10
  - @jetstreamgg/utils@0.1.8

## 0.1.17

### Patch Changes

- 4eea0d4: Add wallet widget

## 0.1.16

### Patch Changes

- b39133d: Update monorepo package links
- 42ebf41: Update org name
- Updated dependencies [b39133d]
- Updated dependencies [42ebf41]
  - @jetstreamgg/components@0.1.16
  - @jetstreamgg/contracts@0.1.7
  - @jetstreamgg/hooks@0.1.10
  - @jetstreamgg/icons@0.1.9
  - @jetstreamgg/utils@0.1.7

## 0.1.15

### Patch Changes

- 59e6f81: Upgrade dependencies
- Updated dependencies [e612837]
- Updated dependencies [59e6f81]
  - @jetstreamgg/hooks@0.1.9
  - @jetstreamgg/components@0.1.15
  - @jetstreamgg/contracts@0.1.6
  - @jetstreamgg/icons@0.1.8
  - @jetstreamgg/utils@0.1.6

## 0.1.14

### Patch Changes

- Updated dependencies [ac8ca3a]
  - @jetstreamgg/hooks@0.1.8
  - @jetstreamgg/components@0.1.14

## 0.1.13

### Patch Changes

- cd5bd18: Externalize package dependencies to reduce bundle size
- Updated dependencies [cd5bd18]
  - @jetstreamgg/components@0.1.13
  - @jetstreamgg/contracts@0.1.5
  - @jetstreamgg/hooks@0.1.7
  - @jetstreamgg/icons@0.1.7
  - @jetstreamgg/utils@0.1.5

## 0.1.12

### Patch Changes

- 929bb81: Update dependencies, icons config
- Updated dependencies [929bb81]
  - @jetstreamgg/components@0.1.12
  - @jetstreamgg/icons@0.1.6

## 0.1.11

### Patch Changes

- 404bb31: Add react-query as peer dep, add provider, specify version
- Updated dependencies [404bb31]
  - @jetstreamgg/hooks@0.1.6
  - @jetstreamgg/components@0.1.11

## 0.1.10

### Patch Changes

- 8b9b1cc: Update package entries
- Updated dependencies [8b9b1cc]
  - @jetstreamgg/contracts@0.1.4
  - @jetstreamgg/hooks@0.1.5
  - @jetstreamgg/icons@0.1.5
  - @jetstreamgg/utils@0.1.4
  - @jetstreamgg/components@0.1.10

## 0.1.9

### Patch Changes

- Updated dependencies [54d36a1]
  - @jetstreamgg/hooks@0.1.4
  - @jetstreamgg/components@0.1.9

## 0.1.8

### Patch Changes

- Updated dependencies [659abf3]
  - @jetstreamgg/components@0.1.8

## 0.1.7

### Patch Changes

- 0f81cd1: reorganize contracts in wagmi config and integrate auth check endpoints
- 5fb1ad0: Update dependency versions
- 208b0df: Reactive i18n update
- Updated dependencies [0f81cd1]
- Updated dependencies [5fb1ad0]
  - @jetstreamgg/components@0.1.7
  - @jetstreamgg/contracts@0.1.3
  - @jetstreamgg/hooks@0.1.3
  - @jetstreamgg/icons@0.1.4
  - @jetstreamgg/utils@0.1.3

## 0.1.6

### Patch Changes

- 4cf3f96: Update package config
- Updated dependencies [4cf3f96]
- Updated dependencies [53d2887]
  - @jetstreamgg/components@0.1.6

## 0.1.5

### Patch Changes

- Updated dependencies
  - @jetstreamgg/components@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [f007980]
  - @jetstreamgg/components@0.1.4

## 0.1.3

### Patch Changes

- 61d17b8: Remove publish command from packages
- Updated dependencies [61d17b8]
  - @jetstreamgg/components@0.1.3
  - @jetstreamgg/contracts@0.1.2
  - @jetstreamgg/hooks@0.1.2
  - @jetstreamgg/icons@0.1.3
  - @jetstreamgg/utils@0.1.2

## 0.1.2

### Patch Changes

- f5409a7: Add publish scripts
- 2a49094: Patch version
- b103d6e: Rename packages
- Updated dependencies [f5409a7]
- Updated dependencies [2a49094]
- Updated dependencies [b103d6e]
  - @jetstreamgg/components@0.1.2
  - @jetstreamgg/contracts@0.1.1
  - @jetstreamgg/hooks@0.1.1
  - @jetstreamgg/icons@0.1.2
  - @jetstreamgg/utils@0.1.1

## 0.1.1

### Patch Changes

- Make packages private
- Updated dependencies
  - @jetstreamgg/components@0.1.1
  - @jetstreamgg/icons@0.1.1

## 0.1.0

### Minor Changes

- Pre release version

### Patch Changes

- Updated dependencies
  - @jetstreamgg/components@0.1.0
  - @jetstreamgg/icons@0.1.0
  - @jetstreamgg/contracts@0.1.0
  - @jetstreamgg/hooks@0.1.0
  - @jetstreamgg/utils@0.1.0
