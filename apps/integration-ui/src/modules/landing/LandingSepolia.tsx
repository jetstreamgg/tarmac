// import { useCallback, useState } from 'react';
import {
  TradeWidget,
  ExternalWidgetState,
  BalancesWidget,
  WidgetStateChangeParams
} from '@jetstreamgg/widgets';
import { ConnectButton, useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { useCustomConnectModal } from '../hooks/useCustomConnectModal';
// import HooksTesting from './HooksTesting';
import { useState } from 'react';
import { HistoryTesting } from './HistoryTesting';
import { formatNumber } from '@jetstreamgg/utils';

export type CustomNavigation = { href: string; label: string };
// Style container div for widget
const widgetContainerStyle =
  'bg-card m-2 min-w-[416px] max-w-[376px] rounded-[20px] lg:p-5 lg:pt-11 lg:pr-2.5';

export function LandingSepolia(): React.ReactElement {
  const addRecentTransaction = useAddRecentTransaction();
  const onConnect = useCustomConnectModal();
  //const [customNavigation, setCustomNavigation] = useState<CustomNavigation>();

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

  // // Used for testing trade linked action
  const onTradeWidgetStateChange = ({
    txStatus,
    widgetState,
    executedBuyAmount,
    executedSellAmount
  }: WidgetStateChangeParams) => {
    console.log(txStatus, widgetState, executedBuyAmount, executedSellAmount);
    // if (txStatus === TxStatus.SUCCESS && widgetState.action === TradeAction.TRADE) {
    //   setCustomNavigation((prevState: any) => {
    //     if (prevState?.href === '/mock-linked-action' && prevState.label === 'Trade Linked Action')
    //       return prevState;
    //     return { href: '/mock-linked-action', label: 'Trade Linked Action' };
    //   });
    // } else {
    //   setCustomNavigation(undefined);
    // }
  };

  // Helper to make it easy to show/hide widgets while developing
  const widgetsToShow = ['trade', 'balances'];

  const [tradeInitialState, setTradeInitialState] = useState<ExternalWidgetState>({});

  return (
    <div className="p-8">
      <div className="mb-8">
        <ConnectButton />
      </div>
      <p className="m-2 w-1/3 bg-white p-2">{JSON.stringify(tradeInitialState)}</p>
      <div className="flex flex-row space-x-4">
        <button
          onClick={() => {
            setTradeInitialState({ amount: '2', token: 'USDC', targetToken: 'USDS', timestamp: Date.now() });
          }}
          className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
        >
          Trade 2 USDC to USDS
        </button>
        <button
          onClick={() => {
            setTradeInitialState({ amount: '999', token: 'USDT', targetToken: 'DAI', timestamp: Date.now() });
          }}
          className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
        >
          Trade 999 USDT to DAI
        </button>
        <button
          onClick={() => {
            setTradeInitialState({ amount: '50', token: 'USDT', targetToken: 'USDC', timestamp: Date.now() });
          }}
          className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
        >
          Trade 50 USDT to USDC
        </button>
        <button
          onClick={() => {
            setTradeInitialState({ amount: '0.1', token: 'ETH', targetToken: 'DAI', timestamp: Date.now() });
          }}
          className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
        >
          Trade 0.1 ETH to DAI
        </button>
      </div>
      <div className="flex flex-col">
        <div className="flex h-[750px] space-x-4 overflow-hidden overflow-x-visible p-4">
          {widgetsToShow.includes('balances') && (
            <div className={widgetContainerStyle}>
              <BalancesWidget
                onConnect={onConnect}
                locale="en"
                rightHeaderComponent={undefined}
                externalWidgetState={{ flow: 'funds' }}
                hideModuleBalances={false}
                actionForToken={(symbol, balance) => {
                  // TODO: The host app should provide this action for each supported asset
                  return symbol.toLowerCase() === 'dai'
                    ? {
                        label: `Upgrade your ${formatNumber(
                          parseFloat(balance)
                        )} ${symbol.toUpperCase()} to USDS and start getting Sky Token Rewards`,
                        actionUrl: '?widget=upgrade',
                        image: `/tokens/actions/${symbol.toLowerCase()}.png`
                      }
                    : undefined;
                }}
                onClickRewardsCard={() => {}}
                onClickSavingsCard={() => {}}
                // onStateValidated={state => {
                //   console.log('validated balances widget state: ', state);
                // }}
                // enabled={false}
              />
            </div>
          )}
          {widgetsToShow.includes('trade') && (
            <div className={widgetContainerStyle}>
              <TradeWidget
                key={tradeInitialState?.timestamp}
                onConnect={onConnect}
                addRecentTransaction={addRecentTransaction}
                locale="en"
                rightHeaderComponent={undefined}
                externalWidgetState={tradeInitialState}
                // customTokenList={[
                //   {
                //     address: '0xbe72E441BF55620febc26715db68d3494213D8Cb',
                //     decimals: 18,
                //     symbol: 'USDC',
                //     name: 'USD Coin',
                //     isNative: false
                //   },
                //   {
                //     address: '0x58Eb19eF91e8A6327FEd391b51aE1887b833cc91',
                //     decimals: 18,
                //     symbol: 'USDT',
                //     name: 'Tether USD',
                //     isNative: false
                //   }
                // ]}
                onWidgetStateChange={onTradeWidgetStateChange}
                // customNavigationLabel={customNavigation?.label}
                // onCustomNavigation={onNavigate}
                //externalWidgetState={{ targetToken: 'DAI' }}
                // onStateValidated={state => {
                //   console.log('validated trade widget state: ', state);
                // }}
                // onNotification={notification => {
                //   console.log('notification from trade widget: ', notification);
                // }}
                // enabled={false}
              />
            </div>
          )}
        </div>
        <div>
          <HistoryTesting />
        </div>
        {/* <div>
          <HooksTesting />
        </div> */}
      </div>
    </div>
  );
}
