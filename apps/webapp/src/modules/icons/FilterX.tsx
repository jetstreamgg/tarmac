import { Icon, IconProps } from './Icon';

/**
 * DS `Icons/General/filter-x` (Figma 1980:45493) — the funnel-with-a-cross on
 * the Earn marketplace's "Clear filters" button. Not lucide's `FunnelX`: that
 * one curves the funnel's neck and sits its cross a full unit up and left, so
 * the pair read differently side by side at 16px.
 *
 * Strokes with currentColor; explicit `fill="none"` keeps the open path from
 * inheriting SVG's default black fill.
 */
export const FilterX = (props: IconProps) => (
  <Icon viewBox="0 0 16 16" width={16} height={16} fill="none" {...props}>
    <path
      d="M8.675 2H1.333l5.333 6.307v4.36L9.333 14V8.307l.6-.704M14.666 2l-3.333 3.333M11.333 2l3.333 3.333"
      stroke="currentColor"
      strokeWidth="1.33"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Icon>
);
