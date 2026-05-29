import { RewardsChartInfoParsed } from '../rewards/useRewardsChartInfo';
import { useMemo } from 'react';

/**
 * Hook that finds the highest rate from an array of rewards chart data
 * @param chartDataArray - Array of RewardsChartInfoParsed arrays to compare
 * @returns The chart data entry with the highest rate, or null if no valid data
 */
export const useHighestRateFromChartData = (
  chartDataArray: (RewardsChartInfoParsed[] | undefined)[]
): RewardsChartInfoParsed | null => {
  return useMemo(() => {
    // Filter out undefined arrays and get the most recent entry from each
    const mostRecentEntries = chartDataArray
      .filter((data): data is RewardsChartInfoParsed[] => data !== undefined && data.length > 0)
      .map(data => {
        // Sort by blockTimestamp descending and get the most recent
        return [...data].sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0];
      })
      .filter(entry => entry && entry.rate !== undefined && entry.rate !== null);

    if (mostRecentEntries.length === 0) {
      return null;
    }

    if (mostRecentEntries.length === 1) {
      return mostRecentEntries[0];
    }

    // Find the entry with the highest rate
    let highestRateEntry = mostRecentEntries[0];
    let highestRate = parseFloat(highestRateEntry.rate || '0');

    for (let i = 1; i < mostRecentEntries.length; i++) {
      const currentRate = parseFloat(mostRecentEntries[i].rate || '0');
      if (currentRate > highestRate) {
        highestRate = currentRate;
        highestRateEntry = mostRecentEntries[i];
      }
    }

    return highestRateEntry;
  }, [chartDataArray]);
};
