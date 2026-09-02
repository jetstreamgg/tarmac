import { cn } from '@/lib/cn';
import { Icon, IconProps } from './Icon';

/**
 * Merkl symbol (brand kit logo-symbol). Defaults to the brand's theme colors —
 * white in dark mode, #191F36 in light mode — overridable via `className`. Both
 * shapes inherit `fill` from the svg.
 */
export const Merkl = ({ className, ...props }: IconProps) => (
  <Icon {...props} viewBox="0 0 800 724.45" className={cn('light:fill-[#191F36] fill-white', className)}>
    <polygon points="405.69 149.03 545.65 149.03 405.69 530.92 204.92 0 1.03 0 0 396.31 148 396.31 148 239.07 336.35 724.45 462.61 724.45 650.97 239.07 650.97 724.45 800 724.45 800 149.03 800 0 800 0 405.69 0 405.69 149.03" />
    <path d="M0,546.49v177.97l57.05-20.61c54.58-19.72,90.95-71.53,90.95-129.57v-177.97l-57.05,20.61C36.37,436.64,0,488.45,0,546.49Z" />
  </Icon>
);
