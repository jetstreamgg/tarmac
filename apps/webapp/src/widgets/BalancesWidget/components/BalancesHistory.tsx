import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useCombinedHistory, useAllNetworksCombinedHistory } from '@/hooks';
import { useFormatDates } from '@/hooks';
import { useLingui } from '@lingui/react';
import { CustomPagination } from '@/widgets/shared/components/ui/pagination/CustomPagination';
import { BalancesHistoryItem } from './BalancesHistoryItem';
import { Skeleton } from '@/widgets/components/ui/skeleton';
import { VStack } from '@/widgets/shared/components/ui/layout/VStack';
import { Text } from '@/widgets/shared/components/ui/Typography';
import { Trans } from '@lingui/react/macro';
import { motion } from 'motion/react';
import { positionAnimations } from '@/widgets/shared/animation/presets';
import { NoResults } from '@/widgets/shared/components/icons/NoResults';
import { cn } from '@/widgets/lib/utils';

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
  const singleNetworkHistory = useCombinedHistory();
  const allNetworksHistory = useAllNetworksCombinedHistory();

  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = showAllNetworks
    ? allNetworksHistory
    : singleNetworkHistory;

  const { i18n } = useLingui();
  const memoizedDates = useMemo(() => data?.map(s => s.blockTimestamp), [data]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, h:mm a');
  const [startIndex, setStartIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);
  const observerTarget = useRef<HTMLDivElement>(null);

  const onPageChange = (page: number) => {
    setStartIndex((page - 1) * itemsPerPage);
    // Landing on the last loaded page while the server holds older history →
    // fetch the next keyset page so a further page appears.
    if (hasNextPage && !isFetchingNextPage && page >= Math.ceil(data.length / itemsPerPage)) {
      fetchNextPage();
    }
  };

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + itemsPerPage, data.length));
  }, [data.length, itemsPerPage]);

  // Derived from `data` rather than synced through an effect so background
  // refetches never reset the visible window (which read as flashes).
  const itemsToDisplay = useMemo(
    () => data.slice(startIndex, startIndex + itemsPerPage),
    [data, startIndex, itemsPerPage]
  );

  useEffect(() => {
    if (!useInfiniteScroll) return;

    const observer = new IntersectionObserver(
      entries => {
        if (!entries[0].isIntersecting) return;
        if (visibleCount < data.length) {
          loadMore();
        } else if (hasNextPage && !isFetchingNextPage) {
          // Local buffer exhausted but the server holds older history.
          fetchNextPage();
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
  }, [
    useInfiniteScroll,
    visibleCount,
    data.length,
    loadMore,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
  ]);

  const infiniteScrollItems = useMemo(() => data.slice(0, visibleCount), [data, visibleCount]);
  const hasMore = visibleCount < data.length || hasNextPage;

  const loadingCards = (
    <VStack gap={2} className={cn('mt-6', className)}>
      {Array.from({ length: itemsPerPage }, (_, i) => (
        <Skeleton key={i} className="h-[84px] w-full rounded-[20px]" />
      ))}
    </VStack>
  );

  const displayItems = useInfiniteScroll ? infiniteScrollItems : itemsToDisplay;
  const getGlobalIndex = (index: number) => (useInfiniteScroll ? index : startIndex + index);

  // Dozens of per-module/per-network queries feed `data`; rendering before
  // they all settle makes rows re-sort under the user as each one lands.
  // Hold the skeletons until the initial load completes and paint once.
  return isLoading ? (
    <>{loadingCards}</>
  ) : data.length > 0 ? (
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
                  ('rewardContractAddress' in item && item.rewardContractAddress
                    ? item.rewardContractAddress
                    : 'rewardContract' in item && item.rewardContract
                      ? item.rewardContract
                      : undefined) as `0x${string}` | undefined
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
