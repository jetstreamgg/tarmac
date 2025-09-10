import { TimeFrame } from '@/modules/ui/components/Chart';

export function getDayCountFromTimeFrame(timeFrame: TimeFrame): number {
  switch (timeFrame) {
    case 'w':
      return 7;
    case 'm':
      return 30;
    case '3m':
      return 90;
    case '6m':
      return 180;
    case 'y':
      return 365;
    default:
      return 30;
  }
}
