import { useState } from 'react';
import type { TimeFrame } from '@/modules/ui/components/Chart';

/**
 * The timeframe to parse a chart's data with while a switch is loading. The
 * picker moves at once, but placeholder data is still the previous range's, and
 * parsing it with the new one zero-fills the gap into a false cliff (APP-407).
 */
export function useSettledTimeFrame(timeFrame: TimeFrame, isPlaceholderData: boolean): TimeFrame {
  const [settled, setSettled] = useState(timeFrame);
  if (isPlaceholderData) return settled;
  if (settled !== timeFrame) setSettled(timeFrame);
  return timeFrame;
}
