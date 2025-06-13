# Savings Widget

The **Savings Widget** is a React component that provides interactions with the SKY Savings Rate, allowing users to supply and withdraw from the contract.

## Installation

```shell
npm install @jetstreamgg/sky-widgets
```

## Example Usage

```jsx
import { SavingsWidget } from '@jetstreamgg/sky-widgets';

function SavingsPage() {
  return (
    <div>
      <h2>Savings Page</h2>
      <SavingsWidget
        onConnect={onConnect}
        addRecentTransaction={addRecentTransaction}
        locale="en-US"
        rightHeaderComponent={<CustomButton />}
        externalWidgetState={/* initial state */}
        onStateValidated={onStateValidated}
        onNotification={onNotification}
        onWidgetStateChange={onWidgetStateChange}
        enabled={true}
      />
    </div>
  );
}
```

## SavingsWidgetProps

In addition to `WidgetProps`, `SavingsWidget` component also accepts the following props:

- `onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;`
  - A callback function that is called when an external link is clicked. It receives the click event as an argument.

...
