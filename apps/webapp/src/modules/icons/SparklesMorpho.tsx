import { useId } from 'react';
import { Icon, IconProps } from './Icon';

/**
 * The two-star sparkle in the morpho gradient (#60a9ff→#2e8eff top→bottom) —
 * the boosted-rate marker on the vault modal grids. Glyph geometry matches the
 * widgets `Sparkles` icon (whose warm gradient and static defs ids it can't
 * share); distinct from `StarsFilled`, the vault card's currentColor sparkle.
 */
export const SparklesMorpho = (props: IconProps) => {
  const id = useId();
  return (
    <Icon viewBox="0 0 16 16" fill="none" {...props}>
      <defs>
        <linearGradient id={id} x1="8" y1="0" x2="8" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A9FF" />
          <stop offset="1" stopColor="#2E8EFF" />
        </linearGradient>
      </defs>
      <path
        d="M12.0699 9.38646C8.09413 8.48866 7.47829 7.87283 6.5805 3.89705C6.53936 3.71534 6.37761 3.58594 6.19071 3.58594C6.0038 3.58594 5.84205 3.71534 5.80092 3.89705C4.90272 7.87283 4.28729 8.48866 0.311512 9.38646C0.129397 9.42799 0 9.58934 0 9.77625C0 9.96315 0.129397 10.1245 0.311512 10.166C4.28729 11.0642 4.90272 11.6801 5.80092 15.6554C5.84205 15.8372 6.0038 15.9666 6.19071 15.9666C6.37761 15.9666 6.53936 15.8372 6.5805 15.6554C7.47869 11.6801 8.09413 11.0642 12.0699 10.166C12.252 10.1245 12.381 9.96315 12.381 9.77625C12.381 9.58934 12.2516 9.42799 12.0699 9.38646Z"
        fill={`url(#${id})`}
      />
      <path
        d="M15.6621 3.19819C13.5486 2.72094 13.2519 2.4242 12.7746 0.311113C12.7331 0.128998 12.5718 0 12.3849 0C12.198 0 12.0366 0.128998 11.9951 0.311113C11.5178 2.4242 11.2211 2.72094 9.10799 3.19819C8.92587 3.23973 8.79688 3.40108 8.79688 3.58798C8.79688 3.77489 8.92587 3.93624 9.10799 3.97777C11.2211 4.45503 11.5178 4.75176 11.9951 6.86525C12.0366 7.04697 12.198 7.17636 12.3849 7.17636C12.5718 7.17636 12.7331 7.04697 12.7746 6.86525C13.2519 4.75176 13.5486 4.45503 15.6621 3.97777C15.8438 3.93624 15.9732 3.77489 15.9732 3.58798C15.9732 3.40108 15.8438 3.23973 15.6621 3.19819Z"
        fill={`url(#${id})`}
      />
    </Icon>
  );
};
