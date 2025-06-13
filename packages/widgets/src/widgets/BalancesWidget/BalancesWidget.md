# Balances Widget

The **Balances Widget** is a React component that allows users to manage their token balances and interact with various modules like Rewards and Savings.

## Installation

```shell
npm install @jetstreamgg/sky-widgets
```

## Example Usage

```jsx
import { BalancesWidget } from '@jetstreamgg/sky-widgets';

function BalancesPage() {
  return (
    <div>
      <h2>Balances Page</h2>
      <BalancesWidget
        onConnect={onConnect}
        locale="en-US"
        rightHeaderComponent={<CustomButton />}
        externalWidgetState={/* initial state */}
        onStateValidated={onStateValidated}
        hideModuleBalances={false}
        enabled={true}
        actionForToken={actionForToken}
        rewardsCardUrl={rewardsCardUrl}
        savingsCardUrlMap={savingsCardUrlMap}
      />
    </div>
  );
}
```

## BalancesWidgetProps

In addition to `WidgetProps`, `BalancesWidget` component also accepts the following props:

- `customTokenMap?: { [chainId: number]: TokenForChain[]; }`
  - A map of custom tokens to be used in the widget. If provided, this map will override the default list.
- `hideModuleBalances?: boolean;`
  - A boolean to hide or show module balances.
- `actionForToken?: (symbol: string, balance: string, tokenChainId: number) => { label: string; actionUrl: string; image: string } | undefined;`
  - A function to define actions for a specific token.
- `rewardsCardUrl?: string;`
  - A url to navigate to when the rewards card is clicked.
- `savingsCardUrlMap?: Record<number, string>;`
  - A map of chain ids to urls to navigate to when the savings card is clicked.
- `sealCardUrl?: string;`
  - A url to navigate to when the seal card is clicked.
