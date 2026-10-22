import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useCombinedHistory, useAllNetworksCombinedHistory } from '@/hooks';
import { useFormatDates } from '@/hooks';
import { useLingui } from '@lingui/react';
import { CustomPagination } from '@/modules/ui/components/CustomPagination';
import { BalancesHistoryItem } from './BalancesHistoryItem';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { motion } from 'motion/react';
import { positionAnimations } from '@/modules/ui/animation/presets';
import { NoResults } from '@/modules/icons/NoResults';
import { cn } from '@/lib/cn';
import { mergeActivityRows, type ExtraActivityRow } from './mergeActivityRows';

export const BalancesHistory = ({
  showAllNetworks,
  className,
  itemsPerPage = 5,
  useInfiniteScroll = false,
  extraRows
}: {
  showAllNetworks?: boolean;
  className?: string;
  itemsPerPage?: number;
  useInfiniteScroll?: boolean;
  /** Rows from outside the indexed history, merged in by date. */
  extraRows?: ExtraActivityRow[];
}) => {
  const singleNetworkHistory = useCombinedHistory();
  const allNetworksHistory = useAllNetworksCombinedHistory();

  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = showAllNetworks
    ? allNetworksHistory
    : singleNetworkHistory;

  const { i18n } = useLingui();
  const memoizedDates = useMemo(() => data?.map(s => s.blockTimestamp), [data]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, h:mm a');
  const rows = useMemo(
    () => mergeActivityRows(data, extraRows ?? [], !hasNextPage),
    [data, extraRows, hasNextPage]
  );
  const [startIndex, setStartIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);
  const observerTarget = useRef<HTMLDivElement>(null);

  const onPageChange = (page: number) => {
    setStartIndex((page - 1) * itemsPerPage);
    // Landing on the last loaded page while the server holds older history →
    // fetch the next keyset page so a further page appears.
    if (hasNextPage && !isFetchingNextPage && page >= Math.ceil(rows.length / itemsPerPage)) {
      fetchNextPage();
    }
  };

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + itemsPerPage, rows.length));
  }, [rows.length, itemsPerPage]);

  // Derived from `data` rather than synced through an effect so background
  // refetches never reset the visible window (which read as flashes).
  // The offset is clamped because the row set can shrink under a stale one
  // (e.g. a wallet switch re-keys the hooks): an out-of-range slice would
  // render the empty state while data exists, with no pagination to recover.
  const lastPageStartIndex = Math.max(0, Math.ceil(rows.length / itemsPerPage) - 1) * itemsPerPage;
  const effectiveStartIndex = Math.min(startIndex, lastPageStartIndex);
  const itemsToDisplay = useMemo(
    () => rows.slice(effectiveStartIndex, effectiveStartIndex + itemsPerPage),
    [rows, effectiveStartIndex, itemsPerPage]
  );

  useEffect(() => {
    if (!useInfiniteScroll) return;

    const observer = new IntersectionObserver(
      entries => {
        if (!entries[0].isIntersecting) return;
        if (visibleCount < rows.length) {
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
    rows.length,
    loadMore,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
  ]);

  const infiniteScrollItems = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const hasMore = visibleCount < rows.length || hasNextPage;

  const loadingCards = (
    <div className={cn('mt-6 flex flex-col space-y-2', className)}>
      {Array.from({ length: itemsPerPage }, (_, i) => (
        <Skeleton key={i} className="h-[84px] w-full rounded-[20px]" />
      ))}
    </div>
  );

  const displayItems = useInfiniteScroll ? infiniteScrollItems : itemsToDisplay;

  // Dozens of per-module/per-network queries feed `data`; rendering before
  // they all settle makes rows re-sort under the user as each one lands.
  // Hold the skeletons until the initial load completes and paint once.
  return isLoading ? (
    <>{loadingCards}</>
  ) : rows.length > 0 ? (
    <>
      <div className={cn('mt-6 flex flex-col space-y-2', className)}>
        {displayItems.map(row => {
          if (row.kind === 'extra') {
            return (
              <motion.div variants={positionAnimations} key={row.row.key}>
                {row.row.render()}
              </motion.div>
            );
          }
          const { item, index } = row;
          const formattedDate = formattedDates.length > index ? formattedDates[index] : '';
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
              />
            </motion.div>
          );
        })}
      </div>
      {useInfiniteScroll ? (
        hasMore && <div ref={observerTarget} className="h-1" />
      ) : (
        <CustomPagination dataLength={rows.length} onPageChange={onPageChange} itemsPerPage={itemsPerPage} />
      )}
    </>
  ) : error ? (
    <div>
      <Text className="text-textSecondary mt-10 text-center text-xs">
        <Trans>Unable to fetch history</Trans>
      </Text>
    </div>
  ) : (
    <div className="flex flex-col items-center space-y-3 pt-9 pb-3">
      <NoResults />
      <Text className="text-textSecondary text-center">
        <Trans>No history found</Trans>
      </Text>
    </div>
  );
};
