### **Rewards**

- **Mainnet**
  - Go to Rewards
    ```ts
    {
      network: 'mainnet',
      widget: 'rewards'
    }
    ```
  - Claim SKY rewards to With: USDS | Get: SKY
    ```ts
    {
      network: 'mainnet',
      widget: 'rewards',
      flow: 'claim',
      reward: '<0x123>'
    }
    ```
  - Supply USDS to With: USDS | Get: SKY
    ```ts
    {
      network: 'mainnet',
      widget: 'rewards',
      flow: 'supply',
      reward: '<0x123>',
    }
    ```
  - Supply {{amount}} USDS to With: USDS | Get: SKY
    ```ts
    {
      network: 'mainnet',
      widget: 'rewards',
      flow: 'supply',
      reward: '<0x123>',
      amount: number
    }
    ```
  - Withdraw USDS from With: USDS | Get: SKY
    ```ts
    {
      network: 'mainnet',
      widget: 'rewards',
      flow: 'withdraw',
      reward: '<0x123>'
    }
    ```
  - Withdraw {{amount}} USDS from With: USDS | Get: SKY
    ```ts
    {
      network: 'mainnet',
      widget: 'rewards',
      flow: 'withdraw',
      reward: '<0x123>',
      amount: number
    }
    ```
  - Supply USDS to With: USDS | Get: Chronicle Points
    ```ts
    {
      network: 'mainnet',
      widget: 'rewards',
      flow: 'supply',
      reward: '<0x123>'
    }
    ```
  - Supply {{amount}} USDS to With: USDS | Get: Chronicle Points
    ```ts
    {
      network: 'mainnet',
      widget: 'rewards',
      flow: 'supply',
      reward: '<0x123>',
      amount: number
    }
    ```
  - Withdraw USDS from With: USDS | Get: Chronicle Points
    ```ts
    {
      network: 'mainnet',
      widget: 'rewards',
      flow: 'withdraw',
      reward: '<0x123>'
    }
    ```
  - Withdraw {{amount}} USDS from With: USDS | Get: Chronicle Points
    ```ts
    {
      network: 'mainnet',
      widget: 'rewards',
      flow: 'withdraw',
      reward: '<0x123>',
      amount: number
    }
    ```

### **Savings**

- **Mainnet**
  - Go to Savings
    ```ts
    {
      network: 'mainnet',
      widget: 'savings'
    }
    ```
  - Deposit USDS
    ```ts
    {
      network: 'mainnet',
      widget: 'savings',
      flow: 'deposit',
      token: 'USDS'
    }
    ```
  - Deposit {{amount}} USDS
    ```ts
    {
      network: 'mainnet',
      widget: 'savings',
      flow: 'deposit',
      token: 'USDS',
      amount: number
    }
    ```
  - Withdraw USDS
    ```ts
    {
      network: 'mainnet',
      widget: 'savings',
      flow: 'withdraw',
      token: 'USDS'
    }
    ```
  - Withdraw {{amount}} USDS
    ```ts
    {
      network: 'mainnet',
      widget: 'savings',
      flow: 'withdraw',
      token: 'USDS',
      amount: number
    }
    ```
- **Base**
  - Go to Savings
    ```ts
    {
      network: 'base',
      widget: 'savings'
    }
    ```
  - Deposit to Savings
    ```ts
    {
      network: 'base',
      widget: 'savings',
      flow: 'deposit',
    }
    ```
  - Withdraw from Savings
    ```ts
    {
      network: 'base',
      widget: 'savings',
      flow: 'withdraw'
    }
    ```
  - Deposit USDS
    ```ts
    {
      network: 'base',
      widget: 'savings',
      flow: 'deposit',
      token: 'USDS'
    }
    ```
  - Deposit {{amount}} USDS
    ```ts
    {
      network: 'base',
      widget: 'savings',
      flow: 'deposit',
      token: 'USDS',
      amount: number
    }
    ```
  - Deposit USDC
    ```ts
    {
      network: 'base',
      widget: 'savings',
      flow: 'deposit',
      token: 'USDC'
    }
    ```
  - Deposit {{amount}} USDC
    ```ts
    {
      network: 'base',
      widget: 'savings',
      flow: 'deposit',
      token: 'USDC',
      amount: number
    }
    ```
  - Withdraw USDS
    ```ts
    {
      network: 'base',
      widget: 'savings',
      flow: 'withdraw',
      token: 'USDS'
    }
    ```
  - Withdraw {{amount}} USDS
    ```ts
    {
      network: 'base',
      widget: 'savings',
      flow: 'withdraw',
      token: 'USDS',
      amount: number
    }
    ```
  - Withdraw USDC
    ```ts
    {
      network: 'base',
      widget: 'savings',
      flow: 'withdraw',
      token: 'USDC'
    }
    ```
  - Withdraw {{amount}} USDC
    ```ts
    {
      network: 'base',
      widget: 'savings',
      flow: 'withdraw',
      token: 'USDC',
      amount: number
    }
    ```
