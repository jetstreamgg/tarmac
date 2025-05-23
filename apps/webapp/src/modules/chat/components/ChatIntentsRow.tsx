import { Button } from '@/components/ui/button';
import { ChatIntent } from '../types/Chat';
import { Text } from '@/modules/layout/components/Typography';
import { useChatContext } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import { useRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { intentSelectedMessage } from '../lib/intentSelectedMessage';
import { QueryParams } from '@/lib/constants';
import { useNetworkFromIntentUrl } from '../hooks/useNetworkFromUrl';
import { chainIdNameMapping } from '../lib/intentUtils';
import { useChainId } from 'wagmi';
import { ConfirmationWarningRow } from './ConfirmationWarningRow';
import { HStack } from '@/modules/layout/components/HStack';
import { Info } from '@/modules/icons';
import { Tooltip, TooltipArrow, TooltipPortal, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/ui/tooltip';
import { Trans } from '@lingui/react/macro';

const addResetParam = (url: string): string => {
  try {
    const urlObj = new URL(url, window.location.origin);
    urlObj.searchParams.set(QueryParams.Reset, 'true');
    return urlObj.pathname + urlObj.search;
  } catch (error) {
    console.error('Failed to parse URL:', error);
    return url;
  }
};

const intents2 = [
  // Trade intents
  {
    intent_id: 'trade_1',
    title: 'Trade 500 USDS to USDC',
    url: '/?widget=trade&network=new-base-testnet-jan-27&source_token=USDS&target_token=USDC&input_amount=500&reset=true'
  },
  {
    intent_id: 'trade_2',
    title: 'Trade 100 ETH to USDC',
    url: '/?widget=trade&network=mainnet_2025_apr_15_0&source_token=ETH&target_token=USDC&input_amount=100&reset=true'
  },
  {
    intent_id: 'trade_3',
    title: 'Trade 1000 USDC to USDS',
    url: '/?widget=trade&network=arbitrum_fork_feb_7&source_token=USDC&target_token=USDS&input_amount=1000&reset=true'
  },
  {
    intent_id: 'trade_4',
    title: 'Trade 50 WETH to USDS',
    url: '/?widget=trade&network=new-base-testnet-jan-27&source_token=WETH&target_token=USDS&input_amount=50&reset=true'
  },

  // Savings intents
  {
    intent_id: 'savings_1',
    title: 'Deposit 20 USDS to Savings',
    url: '/?widget=savings&network=new-base-testnet-jan-27&source_token=USDS&reset=true&input_amount=20'
  },
  {
    intent_id: 'savings_2',
    title: 'View Savings on Arbitrum',
    url: '/?widget=savings&network=arbitrum_fork_feb_7&reset=true'
  },
  {
    intent_id: 'savings_3',
    title: 'Withdraw 15 USDS from Savings',
    url: '/?widget=savings&network=new-base-testnet-jan-27&source_token=USDS&flow=withdraw&reset=true&input_amount=15'
  },

  // Upgrade intents (Ethereum only)
  {
    intent_id: 'upgrade_1',
    title: 'Upgrade 1000 DAI to USDS',
    url: '/?widget=upgrade&network=mainnet_2025_apr_15_0&source_token=DAI&input_amount=1000&reset=true'
  },
  {
    intent_id: 'upgrade_2',
    title: 'Upgrade 10 MKR to SKY',
    url: '/?widget=upgrade&network=mainnet_2025_apr_15_0&source_token=MKR&input_amount=10&reset=true'
  },
  {
    intent_id: 'upgrade_3',
    title: 'Revert 500 USDS to DAI',
    url: '/?widget=upgrade&network=mainnet_2025_apr_15_0&source_token=USDS&flow=revert&input_amount=500&reset=true'
  },

  // Rewards intents
  {
    intent_id: 'rewards_1',
    title: 'Supply 1000 USDS for SKY Rewards',
    url: '/?widget=rewards&network=mainnet_2025_apr_15_0&flow=supply&input_amount=1000&reward=0x0650CAF159C5A49f711e8169D4336ECB9b950275&reset=true'
  },
  {
    intent_id: 'rewards_2',
    title: 'Supply 500 USDS for Chronicle Points',
    url: '/?widget=rewards&network=mainnet_2025_apr_15_0&flow=supply&input_amount=500&reward=0x10ab606B067C9C461d8893c47C7512472E19e2Ce&reset=true'
  },
  {
    intent_id: 'rewards_3',
    title: 'Withdraw 200 USDS from SKY Rewards',
    url: '/?widget=rewards&network=mainnet_2025_apr_15_0&flow=withdraw&input_amount=200&reward=0x0650CAF159C5A49f711e8169D4336ECB9b950275&reset=true'
  },
  {
    intent_id: 'rewards_4',
    title: 'Claim SKY Rewards',
    url: '/?widget=rewards&network=mainnet_2025_apr_15_0&flow=claim&reward=0x0650CAF159C5A49f711e8169D4336ECB9b950275&reset=true'
  },
  {
    intent_id: 'rewards_5',
    title: 'Claim Chronicle Points',
    url: '/?widget=rewards&network=mainnet_2025_apr_15_0&flow=claim&reward=0x10ab606B067C9C461d8893c47C7512472E19e2Ce&reset=true'
  },

  // Stake intents (Ethereum only)
  {
    intent_id: 'stake_1',
    title: 'Open a new Stake position',
    url: '/?widget=stake&network=mainnet_2025_apr_15_0&flow=open&reset=true'
  },
  {
    intent_id: 'stake_2',
    title: 'Manage my Stake position (Urn 5)',
    url: '/?widget=stake&network=mainnet_2025_apr_15_0&flow=manage&urn_index=4&reset=true'
  },
  {
    intent_id: 'stake_3',
    title: 'Lock 10 SKY in my Stake position (Urn 3)',
    url: '/?widget=stake&network=mainnet_2025_apr_15_0&flow=manage&urn_index=2&stake_tab=lock&input_amount=10&reset=true'
  },
  {
    intent_id: 'stake_4',
    title: 'Repay debt for my Stake position (Urn 1)',
    url: '/?widget=stake&network=mainnet_2025_apr_15_0&flow=manage&urn_index=0&stake_tab=free&reset=true'
  },

  // Balances intents
  {
    intent_id: 'balances_1',
    title: 'View Funds on Base',
    url: '/?widget=balances&network=new-base-testnet-jan-27&flow=funds&reset=true'
  },
  {
    intent_id: 'balances_2',
    title: 'Check Arbitrum Funds',
    url: '/?widget=balances&network=arbitrum_fork_feb_7&flow=funds&reset=true'
  },
  {
    intent_id: 'balances_3',
    title: 'View Ethereum Funds',
    url: '/?widget=balances&network=mainnet_2025_apr_15_0&flow=funds&reset=true'
  },
  {
    intent_id: 'balances_4',
    title: 'View Base Transaction History',
    url: '/?widget=balances&network=new-base-testnet-jan-27&flow=tx_history&reset=true'
  },
  {
    intent_id: 'balances_5',
    title: 'Check Arbitrum Transaction History',
    url: '/?widget=balances&network=arbitrum_fork_feb_7&flow=tx_history&reset=true'
  },
  {
    intent_id: 'balances_6',
    title: 'View Ethereum Transaction History',
    url: '/?widget=balances&network=mainnet_2025_apr_15_0&flow=tx_history&reset=true'
  }
];

export const ChatIntentsRow = () => {
  const { shouldShowConfirmationWarning, shouldDisableActionButtons } = useChatContext();

  return (
    <div>
      <HStack>
        <Text className="mr-2 text-xs italic text-gray-500">
          <Trans>Try a suggested action</Trans>
        </Text>
        <Tooltip>
          <TooltipTrigger asChild className="cursor-pointer text-gray-400">
            <Info width={12} height={12} />
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent arrowPadding={10} className="max-w-[300px]">
              <Text variant="small">
                <Trans>
                  Selecting a suggested action will prefill transaction details, but execution still requires
                  user review and confirmation.
                </Trans>
              </Text>
              <TooltipArrow width={12} height={8} />
            </TooltipContent>
          </TooltipPortal>
        </Tooltip>
      </HStack>
      <div className="mt-2 flex flex-wrap gap-2">
        {intents2.map((intent, index) => (
          <IntentRow
            key={index}
            intent={{ ...intent, url: addResetParam(intent.url) }}
            shouldDisableActionButtons={shouldDisableActionButtons}
          />
        ))}
      </div>
      {shouldShowConfirmationWarning && <ConfirmationWarningRow />}
    </div>
  );
};

type IntentRowProps = {
  intent: ChatIntent;
  shouldDisableActionButtons: boolean;
};

const IntentRow = ({ intent, shouldDisableActionButtons }: IntentRowProps) => {
  const chainId = useChainId();
  const { setConfirmationWarningOpened, setSelectedIntent, setChatHistory, hasShownIntent } =
    useChatContext();
  const navigate = useNavigate();
  const intentUrl = useRetainedQueryParams(intent?.url || '', [
    QueryParams.Locale,
    QueryParams.Details,
    QueryParams.Chat
  ]);

  const network =
    useNetworkFromIntentUrl(intentUrl) || chainIdNameMapping[chainId as keyof typeof chainIdNameMapping];
  // const modifiesState = intentModifiesState(intent);
  const modifiesState = false;

  return (
    <Button
      variant="suggest"
      disabled={shouldDisableActionButtons}
      onClick={() => {
        setConfirmationWarningOpened(false);

        if (!hasShownIntent(intent) && modifiesState) {
          setConfirmationWarningOpened(true);
          setSelectedIntent(intent);
        } else {
          setChatHistory(prev => [...prev, intentSelectedMessage(intent)]);
          navigate(intentUrl);
        }
      }}
    >
      {intent.title}
      {network && (
        <img
          src={`/networks/${network}.svg`}
          alt={`${network} logo`}
          className={`ml-2 h-5 w-5 ${shouldDisableActionButtons ? 'opacity-30' : ''}`}
        />
      )}
    </Button>
  );
};
