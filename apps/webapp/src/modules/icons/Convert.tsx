import { Icon, IconProps } from './Icon';

export const Convert = (props: IconProps) => (
  <Icon {...props}>
    <path
      d="M4 8H17L13 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M20 16H7L11 20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Icon>
);
