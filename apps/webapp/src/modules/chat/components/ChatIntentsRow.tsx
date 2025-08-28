import { Button } from '@/components/ui/button';
import { ChatIntent } from '../types/Chat';
import { Text } from '@/modules/layout/components/Typography';
import { useChatContext } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import { useRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { intentSelectedMessage } from '../lib/intentSelectedMessage';
import { QueryParams } from '@/lib/constants';
import { useNetworkFromIntentUrl } from '../hooks/useNetworkFromUrl';
import { chainIdNameMapping, intentModifiesState, getNetworkDisplayName } from '../lib/intentUtils';
import { useChainId } from 'wagmi';
import { ConfirmationWarningRow } from './ConfirmationWarningRow';
import { HStack } from '@/modules/layout/components/HStack';
import {
  ArbitrumChain as Arbitrumone,
  MainnetChain as Ethereum,
  OptimismChain as Opmainnet,
  BaseChain as Base,
  UnichainChain as Unichain
} from '@/modules/icons';
import { InfoTooltip } from '@/components/InfoTooltip';
import { Trans } from '@lingui/react/macro';
import { capitalizeFirstLetter } from '@/lib/helpers/string/capitalizeFirstLetter';
import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/components/ui/tooltip';
import { VStack } from '@/modules/layout/components/VStack';

type ChatIntentsRowProps = {
  intents: ChatIntent[];
};

// Grouped intent structure - each title can have multiple network variants
type GroupedIntent = {
  title: string;
  intents: ChatIntent[];
  // TODO: Add priority field when it becomes available from the endpoint
  // priority?: number;
};

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

export const ChatIntentsRow = ({ intents }: ChatIntentsRowProps) => {
  console.log('🚀 ~ ChatIntentsRow ~ intents:', intents);
  const { shouldShowConfirmationWarning, shouldDisableActionButtons, triggerScroll } = useChatContext();
  const [isExpanded, setIsExpanded] = useState(false);

  // Group intents by title
  const groupedIntents = useMemo(() => {
    const groups = new Map<string, GroupedIntent>();

    intents.forEach(intent => {
      if (!groups.has(intent.title)) {
        groups.set(intent.title, {
          title: intent.title,
          intents: []
        });
      }

      const group = groups.get(intent.title)!;
      group.intents.push(intent);
    });

    // Convert Map to array and sort if needed
    // TODO: Sort by priority when priority field is available from the endpoint
    return Array.from(groups.values());
  }, [intents]);

  const INITIAL_VISIBLE_COUNT = 3;
  const hasMoreIntents = groupedIntents.length > INITIAL_VISIBLE_COUNT;
  const visibleIntents =
    hasMoreIntents && !isExpanded ? groupedIntents.slice(0, INITIAL_VISIBLE_COUNT) : groupedIntents;
  const hiddenCount = groupedIntents.length - INITIAL_VISIBLE_COUNT;

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      // Trigger scroll when expanding
      setTimeout(() => {
        triggerScroll();
      }, 100);
    }
  };

  return (
    <div>
      <HStack>
        <Text className="mr-2 text-xs italic text-gray-500">
          <Trans>Try a suggested action</Trans>
        </Text>
        <InfoTooltip
          iconClassName="text-gray-400"
          iconSize={12}
          content={
            <Text variant="small">
              <Trans>
                Selecting a suggested action will prefill transaction details, but execution still requires
                user review and confirmation.
              </Trans>
            </Text>
          }
        />
      </HStack>
      <div className="mt-2 flex flex-wrap gap-2">
        {visibleIntents.map((groupedIntent, index) => (
          <GroupedIntentButton
            key={index}
            groupedIntent={groupedIntent}
            shouldDisableActionButtons={shouldDisableActionButtons}
          />
        ))}
      </div>
      {hasMoreIntents && (
        <Button
          variant="link"
          onClick={handleToggleExpand}
          className="mt-3 flex h-auto items-center gap-1 py-1 pl-1 pr-0 text-sm font-normal"
        >
          {isExpanded ? (
            <Trans>Collapse</Trans>
          ) : (
            <Trans>
              Show {hiddenCount} more {hiddenCount === 1 ? 'action' : 'actions'}
            </Trans>
          )}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </Button>
      )}
      {shouldShowConfirmationWarning && <ConfirmationWarningRow />}
    </div>
  );
};

// Tooltip wrapper for intent buttons
type IntentTooltipProps = {
  children: React.ReactNode;
  title: string;
  network: string | undefined;
};

const IntentTooltip = ({ children, title, network }: IntentTooltipProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipPortal>
        <TooltipContent sideOffset={8}>
          <Text variant="small">
            {title} on {getNetworkDisplayName(network)}
          </Text>
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
};

// Component for a grouped intent button (with dropdown if multiple networks)
type GroupedIntentButtonProps = {
  groupedIntent: GroupedIntent;
  shouldDisableActionButtons: boolean;
};

