# Rewards Widget

The **Rewards Widget** is a React component that allows users to participate in Sky Token Rewards, providing an interface to supply tokens, earn rewards, and manage their supplied positions.

## Installation

```shell
npm install @jetstreamgg/sky-widgets
```

## Example Usage

```jsx
import { RewardsWidget } from '@jetstreamgg/sky-widgets';

function RewardsPage() {
  return (
    <div>
      <h2>Rewards Page</h2>
      <RewardsWidget
        onConnect={onConnect}
        addRecentTransaction={addRecentTransaction}
        locale="en-US"
        rightHeaderComponent={<CustomButton />}
        externalWidgetState={/* initial state */}
        onStateValidated={onStateValidated}
        onNotification={onNotification}
        onWidgetStateChange={onWidgetStateChange}
        onRewardContractChange={onRewardContractChange}
        enabled={true}
      />
    </div>
  );
}
```

## RewardsWidgetProps

In addition to `WidgetProps`, `RewardsWidget` component also accepts the following props:

- `onRewardContractChange?: (rewardContract?: RewardContract) => void;`

  - A callback function that is called when the selected reward contract changes. It receives the new reward contract as an argument.

- `onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;`
  - A callback function that is called when an external link is clicked. It receives the click event as an argument.
