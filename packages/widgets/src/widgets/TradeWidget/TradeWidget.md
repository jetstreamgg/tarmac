# Trade Widget

The **Trade Widget** is a React component that allows users to trade between different tokens, providing an interface to manage token exchanges.

## Installation

```shell
npm install @jetstreamgg/sky-widgets
```

## Example Usage

```jsx
import { TradeWidget } from '@jetstreamgg/sky-widgets';

function TradePage() {
  return (
    <div>
      <h2>Trade Page</h2>
      <TradeWidget
        onConnect={onConnect}
        addRecentTransaction={addRecentTransaction}
        locale="en-US"
        rightHeaderComponent={<CustomButton />}
        externalWidgetState={/* initial state */}
        onStateValidated={onStateValidated}
        onNotification={onNotification}
        onWidgetStateChange={onWidgetStateChange}
        onCustomNavigation={onCustomNavigation}
        customNavigationLabel="Go to Dashboard"
        enabled={true}
      />
    </div>
  );
}
```

## TradeWidgetProps

In addition to `WidgetProps`, `TradeWidget` component also accepts the following props:

- `onCustomNavigation?: () => void;`
  - A callback function that is called when the custom navigation button is clicked.
- `customNavigationLabel?: string;`
  - A label for the custom navigation button.
- `customTokenList?: TokenForChain[];`
  - A list of custom tokens to be used in the widget. If provided, this list will override the default list.
- `disallowedPairs?: { [key: string]: string[] };`
  - A list of token pairs that are not allowed to be traded.
- `onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;`
  - A callback function that is called when an external link is clicked. It receives the click event as an argument.

#### Configuring the Trade options

You can configure the trade options by adding the following optional properties to the `defaultConfig` object:

```ts
tradeTokenList;
tradeDisallowedPairs;
```

The `tradeTokenList` is an object that contain an array of tokens for each network that will be displayed in the trade widget.

The trade widget has a set of predefined tokens, but you can add your own by using the `customTokenList` prop.

If provided, this list will override the default list.

```ts
// Here we define a list of tokens both for the mainnet and the Tenderly testnet
tradeTokenList: {
    1: [
      {
        address: '0x...',
        decimals: 18,
        symbol: 'XYZ',
        name: 'XYZ token',
        color: ''
      }
    ],
    314310: [
      {
        address: '0x...',
        decimals: 18,
        symbol: 'XYZ',
        name: 'XYZ token',
        color: ''
      }
    ]
  }
```

The `tradeDisallowedPairs` is an object that defines the list of pairs that cannot be traded. By default, the trade widget allows trading any token with any other token. However, if you want to prevent specific pairs from being traded, you can add them to the `tradeDisallowedPairs` object. Note that the pairs are defined by the `symbol` property of the token. So, if you want to specify disallowed pairs, ensure you've added the `symbol` property to the tokens in the `tradeTokenList`. You don't need to add the pairs in both directions, as the trade widget will automatically calculate the reverse pair based on the `tradeDisallowedPairs` object.

```ts
tradeDisallowedPairs: {
    WETH: ['USDC', 'USDT'],
    USDC: ['WETH', 'USDT', 'USDS'],
    XYZ: ['WETH', 'USDT', 'USDS', 'ABC'],
    // ... add more pairs as needed
  }
```