const GroupedIntentButton = ({ groupedIntent, shouldDisableActionButtons }: GroupedIntentButtonProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // If only one intent, render the standard IntentRow with tooltip
  if (groupedIntent.intents.length === 1) {
    const intent = groupedIntent.intents[0];
    const chainId = useChainId();
    const intentUrl = useRetainedQueryParams(intent?.url || '', [
      QueryParams.Locale,
      QueryParams.Details,
      QueryParams.Chat
    ]);
    const network =
      useNetworkFromIntentUrl(addResetParam(intentUrl)) ||
      chainIdNameMapping[chainId as keyof typeof chainIdNameMapping];

    return (
      <IntentTooltip title={groupedIntent.title} network={network}>
        <div className="inline-flex">
          <IntentRow
            intent={{ ...intent, url: addResetParam(intent.url) }}
            shouldDisableActionButtons={shouldDisableActionButtons}
          />
        </div>
      </IntentTooltip>
    );
  }

  // Multiple intents: render split button with dropdown
  const selectedIntent = groupedIntent.intents[selectedIndex];
  const chainId = useChainId();
  const intentUrl = useRetainedQueryParams(selectedIntent?.url || '', [
    QueryParams.Locale,
    QueryParams.Details,
    QueryParams.Chat
  ]);
  const network =
    useNetworkFromIntentUrl(addResetParam(intentUrl)) ||
    chainIdNameMapping[chainId as keyof typeof chainIdNameMapping];

  return (
    <IntentTooltip title={groupedIntent.title} network={network}>
      <div className="inline-flex">
        <IntentRow
          intent={{ ...selectedIntent, url: addResetParam(selectedIntent.url) }}
          shouldDisableActionButtons={shouldDisableActionButtons}
          className="rounded-r-none border-r-0"
          hideIcon
        />

        <NetworkDropdown
          intents={groupedIntent.intents}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          disabled={shouldDisableActionButtons}
        />
      </div>
    </IntentTooltip>
  );
};

// Network dropdown component
type NetworkDropdownProps = {
  intents: ChatIntent[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  disabled: boolean;
};

const NetworkDropdown = ({
  intents,
  selectedIndex,
  onSelect,
  isOpen,
  onOpenChange,
  disabled
}: NetworkDropdownProps) => {
  const chainId = useChainId();
  const selectedIntent = intents[selectedIndex];
  const intentUrl = useRetainedQueryParams(selectedIntent?.url || '', [
    QueryParams.Locale,
    QueryParams.Details,
    QueryParams.Chat
  ]);

  const network =
    useNetworkFromIntentUrl(addResetParam(intentUrl)) ||
    chainIdNameMapping[chainId as keyof typeof chainIdNameMapping];

  const networkIcons = {
    Ethereum,
    Arbitrumone,
    Opmainnet,
    Base,
    Unichain
  };

  const IconComponent =
    networkIcons[capitalizeFirstLetter(network || '') as keyof typeof networkIcons] || Ethereum;

  const handleSelect = (index: number) => {
    onSelect(index);
    onOpenChange(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="suggest"
          disabled={disabled}
          className="rounded-l-none border-l border-l-white/20 px-2"
        >
          <IconComponent className="h-4.5 w-4.5" />
          <ChevronDown className={cn('ml-1 h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="bg-brandDark w-fit rounded-xl border p-1 shadow-lg"
        align="end"
        sideOffset={4}
      >
        <VStack gap={0.5}>
          {intents.map((intent, index) => {
            const intentUrl = useRetainedQueryParams(intent?.url || '', [
              QueryParams.Locale,
              QueryParams.Details,
              QueryParams.Chat
            ]);
            const network =
              useNetworkFromIntentUrl(addResetParam(intentUrl)) ||
              chainIdNameMapping[chainId as keyof typeof chainIdNameMapping];
            const NetworkIcon =
              networkIcons[capitalizeFirstLetter(network || '') as keyof typeof networkIcons] || Ethereum;

            return (
              <Button
                key={index}
                variant="ghost"
                onClick={() => handleSelect(index)}
                className={cn(
                  'w-full justify-start px-3 py-2 text-sm',
                  selectedIndex === index && 'bg-white/10'
                )}
              >
                <NetworkIcon className="mr-2 h-4 w-4" />
                <Text variant="small">{getNetworkDisplayName(network)}</Text>
              </Button>
            );
          })}
        </VStack>
      </PopoverContent>
    </Popover>
  );
};

type IntentRowProps = {
  intent: ChatIntent;
  shouldDisableActionButtons: boolean;
};

const IntentRow = ({
  intent,
  shouldDisableActionButtons,
  className,
  hideIcon
}: IntentRowProps & { className?: string; hideIcon?: boolean }) => {
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
  const modifiesState = intentModifiesState(intent);

  const networkIcons = {
    Ethereum,
    Arbitrumone,
    Opmainnet,
    Base,
    Unichain
  };

  const IconComponent =
    networkIcons[capitalizeFirstLetter(network || '') as keyof typeof networkIcons] || Ethereum;

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
      className={className}
    >
      {intent.title}
      {!hideIcon && <IconComponent className="h-4.5 w-4.5 ml-2" />}
    </Button>
  );
};
