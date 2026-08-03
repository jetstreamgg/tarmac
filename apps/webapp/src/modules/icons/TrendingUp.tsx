import { Icon, IconProps } from './Icon';

/**
 * DS `Icons/General/trending-up` — the 12px up-trend arrow beside the review
 * grids' Est. earnings values. Strokes with currentColor (the grids paint it
 * status-success green); explicit `fill="none"` keeps the open path from
 * inheriting SVG's default black fill.
 */
export const TrendingUp = (props: IconProps) => (
  <Icon viewBox="0 0 12 12" fill="none" {...props}>
    <path
      d="M8 3.5h3v3M11 3.5 6.75 7.75l-2.5-2.5L1 8.5"
      stroke="currentColor"
      strokeWidth="1.33"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Icon>
);
