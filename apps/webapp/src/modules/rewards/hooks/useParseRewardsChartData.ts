import { useMemo } from 'react';
import { Data, TimeFrame } from '@/modules/ui/components/Chart';
import { getTimeFrameInterval } from '@/modules/rewards/helpers/getTimeFrameInterval';
import { RewardsChartInfoParsed } from '@jetstreamgg/sky-hooks';

export function useParseRewardsChartData(
  timeFrame: TimeFrame,
  chartData: RewardsChartInfoParsed[]
): { totalSupplied: Data[]; rate: Data[] } {
  return useMemo(() => {
    const sortedChartData = chartData.sort((a, b) => a.blockTimestamp - b.blockTimestamp);

    // Determine the start and end timestamps based on the timeFrame
    const { startTimestamp, endTimestamp } = determineTimeframeBounds(timeFrame, sortedChartData);

    // Filter chartData changes within the determined timeframe
    let prevItem: RewardsChartInfoParsed | undefined;
    const relevantChanges = sortedChartData.filter((item, index) => {
      const found = item.blockTimestamp >= startTimestamp && item.blockTimestamp <= endTimestamp;
      if (found && !prevItem && index > 0) {
        prevItem = sortedChartData[index - 1];
      }
      return found;
    });

    const firstItem = prevItem ? [prevItem] : [];
    const lastItem = sortedChartData.length > 0 ? [sortedChartData[sortedChartData.length - 1]] : [];

    // Generate data points for totalSupplied and rate
    const totalSuppliedDataPoints = generateDataPoints(
      [...firstItem, ...relevantChanges, ...lastItem],
      startTimestamp,
      endTimestamp,
      timeFrame,
      'totalSupplied'
    );

    const rateDataPoints = generateDataPoints(
      [...firstItem, ...relevantChanges, ...lastItem],
      startTimestamp,
      endTimestamp,
      timeFrame,
      'rate'
    );

    return { totalSupplied: totalSuppliedDataPoints, rate: rateDataPoints };
  }, [timeFrame, chartData]);
}

function determineTimeframeBounds(
  timeFrame: TimeFrame,
  chartData: RewardsChartInfoParsed[]
): { startTimestamp: number; endTimestamp: number } {
  const now = Date.now() / 1000; // Current timestamp in seconds
  let startTimestamp: number;
  switch (timeFrame) {
    case 'd':
      startTimestamp = now - 86400; // Last day
      break;
    case 'w':
      startTimestamp = now - 604800; // Last week
      break;
    case 'm':
      startTimestamp = now - 2592000; // Last month
      break;
    case 'y':
      startTimestamp = now - 31536000; // Last year
      break;
    case 'all':
    default:
      if (chartData.length === 0) {
        startTimestamp = now - 31536000; // Last year
      } else {
        startTimestamp = chartData[0]?.blockTimestamp ?? now; // Start from the first record or now if chartData is empty
      }
      break;
  }
  const endTimestamp = now; // Up to current moment
  return { startTimestamp, endTimestamp };
}

function generateDataPoints(
  chartData: RewardsChartInfoParsed[],
  startTimestamp: number,
  endTimestamp: number,
  timeFrame: TimeFrame,
  dataType: 'totalSupplied' | 'rate'
): Data[] {
  // Sort chartData by timestamp in ascending order to ensure correct processing
  chartData.sort((a, b) => a.blockTimestamp - b.blockTimestamp);

  let dataPoints;
  if (timeFrame === 'all' || timeFrame === 'y') {
    // Handle 'all' timeframe by generating equidistant points across the entire dataset
    const totalPoints = 7; // Including start and end, with 5 in between
    const interval = (endTimestamp - startTimestamp) / (totalPoints - 1);
    dataPoints = interpolateDataPoints(chartData, startTimestamp, endTimestamp, interval, dataType);
  } else {
    // For other timeframes, calculate the interval based on the timeframe
    const interval = getTimeFrameInterval(timeFrame);
    dataPoints = interpolateDataPoints(chartData, startTimestamp, endTimestamp, interval, dataType);
  }

  //Find min and max points
  let minValue = Number.MAX_VALUE;
  let maxValue = Number.MIN_VALUE;
  let minIndex = -1;
  let maxIndex = -1;

  dataPoints.forEach((point, index) => {
    if (point.value < minValue) {
      minValue = point.value;
      minIndex = index;
    }
    if (point.value > maxValue) {
      maxValue = point.value;
      maxIndex = index;
    }
  });

  if (minIndex !== -1) {
    dataPoints[minIndex].isMin = true;
  }
  if (maxIndex !== -1) {
    dataPoints[maxIndex].isMax = true;
  }

  return dataPoints;
}

const interpolateDataPoints = (
  chartData: RewardsChartInfoParsed[],
  startTimestamp: number,
  endTimestamp: number,
  interval: number,
  dataType: 'totalSupplied' | 'rate'
): Data[] => {
  const dataPoints: Data[] = [];
  let currentTime = startTimestamp;

  let lastProcessedIndex = -1;
  while (currentTime <= endTimestamp) {
    // Find the most recent change that is before or at the currentTime
    const relevantChange = findMostRecentChange(chartData, currentTime);
    let value = 0;
    if (relevantChange) {
      value =
        dataType === 'totalSupplied'
          ? Math.round(parseFloat(relevantChange[0].totalSupplied))
          : parseFloat(relevantChange[0].rate) * 100;
      lastProcessedIndex = relevantChange[1];
    }

    dataPoints.push({
      value: value,
      date: new Date(currentTime * 1000) // Convert to milliseconds
    });

    currentTime += interval;
  }

  const remainingData = chartData.slice(lastProcessedIndex + 1);

  if (remainingData.length > 0) {
    const lastDataPoint = dataPoints[dataPoints.length - 1];
    const lastRemainingDataPoint = remainingData[remainingData.length - 1];
    lastDataPoint.value =
      dataType === 'totalSupplied'
        ? Math.round(parseFloat(lastRemainingDataPoint.totalSupplied))
        : parseFloat(lastRemainingDataPoint.rate) * 100;
    lastDataPoint.date = new Date(lastRemainingDataPoint.blockTimestamp * 1000);

    dataPoints[dataPoints.length - 1] = lastDataPoint;
  }

  return dataPoints;
};

// Helper function to find the most recent change before or at currentTime
function findMostRecentChange(
  chartData: RewardsChartInfoParsed[],
  currentTime: number
): [RewardsChartInfoParsed, number] | undefined {
  for (let i = chartData.length - 1; i >= 0; i--) {
    if (chartData[i].blockTimestamp <= currentTime) {
      return [chartData[i], i];
    }
  }
  return undefined;
}