- **Arbitrum**
  - Go to Savings
    ```ts
    {
      network: 'arbitrum',
      widget: 'savings'
    }
    ```
  - Deposit to Savings
    ```ts
    {
      network: 'arbitrum',
      widget: 'savings',
      flow: 'deposit',
    }
    ```
  - Deposit USDS
    ```ts
    {
      network: 'arbitrum',
      widget: 'savings',
      flow: 'deposit',
      token: 'USDS'
    }
    ```
  - Deposit {{amount}} USDS
    ```ts
    {
      network: 'arbitrum',
      widget: 'savings',
      flow: 'deposit',
      token: 'USDS',
      amount: number
    }
    ```
  - Deposit USDC
    ```ts
    {
      network: 'arbitrum',
      widget: 'savings',
      flow: 'deposit',
      token: 'USDC'
    }
    ```
  - Deposit {{amount}} USDC
    ```ts
    {
      network: 'arbitrum',
      widget: 'savings',
      flow: 'deposit',
      token: 'USDC',
      amount: number
    }
    ```
  - Withdraw USDS
    ```ts
    {
      network: 'arbitrum',
      widget: 'savings',
      flow: 'withdraw',
      token: 'USDS'
    }
    ```
  - Withdraw {{amount}} USDS
    ```ts
    {
      network: 'arbitrum',
      widget: 'savings',
      flow: 'withdraw',
      token: 'USDS',
      amount: number
    }
    ```
  - Withdraw USDC
    ```ts
    {
      network: 'arbitrum',
      widget: 'savings',
      flow: 'withdraw',
      token: 'USDC'
    }
    ```
  - Withdraw {{amount}} USDC
    ```ts
    {
      network: 'arbitrum',
      widget: 'savings',
      flow: 'withdraw',
      token: 'USDC',
      amount: number
    }
    ```

### **Upgrade**

- **Mainnet**
  - Upgrade MKR to SKY
    ```ts
    {
      network: 'mainnet',
      widget: 'upgrade',
      flow: 'upgrade',
      source_token: 'MKR',
    }
    ```
  - Upgrade {{amount}} MKR to SKY
    ```ts
    {
      network: 'mainnet',
      widget: 'upgrade',
      flow: 'upgrade',
      source_token: 'MKR',
      amount: number
    }
    ```
  - Revert SKY to MKR
    ```ts
    {
      network: 'mainnet',
      widget: 'upgrade',
      flow: 'revert',
      source_token: 'SKY',
    }
    ```
  - Revert {{amount}} SKY to MKR
    ```ts
    {
      network: 'mainnet',
      widget: 'upgrade',
      flow: 'revert',
      source_token: 'SKY',
      amount: number
    }
    ```
  - Upgrade DAI to USDS
    ```ts
    {
      network: 'mainnet',
      widget: 'upgrade',
      flow: 'upgrade',
      source_token: 'DAI',
    }
    ```
  - Upgrade {{amount}} DAI to USDS
    ```ts
    {
      network: 'mainnet',
      widget: 'upgrade',
      flow: 'upgrade',
      source_token: 'DAI',
      amount: number
    }
    ```
  - Revert USDS to DAI
    ```ts
    {
      network: 'mainnet',
      widget: 'upgrade',
      flow: 'revert',
      source_token: 'USDS',
    }
    ```
  - Revert {{amount}} USDS to DAI
    ```ts
    {
      network: 'mainnet',
      widget: 'upgrade',
      flow: 'revert',
      source_token: 'USDS',
      amount: number
    }
    ```

### **Trade**

Each network supports different trading pairs:

**Mainnet**
Supported tokens: USDC, USDT, ETH, WETH, DAI, MKR, USDS, sUSDS, SKY

- All token combinations are valid except:
  - ETH <> WETH pairs
  - Same token pairs (e.g. USDS <> USDS)

**Base**
Supported pairs:

- USDC <> USDS
- USDC <> sUSDS
- USDS <> sUSDS

**Arbitrum**
Supported pairs:

- USDC <> USDS
- USDC <> sUSDS
- USDS <> sUSDS

Trade actions:

type MainnetToken = 'USDC' | 'USDT' | 'ETH' | 'WETH' | 'DAI' | 'MKR' | 'USDS' | 'sUSDS' | 'SKY'

- **Mainnet**

  - Go to Trade
    ```ts
    {
      network: 'mainnet',
      widget: 'trade'
    }
    ```
  - Trade to {{target_token}}
    ```ts
    {
      network: 'mainnet',
      widget: 'trade',
      target_token: MainnetToken
    }
    ```
  - Trade {{source_token}}
    ```ts
    {
      network: 'mainnet',
      widget: 'trade',
      source_token: MainnetToken
    }
    ```
  - Trade {{amount}} {{source_token}}
    ```ts
    {
      network: 'mainnet',
      widget: 'trade',
      source_token: MainnetToken,
      amount: number
    }
    ```
  - Trade {{source_token}} to {{target_token}}
    ```ts
    {
      network: 'mainnet',
      widget: 'trade',
      source_token: MainnetToken,
      target_token: MainnetToken
    }
    ```
  - Trade {{amount}} {{source_token}} to {{target_token}}
    ```ts
    {
      network: 'mainnet',
      widget: 'trade',
      source_token: MainnetToken,
      target_token: MainnetToken,
      amount: number
    }
    ```

- **Base**

  - Go to Trade
    ```ts
    {
      network: 'base',
      widget: 'trade'
    }
    ```
    // Same trade actions as mainnet but with Base-specific token types
    // (USDC, USDS, sUSDS)

- **Arbitrum**
  - Go to Trade
    ```ts
    {
      network: 'arbitrum',
      widget: 'trade'
    }
    ```
    // Same trade actions as mainnet but with Arbitrum-specific token types
    // (USDC, USDS, sUSDS)

### **Seal (WIP)**

TODO add params

- **Mainnet**
  - Open seal position
  - Modify existing seal position
  - Claim rewards on existing position

### _Potential Additions:_

### **Balances**

TODO add params

- **All Networks**

  - View assets
  - View TX history

- **Mainnet**

  - View assets
  - View TX history

- **Base**

  - View assets
  - View TX history

- **Arbitrum**
  - View assets
  - View TX history
