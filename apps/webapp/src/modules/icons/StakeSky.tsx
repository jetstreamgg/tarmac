import { Icon, IconProps } from './Icon';

// Sky pinwheel — the Stake SKY destination mark. Authored at 16×16; scaled into
// the shared 24×24 icon box so the header nav gradient (userSpaceOnUse 0→24)
// spans the whole glyph. Paths use currentColor so the nav controls the fill.
export const StakeSky = (props: IconProps) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <g transform="scale(1.5)">
      <path
        d="M6.74805 0.098569C7.99518 -0.0990346 9.27137 0.00137538 10.4723 0.391587L8 7.99999L6.74805 0.098569Z"
        fill="currentColor"
      />
      <path
        d="M0.871948 11.6319C0.298699 10.5068 -9.61217e-05 9.26207 2.3191e-08 7.99938L8 7.99999L0.871948 11.6319Z"
        fill="currentColor"
      />
      <path
        d="M11.6328 0.872393C12.0063 1.06275 12.3642 1.28216 12.7033 1.52861L8 7.99999L11.6328 0.872393Z"
        fill="currentColor"
      />
      <path
        d="M12.7023 1.52789C14.069 2.52086 15.0863 3.92098 15.6084 5.52761L8 7.99999L12.7023 1.52789Z"
        fill="currentColor"
      />
      <path
        d="M2.34315 2.34314C3.53768 1.14861 5.0797 0.362874 6.74822 0.098541L8 7.99999L2.34315 2.34314Z"
        fill="currentColor"
      />
      <path d="M16 7.99999C16 8.83948 15.8679 9.67373 15.6085 10.4721L8 7.99999H16Z" fill="currentColor" />
      <path
        d="M10.4721 15.6084C9.27144 15.9986 7.99546 16.099 6.74852 15.9015L8 7.99999L10.4721 15.6084Z"
        fill="currentColor"
      />
      <path
        d="M5.52786 15.6084C4.72947 15.349 3.97687 14.9656 3.29772 14.4721L8 7.99999L5.52786 15.6084Z"
        fill="currentColor"
      />
      <path
        d="M3.29772 14.4721C2.61856 13.9787 2.0213 13.3814 1.52786 12.7023L8 7.99999L3.29772 14.4721Z"
        fill="currentColor"
      />
      <path
        d="M0 7.99999C7.33902e-08 7.16051 0.132133 6.32625 0.391548 5.52786L8 7.99999L0 7.99999Z"
        fill="currentColor"
      />
      <path
        d="M1.52786 3.29771C1.7742 2.95866 2.0468 2.63949 2.34315 2.34314L8 7.99999L1.52786 3.29771Z"
        fill="currentColor"
      />
      <path
        d="M14.4724 12.7019C13.979 13.3811 13.3817 13.9784 12.7026 14.4719L8 7.99999L14.4724 12.7019Z"
        fill="currentColor"
      />
      <path
        d="M6.74852 15.9015C6.33459 15.8359 5.92645 15.7379 5.52786 15.6084L8 7.99999L6.74852 15.9015Z"
        fill="currentColor"
      />
      <path
        d="M15.6085 10.4719C15.3491 11.2704 14.9657 12.023 14.4722 12.7021L8 7.99999L15.6085 10.4719Z"
        fill="currentColor"
      />
    </g>
  </Icon>
);
