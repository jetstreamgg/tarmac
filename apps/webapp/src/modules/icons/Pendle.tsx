import { Icon, IconProps } from './Icon';

export const Pendle = (props: IconProps) => (
  <Icon {...props}>
    <g opacity="0.8">
      <rect x="1" y="1" width="20" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M1 15H8V11H14V7H21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </g>
  </Icon>
);
