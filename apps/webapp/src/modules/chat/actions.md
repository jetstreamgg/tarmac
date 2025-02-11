### **Rewards**

- **Mainnet**
  - Claim SKY rewards to With: USDS | Get: SKY
    ```ts
    {
      widget: 'rewards',
      operation: 'claim',
      reward: '<0x123>'
    }
    ```
  - Supply USDS to With: USDS | Get: SKY
    ```ts
    {
      widget: 'rewards',
      operation: 'supply',
      reward: '<0x123>',
    }
    ```
  - Supply {{amount}} USDS to With: USDS | Get: SKY
    ```ts
    {
      widget: 'rewards',
      operation: 'supply',
      reward: '<0x123>',
      amount: number
    }
    ```
  - Withdraw USDS from With: USDS | Get: SKY
    ```ts
    {
      widget: 'rewards',
      operation: 'withdraw',
      reward: '<0x123>'
    }
    ```
  - Withdraw {{amount}} USDS from With: USDS | Get: SKY
    ```ts
    {
      widget: 'rewards',
      operation: 'withdraw',
      reward: '<0x123>',
      amount: number
    }
    ```
  - Supply USDS to With: USDS | Get: Chronicle Points
    ```ts
    {
      widget: 'rewards',
      operation: 'supply',
      reward: '<0x123>'
    }
    ```
  - Supply {{amount}} USDS to With: USDS | Get: Chronicle Points
    ```ts
    {
      widget: 'rewards',
      operation: 'supply',
      reward: '<0x123>',
      amount: number
    }
    ```
  - Withdraw USDS from With: USDS | Get: Chronicle Points
    ```ts
    {
      widget: 'rewards',
      operation: 'withdraw',
      reward: '<0x123>'
    }
    ```
  - Withdraw {{amount}} USDS from With: USDS | Get: Chronicle Points
    ```ts
    {
      widget: 'rewards',
      operation: 'withdraw',
      reward: '<0x123>',
      amount: number
    }
    ```

### **Savings**

- **Mainnet**
  - Deposit USDS
    ```ts
    {
      widget: 'savings',
      operation: 'deposit',
      token: 'USDS'
    }
    ```
  - Deposit {{amount}} USDS
    ```ts
    {
      widget: 'savings',
      operation: 'deposit',
      token: 'USDS',
      amount: number
    }
    ```
  - Withdraw USDS
    ```ts
    {
      widget: 'savings',
      operation: 'withdraw',
      token: 'USDS'
    }
    ```
  - Withdraw {{amount}} USDS
    ```ts
    {
      widget: 'savings',
      operation: 'withdraw',
      token: 'USDS',
      amount: number
    }
    ```
- **Base**
  - Deposit USDS
    ```ts
    {
      widget: 'savings',
      operation: 'deposit',
      token: 'USDS'
    }
    ```
  - Deposit {{amount}} USDS
    ```ts
    {
      widget: 'savings',
      operation: 'deposit',
      token: 'USDS',
      amount: number
    }
    ```
  - Deposit USDC
    ```ts
    {
      widget: 'savings',
      operation: 'deposit',
      token: 'USDC'
    }
    ```
  - Deposit {{amount}} USDC
    ```ts
    {
      widget: 'savings',
      operation: 'deposit',
      token: 'USDC',
      amount: number
    }
    ```
  - Withdraw USDS
    ```ts
    {
      widget: 'savings',
      operation: 'withdraw',
      token: 'USDS'
    }
    ```
  - Withdraw {{amount}} USDS
    ```ts
    {
      widget: 'savings',
      operation: 'withdraw',
      token: 'USDS',
      amount: number
    }
    ```
  - Withdraw USDC
    ```ts
    {
      widget: 'savings',
      operation: 'withdraw',
      token: 'USDC'
    }
    ```
  - Withdraw {{amount}} USDC
    ```ts
    {
      widget: 'savings',
      operation: 'withdraw',
      token: 'USDC',
      amount: number
    }
    ```
- **Arbitrum**
  - Deposit USDS
    ```ts
    {
      widget: 'savings',
      operation: 'deposit',
      token: 'USDS'
    }
    ```
  - Deposit {{amount}} USDS
    ```ts
    {
      widget: 'savings',
      operation: 'deposit',
      token: 'USDS',
      amount: number
    }
    ```
  - Deposit USDC
    ```ts
    {
      widget: 'savings',
      operation: 'deposit',
      token: 'USDC'
    }
    ```
  - Deposit {{amount}} USDC
    ```ts
    {
      widget: 'savings',
      operation: 'deposit',
      token: 'USDC',
      amount: number
    }
    ```
  - Withdraw USDS
    ```ts
    {
      widget: 'savings',
      operation: 'withdraw',
      token: 'USDS'
    }
    ```
  - Withdraw {{amount}} USDS
    ```ts
    {
      widget: 'savings',
      operation: 'withdraw',
      token: 'USDS',
      amount: number
    }
    ```
  - Withdraw USDC
    ```ts
    {
      widget: 'savings',
      operation: 'withdraw',
      token: 'USDC'
    }
    ```
  - Withdraw {{amount}} USDC
    ```ts
    {
      widget: 'savings',
      operation: 'withdraw',
      token: 'USDC',
      amount: number
    }
    ```

### **Upgrade**

- **Mainnet**
  - Upgrade MKR to SKY
  - Revert SKY to MKR
  - Upgrade DAI to USDS
  - Revert USDS to DAI

### **Trade**

- **Mainnet**
  - Trade `<add pairs>`
- **Base**
  - Trade USDC ↔ USDS
  - Trade USDC ↔ sUSDS
  - Trade USDS ↔ sUSDS
- **Arbitrum**
  - Trade USDC ↔ USDS
  - Trade USDC ↔ sUSDS
  - Trade USDS ↔ sUSDS

### **Seal (WIP)**

- **Mainnet**
  - Open seal position
  - Modify existing seal position
  - Claim rewards on existing position

### _Potential Additions:_

### **Balances**

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
