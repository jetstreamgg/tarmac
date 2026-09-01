import { useId } from 'react';
import { Icon, IconProps } from './Icon';

/**
 * Lucide trending-up stroked with the savings gradient (Figma
 * Icons/General/trending-up in gradient-savings #02C2A1→#9FDE88 top→bottom —
 * raw hexes in Figma, no variable). The position-details reward-value marker.
 */
export const TrendingUpGradient = (props: IconProps) => {
  const id = useId();
  return (
    <Icon {...props} fill="none" viewBox="0 0 24 24">
      <defs>
        <linearGradient id={id} x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#02C2A1" />
          <stop offset="1" stopColor="#9FDE88" />
        </linearGradient>
      </defs>
      <path
        d="M16 7h6v6"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m22 7-8.5 8.5-5-5L2 17"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
};
