import { TimeFrame } from '@/modules/ui/components/Chart';

// Determine the interval in seconds for each timeframe
export const getTimeFrameInterval = (timeFrame: TimeFrame): number => {
  switch (timeFrame) {
    case 'w':
    case 'm':
      return 86400; // 1 day in seconds, recognizing that weeks and months vary in length
    case 'y':
      return 2592000; // 30 days in seconds, acknowledging that years vary in length
    case 'all':
      return -1; // Special case handled differently
    default:
      return 3600; // Default to 1 hour in seconds
  }
};
