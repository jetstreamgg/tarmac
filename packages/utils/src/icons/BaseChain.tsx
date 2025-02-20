import { Icon, IconProps } from '../../../widgets/src/shared/components/icons/Icon';

export const BaseChain = (props: IconProps) => (
  <Icon {...props} width="28" height="28" viewBox="0 0 28 28" fill="none">
    <g fill="none" fillRule="evenodd">
      <path fill="#0052FF" fillRule="nonzero" d="M14 28a14 14 0 1 0 0-28 14 14 0 0 0 0 28Z" />
      <path
        fill="#FFF"
        d="M13.967 23.86c5.445 0 9.86-4.415 9.86-9.86 0-5.445-4.415-9.86-9.86-9.86-5.166 0-9.403 3.974-9.825 9.03h14.63v1.642H4.142c.413 5.065 4.654 9.047 9.826 9.047Z"
      />
    </g>
  </Icon>
);
