import { Icon, IconProps } from './Icon';

export const TransactionsEmpty = (props: IconProps) => (
  <Icon width="64" height="64" viewBox="0 0 64 64" {...props}>
    <g id="transactions-empty">
      <rect x="12" y="12" width="40" height="40" rx="20" fill="#484178" />
      <circle cx="18" cy="18" r="18" transform="matrix(1 0 0 -1 4 40)" fill="#9E98DD" />
      <path
        d="M15 22H29M22 29L29 22L22 15"
        fill="none"
        stroke="#090420"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="18" r="18" transform="matrix(1 0 0 -1 24 60)" fill="#CAC5FF" />
      <path
        d="M41.9992 35.6992L35.6992 41.9992L41.9992 48.2992M35.6992 41.9992H48.2992"
        fill="none"
        stroke="#090420"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </Icon>
);
