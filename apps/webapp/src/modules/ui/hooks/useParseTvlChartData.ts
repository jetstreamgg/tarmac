import { formatUnits } from 'viem';
import { useMemo } from 'react';
import { Data, TimeFrame } from '@/modules/ui/components/Chart';
import { getTimeFrameInterval } from '@/modules/rewards/helpers/getTimeFrameInterval';

type TvlData = { blockTimestamp: number; amount: bigint };

export function useParseTvlChartData(timeFrame: TimeFrame, tvl: TvlData[]): Data[] {
  return useMemo(() => {
    const sortedTvl = [...tvl].sort((a, b) => a.blockTimestamp - b.blockTimestamp);

    // Determine the start and end timestamps based on the timeFrame
    const { startTimestamp, endTimestamp } = determineTimeframeBounds(timeFrame, sortedTvl);

    // Filter TVL changes within the determined timeframe
    let prevItem: TvlData | undefined;
    const relevantChanges = sortedTvl.filter((item, index) => {
      const found = item.blockTimestamp >= startTimestamp && item.blockTimestamp <= endTimestamp;
      if (found && !prevItem && index > 0) {
        prevItem = sortedTvl[index - 1];
      }
      return found;
    });

    const firstItem = prevItem ? [prevItem] : [];
    const lastItem = sortedTvl.length > 0 ? [sortedTvl[sortedTvl.length - 1]] : [];

    // Generate data points
    const dataPoints = generateDataPoints(
      [...firstItem, ...relevantChanges, ...lastItem],
      startTimestamp,
      endTimestamp,
      timeFrame
    );

    return dataPoints;
  }, [timeFrame, tvl]);
}

function determineTimeframeBounds(
  timeFrame: TimeFrame,
  tvl: TvlData[]
): { startTimestamp: number; endTimestamp: number } {
  const now = Date.now() / 1000; // Current timestamp in seconds
  const firstDataTimestamp = tvl.length > 0 ? tvl[0].blockTimestamp : now;
  let startTimestamp: number;
  switch (timeFrame) {
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
      if (tvl.length === 0) {
        startTimestamp = now - 31536000; // Last year
      } else {
        startTimestamp = tvl[0]?.blockTimestamp ?? now; // Start from the first record or now if tvl is empty
      }
      break;
  }
  // Never start before the first actual data point to avoid showing fabricated data
  startTimestamp = Math.max(startTimestamp, firstDataTimestamp);
  const endTimestamp = now; // Up to current moment
  return { startTimestamp, endTimestamp };
}

const interpolateDataPoints = (
  tvl: TvlData[],
  startTimestamp: number,
  endTimestamp: number,
  interval: number,
  decimals = 18
): Data[] => {
  const dataPoints: Data[] = [];
  let currentTime = startTimestamp;
  // Start with an initial amount if tvl is not empty, assuming BigInt for accuracy
  let lastKnownAmount = tvl.length > 0 ? BigInt(tvl[0].amount) : BigInt(0);

  let lastProcessedIndex = -1;
  while (currentTime <= endTimestamp) {
    // Find the most recent change that is before or at the currentTime
    const relevantChange = findMostRecentChange(tvl, currentTime);
    if (relevantChange) {
      lastKnownAmount = relevantChange[0].amount;
      lastProcessedIndex = relevantChange[1];
    }

    dataPoints.push({
      value: parseFloat(formatUnits(lastKnownAmount, decimals)), // Assuming formatUnits correctly formats the BigInt
      date: new Date(currentTime * 1000) // Convert to milliseconds
    });

    currentTime += interval;
  }

  const remainingData = tvl.slice(lastProcessedIndex + 1);

  if (remainingData.length > 0) {
    const lastDataPoint = dataPoints[dataPoints.length - 1];
    const lastRemainingDataPoint = remainingData[remainingData.length - 1];
    lastDataPoint.value = parseFloat(formatUnits(lastRemainingDataPoint.amount, decimals));
    lastDataPoint.date = new Date(lastRemainingDataPoint.blockTimestamp * 1000);

    dataPoints[dataPoints.length - 1] = lastDataPoint;
  }

  return dataPoints;
};

// Helper function to find the most recent change before or at currentTime
function findMostRecentChange(tvl: TvlData[], currentTime: number): [TvlData, number] | undefined {
  for (let i = tvl.length - 1; i >= 0; i--) {
    if (tvl[i].blockTimestamp <= currentTime) {
      return [tvl[i], i];
    }
  }
  return undefined;
}

function generateDataPoints(
  tvl: TvlData[],
  startTimestamp: number,
  endTimestamp: number,
  timeFrame: TimeFrame
): Data[] {
  // Sort tvl by timestamp in ascending order to ensure correct processing
  const sortedTvl = [...tvl].sort((a, b) => a.blockTimestamp - b.blockTimestamp);

  let dataPoints;
  if (timeFrame === 'all' || timeFrame === 'y') {
    // Handle 'all' timeframe by generating equidistant points across the entire dataset
    const totalPoints = 7; // Including start and end, with 5 in between
    const interval = (endTimestamp - startTimestamp) / (totalPoints - 1);
    dataPoints = interpolateDataPoints(sortedTvl, startTimestamp, endTimestamp, interval);
  } else {
    // For other timeframes, calculate the interval based on the timeframe
    const interval = getTimeFrameInterval(timeFrame);
    dataPoints = interpolateDataPoints(sortedTvl, startTimestamp, endTimestamp, interval);
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
