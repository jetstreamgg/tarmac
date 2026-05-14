# Upgrade Widget

The **Upgrade Widget** is a React component that allows users to upgrade or downgrade their tokens, providing an interface to manage token conversions.

## Installation

```shell
npm install @jetstreamgg/sky-widgets
```

## Example Usage

```jsx
import { UpgradeWidget } from '@jetstreamgg/sky-widgets';

function UpgradePage() {
  return (
    <div>
      <h2>Upgrade Page</h2>
      <UpgradeWidget
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

## UpgradeWidgetProps

In addition to `WidgetProps`, `UpgradeWidget` component also accepts the following props:

- `onCustomNavigation?: () => void;`
  - A callback function that is called when the custom navigation button is clicked.
- `customNavigationLabel?: string;`
  - A label for the custom navigation button.
- `onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;`
  - A callback function that is called when an external link is clicked. It receives the click event as an argument.
