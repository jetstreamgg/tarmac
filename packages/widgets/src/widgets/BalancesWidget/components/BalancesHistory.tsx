import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useCombinedHistory, useAllNetworksCombinedHistory } from '@jetstreamgg/sky-hooks';
import { useFormatDates } from '@jetstreamgg/sky-utils';
import { useLingui } from '@lingui/react';
import { CustomPagination } from '@widgets/shared/components/ui/pagination/CustomPagination';
import { BalancesHistoryItem } from './BalancesHistoryItem';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Trans } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { NoResults } from '@widgets/shared/components/icons/NoResults';
import { cn } from '@widgets/lib/utils';

export const BalancesHistory = ({
  onExternalLinkClicked,
  showAllNetworks,
  className,
  itemsPerPage = 5,
  useInfiniteScroll = false
}: {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  showAllNetworks?: boolean;
  className?: string;
  itemsPerPage?: number;
  useInfiniteScroll?: boolean;
}) => {
  const {
    data: singleNetworkData,
    isLoading: singleNetworkLoading,
    error: singleNetworkError
  } = useCombinedHistory();
  const {
    data: allNetworksData,
    isLoading: allNetworksLoading,
    error: allNetworksError
  } = useAllNetworksCombinedHistory();

  const data = showAllNetworks ? allNetworksData : singleNetworkData;
  const isLoading = showAllNetworks ? allNetworksLoading : singleNetworkLoading;
  const error = showAllNetworks ? allNetworksError : singleNetworkError;

  const { i18n } = useLingui();
  const memoizedDates = useMemo(() => data?.map(s => s.blockTimestamp), [data]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, h:mm a');
  const [itemsToDisplay, setItemsToDisplay] = useState(data ? data.slice(0, itemsPerPage) : []);
  const [startIndex, setStartIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);
  const observerTarget = useRef<HTMLDivElement>(null);

  const onPageChange = (page: number) => {
    const newStartIndex = (page - 1) * itemsPerPage;
    setStartIndex(newStartIndex);
    const endIndex = newStartIndex + itemsPerPage;
    setItemsToDisplay(data.slice(newStartIndex, endIndex));
  };

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + itemsPerPage, data.length));
  }, [data.length, itemsPerPage]);

  useEffect(() => {
    if (useInfiniteScroll) {
      setVisibleCount(itemsPerPage);
    } else {
      setItemsToDisplay(data.slice(0, itemsPerPage));
    }
  }, [data, itemsPerPage, useInfiniteScroll]);

  useEffect(() => {
    if (!useInfiniteScroll) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && visibleCount < data.length) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [useInfiniteScroll, visibleCount, data.length, loadMore]);

  const infiniteScrollItems = useMemo(() => data.slice(0, visibleCount), [data, visibleCount]);
  const hasMore = visibleCount < data.length;

  const loadingCards = (
    <VStack gap={2} className={cn('mt-6', className)}>
      {Array.from({ length: itemsPerPage }, (_, i) => (
        <Skeleton key={i} className="h-[84px] w-full rounded-[20px]" />
      ))}
    </VStack>
  );

  const displayItems = useInfiniteScroll ? infiniteScrollItems : itemsToDisplay;
  const getGlobalIndex = (index: number) => (useInfiniteScroll ? index : startIndex + index);

  return data.length > 0 ? (
    <>
      <VStack gap={2} className={cn('mt-6', className)}>
        {displayItems.map((item, index: number) => {
          const globalIndex = getGlobalIndex(index);
          const formattedDate = formattedDates.length > globalIndex ? formattedDates[globalIndex] : '';
          return (
            <motion.div variants={positionAnimations} key={item.transactionHash + item.type}>
              <BalancesHistoryItem
                transactionHash={item.transactionHash}
                module={item.module}
                type={item.type}
                formattedDate={formattedDate}
                chainId={item.chainId}
                savingsToken={'token' in item ? item.token?.symbol : undefined}
                tradeFromToken={'fromToken' in item ? item.fromToken?.symbol : undefined}
                rewardContract={
                  'rewardContractAddress' in item && item.rewardContractAddress
                    ? item.rewardContractAddress
                    : 'rewardContract' in item && item.rewardContract
                      ? item.rewardContract
                      : undefined
                }
                item={item}
                onExternalLinkClicked={onExternalLinkClicked}
              />
            </motion.div>
          );
        })}
      </VStack>
      {useInfiniteScroll ? (
        hasMore && <div ref={observerTarget} className="h-1" />
      ) : (
        <CustomPagination dataLength={data.length} onPageChange={onPageChange} itemsPerPage={itemsPerPage} />
      )}
    </>
  ) : isLoading ? (
    <>{loadingCards}</>
  ) : error ? (
    <div>
      <Text className="text-textSecondary mt-10 text-center text-xs">
        <Trans>Unable to fetch history</Trans>
      </Text>
    </div>
  ) : (
    <VStack gap={3} className="items-center pt-9 pb-3">
      <NoResults />
      <Text className="text-textSecondary text-center">
        <Trans>No history found</Trans>
      </Text>
    </VStack>
  );
};
