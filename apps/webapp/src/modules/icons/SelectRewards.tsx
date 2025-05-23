import { Icon, IconProps } from './Icon';

const SelectRewardsPath = (
  <>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.5945 2.24627C12.2662 1.91791 11.7338 1.91791 11.4055 2.24627L4.24627 9.40546C3.91791 9.73382 3.91791 10.2662 4.24627 10.5945L11.4055 17.7537C11.7338 18.0821 12.2662 18.0821 12.5945 17.7537L19.7537 10.5945C20.0821 10.2662 20.0821 9.73382 19.7537 9.40546L12.5945 2.24627ZM6.81604 9.21384L12 4.02988L17.184 9.21384H6.81604ZM6.81323 10.7833L12 15.9701L17.1868 10.7833H6.81323Z"
      fill="currentColor"
    />
    <path
      d="M4.88889 20C4.39797 20 4 20.4477 4 21C4 21.5523 4.39797 22 4.88889 22H19.1111C19.602 22 20 21.5523 20 21C20 20.4477 19.602 20 19.1111 20H4.88889Z"
      fill="currentColor"
    />
  </>
);
export const SelectRewards = (props: IconProps) => (
  <Icon viewBox="0 0 24 24" {...props}>
    {SelectRewardsPath}
  </Icon>
);
