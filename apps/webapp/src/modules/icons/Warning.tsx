import { Icon, IconProps } from './Icon';

export const Warning = ({ ...props }: IconProps) => (
  <Icon {...props}>
    <path
      d="M8.90863 10.9379C8.90863 11.4391 8.50231 11.8454 8.0011 11.8454C7.49988 11.8454 7.09356 11.4391 7.09356 10.9379C7.09356 10.4367 7.49988 10.0304 8.0011 10.0304C8.50231 10.0304 8.90863 10.4367 8.90863 10.9379Z"
      fill={props.fill || '#FF6D6D'}
    />
    <path
      d="M7.15706 5.63122L7.43841 9.25036H8.56378L8.84513 5.63122H7.15706Z"
      fill={props.fill || '#FF6D6D'}
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.39887 1.83896C8.78881 0.743784 7.21339 0.743784 6.60333 1.83896L1.15376 11.622C0.559683 12.6885 1.33075 14.0006 2.55153 14.0006H13.4507C14.6715 14.0006 15.4425 12.6885 14.8484 11.622L9.39887 1.83896ZM13.7128 12.2546L8.26318 2.47159C8.1488 2.26624 7.85341 2.26624 7.73902 2.47159L2.28944 12.2546C2.17806 12.4546 2.32263 12.7006 2.55153 12.7006H13.4507C13.6796 12.7006 13.8241 12.4546 13.7128 12.2546Z"
      fill={props.fill || '#FF6D6D'}
    />
  </Icon>
);
