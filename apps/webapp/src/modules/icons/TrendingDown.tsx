import { Icon, IconProps } from './Icon';

/**
 * DS `Icons/General/trending-down` — the 12px down-trend arrow beside the
 * Pendle withdraw modal's "Lost on early withdrawal" value (Figma 2193:73598).
 * Vertical mirror of `TrendingUp`; strokes with currentColor (the grid paints
 * it status-error red).
 */
export const TrendingDown = (props: IconProps) => (
  <Icon viewBox="0 0 12 12" fill="none" {...props}>
    <path
      d="M8 8.5h3v-3M11 8.5 6.75 4.25l-2.5 2.5L1 3.5"
      stroke="currentColor"
      strokeWidth="1.33"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Icon>
);
