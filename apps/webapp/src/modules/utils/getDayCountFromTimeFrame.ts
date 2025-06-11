import { TimeFrame } from '../ui/components/Chart';

export const getDayCountFromTimeFrame = (timeframe: TimeFrame) => {
  switch (timeframe) {
    case 'm':
      return 32;
    case 'y':
      return 366;
    case 'all':
      return 9999;
    case 'w':
    default:
      return 8;
  }
};
