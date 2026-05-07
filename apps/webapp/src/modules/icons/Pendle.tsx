import { Icon, IconProps } from './Icon';

export const Pendle = (props: IconProps) => (
  <Icon viewBox="0 0 22 22" {...props}>
    <g opacity="0.8">
      <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M11 6V11H15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </Icon>
);
