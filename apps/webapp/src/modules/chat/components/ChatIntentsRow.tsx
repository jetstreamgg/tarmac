import { Button } from '@/components/ui/button';
import { ChatIntent } from '../types/Chat';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { useChatContext } from '../context/ChatContext';
import { useIntentExecution } from '../hooks/useIntentExecution';
import { useRetainedQueryParams, getRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { QueryParams } from '@/lib/constants';
import { useNetworkFromIntentUrl, getNetworkFromIntentUrl } from '../hooks/useNetworkFromUrl';
import { chainIdNameMapping, getNetworkDisplayName } from '../lib/intentUtils';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/components/ui/tooltip';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { VStack } from '@/modules/layout/components/VStack';
import { useSearchParams } from 'react-router-dom';

type ChatIntentsRowProps = {
  intents: ChatIntent[];
};

// Grouped intent structure - each title can have multiple network variants
type GroupedIntent = {
  title: string;
  intents: ChatIntent[];
};

const prepareUrlParams = (url: string, isMobile: boolean): string => {
  try {
    const urlObj = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://temp');
    urlObj.searchParams.set(QueryParams.Reset, 'true');
    if (isMobile) {
      // Disable chat on mobile since the chat is covering the screen
      urlObj.searchParams.set(QueryParams.Chat, 'false');
    }
    return urlObj.pathname + urlObj.search;
  } catch (error) {
    console.error('Failed to parse URL:', error);
    return url;
  }
};

export const ChatIntentsRow = ({ intents }: ChatIntentsRowProps) => {
  const { shouldShowConfirmationWarning, shouldDisableActionButtons, triggerScroll } = useChatContext();
  const [isExpanded, setIsExpanded] = useState(false);

  // Group intents by title and filter duplicates with same title + network
  const groupedIntents = useMemo(() => {
    const groups = new Map<string, GroupedIntent>();
    // Track seen title+network combinations to filter duplicates
    const seenCombos = new Set<string>();

    intents.forEach(intent => {
      // Extract network from the intent URL to check for duplicates
      let network: string;
      try {
        const intentUrl = new URL(
          intent.url,
          typeof window !== 'undefined' ? window.location.origin : 'http://temp'
        );
        network = intentUrl.searchParams.get('network')?.toLowerCase() || '';
      } catch (error) {
        console.error('Failed to parse intent URL:', intent.url, error);
        // If URL parsing fails, still group by title only
        network = '';
      }

      // Create a unique key combining title and network
      // All intents should have networks now thanks to ensureIntentHasNetwork
      const comboKey = `${intent.title}::${network}`;

      // Skip if we've already seen this title+network combination
      if (seenCombos.has(comboKey)) {
        return; // Skip duplicate
      }
      seenCombos.add(comboKey);

      // Add to grouped intents
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
    // TODO: When priority field becomes available from the backend,
    // use it for sorting instead of relying on array order
    return Array.from(groups.values());
  }, [intents]);

  const INITIAL_VISIBLE_COUNT = 4;
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
        <Text className="mr-2 text-xs text-gray-500 italic">
          <Trans>Explore actions</Trans>
        </Text>
        <InfoTooltip
          iconClassName="text-gray-400"
          iconSize={12}
          content={
            <Text variant="small">
              <Trans>
                Selecting a suggested action navigates you to the appropriate action flow. Transaction details
                are not prefilled and require manual entry and confirmation.
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
          className="mt-3 flex h-auto items-center gap-1 py-1 pr-0 pl-1 text-sm font-normal"
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
  const chainId = useChainId();
  const [searchParams] = useSearchParams();
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;

  // If only one intent, render the standard IntentRow with tooltip
  if (groupedIntent.intents.length === 1) {
    const intent = groupedIntent.intents[0];
    const intentUrl = getRetainedQueryParams(
      intent?.url || '',
      [QueryParams.Locale, QueryParams.Details, QueryParams.Chat],
      searchParams
    );
    const network =
      getNetworkFromIntentUrl(prepareUrlParams(intentUrl, isMobile)) ||
      chainIdNameMapping[chainId as keyof typeof chainIdNameMapping];

    return (
      <IntentTooltip title={groupedIntent.title} network={network}>
        <div className="inline-flex">
          <IntentRow
            intent={{ ...intent, url: prepareUrlParams(intent.url, isMobile) }}
            shouldDisableActionButtons={shouldDisableActionButtons}
          />
        </div>
      </IntentTooltip>
    );
  }

  // Multiple intents: render split button with dropdown
  const selectedIntent = groupedIntent.intents[selectedIndex];
  const intentUrl = getRetainedQueryParams(
    selectedIntent?.url || '',
    [QueryParams.Locale, QueryParams.Details, QueryParams.Chat],
    searchParams
  );
  const network =
    getNetworkFromIntentUrl(prepareUrlParams(intentUrl, isMobile)) ||
    chainIdNameMapping[chainId as keyof typeof chainIdNameMapping];

  return (
    <IntentTooltip title={groupedIntent.title} network={network}>
      <div className="inline-flex">
        <IntentRow
          intent={{ ...selectedIntent, url: prepareUrlParams(selectedIntent.url, isMobile) }}
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
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  const [searchParams] = useSearchParams();
  const executeIntent = useIntentExecution();

  const selectedIntent = intents[selectedIndex];
  const intentUrl = useRetainedQueryParams(selectedIntent?.url || '', [
    QueryParams.Locale,
    QueryParams.Details,
    QueryParams.Chat
  ]);

  const network =
    useNetworkFromIntentUrl(prepareUrlParams(intentUrl, isMobile)) ||
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

  // Default retained params for query string handling
  const defaultRetainedParams = [QueryParams.Locale, QueryParams.Details, QueryParams.Chat];

  const handleSelect = (index: number) => {
    // Update selection
    onSelect(index);
    onOpenChange(false);

    // Execute the intent action immediately
    const intent = intents[index];
    const intentWithResetParam = { ...intent, url: prepareUrlParams(intent.url, isMobile) };

    // On mobile, don't retain the chat param to ensure it closes
    const retainedParams = isMobile
      ? defaultRetainedParams.filter(param => param !== QueryParams.Chat)
      : defaultRetainedParams;

    const targetUrl = getRetainedQueryParams(
      prepareUrlParams(intent.url, isMobile) || '',
      retainedParams,
      searchParams
    );
    executeIntent(intentWithResetParam, targetUrl);
  };

  const TriggerButton = (
    <Button variant="suggest" disabled={disabled} className="rounded-l-none border-l border-l-white/20 px-2">
      <IconComponent className="h-4.5 w-4.5" />
      <ChevronDown className={cn('ml-1 h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
    </Button>
  );

  const NetworkOptions = (
    <VStack gap={isMobile ? 1 : 0.5}>
      {intents.map((intent, index) => {
        // Calculate network using pure functions instead of hooks
        const intentUrl = getRetainedQueryParams(intent?.url || '', defaultRetainedParams, searchParams);
        const network =
          getNetworkFromIntentUrl(prepareUrlParams(intentUrl, isMobile)) ||
          chainIdNameMapping[chainId as keyof typeof chainIdNameMapping];
        const NetworkIcon =
          networkIcons[capitalizeFirstLetter(network || '') as keyof typeof networkIcons] || Ethereum;

        return (
          <Button
            key={index}
            variant="ghost"
            onClick={() => handleSelect(index)}
            className={cn(
              'w-full justify-start text-sm',
              isMobile ? 'px-4 py-3' : 'px-3 py-2',
              selectedIndex === index && 'bg-white/10'
            )}
          >
            <NetworkIcon className={isMobile ? 'mr-3 h-5 w-5' : 'mr-2 h-4 w-4'} />
            <Text>{getNetworkDisplayName(network)}</Text>
          </Button>
        );
      })}
    </VStack>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{TriggerButton}</SheetTrigger>
        <SheetContent side="bottom" className="bg-brandDark gap-2 px-2 pb-3 [&>button>svg]:text-white">
          <SheetHeader>
            <SheetTitle>
              <Heading className="text-center">
                <Trans>Select Network</Trans>
              </Heading>
            </SheetTitle>
          </SheetHeader>
          {NetworkOptions}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{TriggerButton}</PopoverTrigger>
      <PopoverContent
        className="bg-brandDark w-fit rounded-xl border p-1 shadow-lg"
        align="end"
        sideOffset={4}
      >
        {NetworkOptions}
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
  const { bpi } = useBreakpointIndex();
  const executeIntent = useIntentExecution();
  const isMobile = bpi < BP.md;

  // On mobile, don't retain chat param (it will be set to false by prepareUrlParams)
  // On desktop, retain chat param to keep chat open after clicking an intent
  const retainedParams = isMobile
    ? [QueryParams.Locale, QueryParams.Details]
    : [QueryParams.Locale, QueryParams.Details, QueryParams.Chat];

  const intentUrl = useRetainedQueryParams(intent?.url || '', retainedParams);

  const network =
    useNetworkFromIntentUrl(intentUrl) || chainIdNameMapping[chainId as keyof typeof chainIdNameMapping];

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
      onClick={() => executeIntent(intent, intentUrl)}
      className={cn(
        'h-auto min-h-9 max-w-full justify-start text-left text-[13px] whitespace-normal @sm/chat:h-auto @sm/chat:text-sm @sm/chat:whitespace-nowrap',
        className
      )}
    >
      <span className="overflow-hidden break-words">{intent.title}</span>
      {!hideIcon && (
        <IconComponent className="ml-2 h-4 w-4 flex-shrink-0 @sm/chat:ml-2 @sm/chat:h-4.5 @sm/chat:w-4.5" />
      )}
    </Button>
  );
};
