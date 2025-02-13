import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { BalancesWidgetDisplay } from './widgets/BalancesWidgetDisplay';
import { SavingsWidgetDisplay } from './widgets/SavingsWidgetDisplay';
import { RewardsWidgetDisplay } from './widgets/RewardsWidgetDisplay';
import { UpgradeWidgetDisplay } from './widgets/UpgradeWidgetDisplay';
import { TradeWidgetDisplay } from './widgets/TradeWidgetDisplay';
import { SealModuleWidgetDisplay } from './widgets/SealModuleWidgetDisplay';
import { ExternalWidgetState, SavingsFlow, RewardsFlow } from '@jetstreamgg/widgets';
import { ActionButtons } from './components/ActionButtons';

export type CustomNavigation = { href: string; label: string };
// Style container div for widget
const widgetContainerStyle =
  'bg-card m-2 min-w-[416px] max-w-[376px] rounded-[20px] lg:p-5 lg:pt-11 lg:pr-2.5';

export function Landing(): React.ReactElement {
  // const { address } = useAccount();
  // const [customNavigation, setCustomNavigation] = useState<CustomNavigation>();

  // // Agnostic navigation function could use any library
  // const onNavigate = useCallback(() => {
  //   if (customNavigation?.href) window.location.href = customNavigation.href;
  // }, [customNavigation]);

  // // Used for testing upgrade linked action
  // const onUpgradeWidgetStateChange = ({ txStatus, widgetState }: WidgetStateChangeParams) => {
  //   if (txStatus === TxStatus.SUCCESS && widgetState.action === UpgradeAction.UPGRADE) {
  //     setCustomNavigation((prevState: any) => {
  //       if (prevState?.href === '/mock-linked-action' && prevState.label === 'Linked Action Button')
  //         return prevState;
  //       return { href: '/mock-linked-action', label: 'Linked Action Button' };
  //     });
  //   } else {
  //     setCustomNavigation(undefined);
  //   }
  // };

  // Used for testing trade linked action
  // const onTradeWidgetStateChange = ({
  //   txStatus,
  //   widgetState,
  //   executedSellAmount,
  //   executedBuyAmount
  // }: WidgetStateChangeParams) => {
  //   if (txStatus === TxStatus.SUCCESS && widgetState.action === TradeAction.TRADE) {
  //     setCustomNavigation((prevState: any) => {
  //       if (prevState?.href === '/mock-linked-action' && prevState.label === 'Trade Linked Action')
  //         return prevState;
  //       return { href: '/mock-linked-action', label: 'Trade Linked Action' };
  //     });
  //   } else {
  //     setCustomNavigation(undefined);
  //   }
  // };

  const [activeWidget, setActiveWidget] = useState<string>('Seal');
  const [upgradeInitialState, setUpgradeInitialState] = useState<ExternalWidgetState>({
    initialUpgradeToken: 'DAI'
  });
  const [rewardsInitialState, setRewardsInitialState] = useState<ExternalWidgetState>({
    flow: RewardsFlow.SUPPLY
  });
  const [savingsInitialState, setSavingsInitialState] = useState<ExternalWidgetState>({
    flow: SavingsFlow.SUPPLY
  });
  const [sealInitialState, setSealInitialState] = useState<ExternalWidgetState>({
    urnIndex: undefined
  });

  const widgetsToShow = ['balances', 'rewards', 'savings', 'upgrade', 'trade', 'Seal'];

  const renderActiveWidget = () => {
    switch (activeWidget) {
      case 'balances':
        return <BalancesWidgetDisplay />;
      case 'savings':
        return <SavingsWidgetDisplay externalWidgetState={savingsInitialState} />;
      case 'rewards':
        return <RewardsWidgetDisplay externalWidgetState={rewardsInitialState} />;
      case 'upgrade':
        return <UpgradeWidgetDisplay externalWidgetState={upgradeInitialState} />;
      case 'trade':
        return <TradeWidgetDisplay />;
      case 'Seal':
        return (
          <SealModuleWidgetDisplay
            externalWidgetState={sealInitialState}
            setSealInitialState={setSealInitialState}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <ConnectButton />
      </div>

      <div className="mb-4 flex flex-row space-x-4">
        <div>
          <select
            value={activeWidget}
            onChange={e => setActiveWidget(e.target.value)}
            className="rounded border p-2"
          >
            {widgetsToShow.map(widget => (
              <option key={widget} value={widget}>
                {widget.charAt(0).toUpperCase() + widget.slice(1)} Widget
              </option>
            ))}
          </select>
        </div>

        <ActionButtons
          activeWidget={activeWidget}
          setUpgradeInitialState={setUpgradeInitialState}
          setRewardsInitialState={setRewardsInitialState}
          setSavingsInitialState={setSavingsInitialState}
          setSealInitialState={setSealInitialState}
        />
      </div>

      <div className="flex flex-col">
        <div className="flex h-[750px] space-x-4 p-4">
          <ErrorBoundary>
            <div className={widgetContainerStyle}>{renderActiveWidget()}</div>
          </ErrorBoundary>
        </div>
        {/* TODO move these to the widget display pages */}
        {/* <div className="flex flex-col space-x-4">
          <div>
            <HistoryTesting />
          </div>
          <div>
            <HooksTesting />
          </div>
        </div> */}
      </div>
    </div>
  );
}
