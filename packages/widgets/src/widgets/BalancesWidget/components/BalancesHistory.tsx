import { useState, useMemo, useEffect } from 'react';
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

export const BalancesHistory = ({
  onExternalLinkClicked,
  showAllNetworks
}: {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  showAllNetworks?: boolean;
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

  const itemsPerPage = 5;
  const { i18n } = useLingui();
  const memoizedDates = useMemo(() => data?.map(s => s.blockTimestamp), [data]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, h:mm a');
  const [itemsToDisplay, setItemsToDisplay] = useState(data ? data.slice(0, itemsPerPage) : []);
  const [startIndex, setStartIndex] = useState(0);

  const onPageChange = (page: number) => {
    const newStartIndex = (page - 1) * itemsPerPage;
    setStartIndex(newStartIndex);
    const endIndex = newStartIndex + itemsPerPage;
    setItemsToDisplay(data.slice(newStartIndex, endIndex));
  };

  useEffect(() => {
    setItemsToDisplay(data.slice(0, itemsPerPage));
  }, [data, itemsPerPage]);

  const loadingCards = (
    <VStack gap={2} className="mt-6">
      {Array.from({ length: itemsPerPage }, (_, i) => (
        <Skeleton key={i} className="h-[84px] w-full" />
      ))}
    </VStack>
  );

  return data.length > 0 ? (
    <>
      <VStack gap={2} className="mt-6">
        {itemsToDisplay.map((item, index: number) => {
          const globalIndex = startIndex + index;
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
                item={item}
                onExternalLinkClicked={onExternalLinkClicked}
              />
            </motion.div>
          );
        })}
      </VStack>
      <CustomPagination dataLength={data.length} onPageChange={onPageChange} itemsPerPage={itemsPerPage} />
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
    <VStack gap={3} className="items-center pb-3 pt-9">
      <NoResults />
      <Text className="text-textSecondary text-center">
        <Trans>No history found</Trans>
      </Text>
    </VStack>
  );
};
