import { subDays, subWeeks, startOfMinute, getUnixTime } from 'date-fns';

export function useDeltaTimestamps(): [number, number] {
  const utcCurrentTime = new Date();

  const oneDayAgoTimestamp = getUnixTime(startOfMinute(subDays(utcCurrentTime, 1)));
  const oneWeekAgoTimestamp = getUnixTime(startOfMinute(subWeeks(utcCurrentTime, 1)));

  return [oneDayAgoTimestamp, oneWeekAgoTimestamp];
}
