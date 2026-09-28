import { useId } from 'react';
import { Icon, IconProps } from './Icon';

export const Pendle = (props: IconProps) => {
  // Mask id must be unique per instance so multiple Pendle icons on the same
  // page don't collide on the same fragment identifier.
  const maskId = useId();
  return (
    <Icon {...props} width={props.width ?? 24} height={props.height ?? 24} viewBox="0 0 60 60" fill="none">
      <circle cx="22.4379" cy="41.7637" r="9.24751" fill="currentColor" />
      <mask
        id={maskId}
        style={{ maskType: 'alpha' }}
        maskUnits="userSpaceOnUse"
        x="21"
        y="9"
        width="3"
        height="26"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M21.4207 34.7254L21.4207 9.94202L23.4822 9.94202L23.4822 34.7254L21.4207 34.7254Z"
          fill="currentColor"
        />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path
          d="M46.8096 25.7983C46.8096 35.082 39.2838 42.6078 30.0001 42.6078C20.7165 42.6078 13.1906 35.082 13.1906 25.7983C13.1906 16.5147 20.7165 8.98883 30.0001 8.98883C39.2838 8.98883 46.8096 16.5147 46.8096 25.7983Z"
          fill="currentColor"
        />
      </g>
      <circle cx="30.0001" cy="25.7983" r="16.8095" fill="currentColor" fillOpacity="0.5" />
    </Icon>
  );
};
