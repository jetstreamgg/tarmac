/**
 * Formats a positive remaining-seconds value as a duration phrase.
 * Returns the largest unit where the value is ≥ 1 (days → hours → minutes),
 * or "less than a minute" for sub-minute remainders. Empty string when ≤ 0.
 */
export const formatTimeLeft = (seconds: number): string => {
  if (seconds <= 0) return '';
  const days = Math.floor(seconds / 86_400);
  if (days >= 1) return days === 1 ? '1 day' : `${days} days`;
  const hours = Math.floor(seconds / 3_600);
  if (hours >= 1) return hours === 1 ? '1 hour' : `${hours} hours`;
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 1) return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  return 'less than a minute';
};
