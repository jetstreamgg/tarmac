import { Icon, IconProps } from './Icon';

/**
 * DS `Icons/Custom/lightning-filled` (Figma 5119:22994) — the angular filled
 * bolt on the redesign's bundled-transaction surfaces. Distinct from both the
 * lucide `Zap` outline and the legacy widget `Zap`; fills with currentColor so
 * `text-*` utilities set the color (comps use fg-brand).
 */
export const LightningFilled = (props: IconProps) => (
  <Icon viewBox="0 0 16 16" {...props}>
    <path
      d="M9.33333 6.625L9.77778 0.666667H8.88889L2.66667 9.375H6.66667L6.22222 15.3333H7.11111L13.3333 6.625H9.33333Z"
      fill="currentColor"
    />
  </Icon>
);
