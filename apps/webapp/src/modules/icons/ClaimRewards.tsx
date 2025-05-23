import { Icon, IconProps } from './Icon';

const ClaimRewardsPath = (
  <path
    fillRule="evenodd"
    clipRule="evenodd"
    d="M12.5945 4.24627C12.2662 3.91791 11.7338 3.91791 11.4055 4.24627L4.24627 11.4055C3.91791 11.7338 3.91791 12.2662 4.24627 12.5945L11.4055 19.7537C11.7338 20.0821 12.2662 20.0821 12.5945 19.7537L19.7537 12.5945C20.0821 12.2662 20.0821 11.7338 19.7537 11.4055L12.5945 4.24627ZM6.81604 11.2138L12 6.02988L17.184 11.2138H6.81604ZM6.81323 12.7833L12 17.9701L17.1868 12.7833H6.81323Z"
    fill="currentColor"
  />
);
export const ClaimRewards = (props: IconProps) => (
  <Icon viewBox="0 0 24 24" {...props}>
    {ClaimRewardsPath}
  </Icon>
);
