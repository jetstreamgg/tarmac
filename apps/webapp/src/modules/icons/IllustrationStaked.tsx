import { Icon, IconProps } from './Icon';

/** Figma illustration-64/staked (coin stack), exported at the 16px badge size. */
export const IllustrationStaked = (props: IconProps) => (
  <Icon {...props} viewBox="0 0 16 16" fill="none">
    <ellipse cx="7.99995" cy="11.2499" rx="6" ry="3.24998" fill="url(#paint0_linear_ill_staked)" />
    <ellipse
      cx="6"
      cy="3.24998"
      rx="6"
      ry="3.24998"
      transform="matrix(1 0 0 -1 1.99995 11.2499)"
      fill="url(#paint1_linear_ill_staked)"
    />
    <ellipse
      cx="6"
      cy="3.24998"
      rx="6"
      ry="3.24998"
      transform="matrix(1 0 0 -1 1.99995 7.99992)"
      fill="url(#paint2_linear_ill_staked)"
    />
    <g>
      <mask
        id="mask0_ill_staked"
        style={{ maskType: 'alpha' }}
        maskUnits="userSpaceOnUse"
        x="1"
        y="1"
        width="13"
        height="7"
      >
        <ellipse
          cx="6"
          cy="3.24998"
          rx="6"
          ry="3.24998"
          transform="matrix(1 0 0 -1 1.99989 7.99998)"
          fill="url(#paint3_linear_ill_staked)"
        />
      </mask>
      <g mask="url(#mask0_ill_staked)">
        <g filter="url(#filter0_f_ill_staked)">
          <ellipse
            cx="6"
            cy="3.62498"
            rx="6"
            ry="3.62498"
            transform="matrix(1 0 0 -1 1.99989 11.25)"
            fill="url(#paint4_linear_ill_staked)"
          />
        </g>
      </g>
    </g>
    <defs>
      <filter
        id="filter0_f_ill_staked"
        x="-8.00005"
        y="-5.99993"
        width="31.9999"
        height="27.2498"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <feGaussianBlur stdDeviation="4.99997" result="effect1_foregroundBlur" />
      </filter>
      <linearGradient
        id="paint0_linear_ill_staked"
        x1="1.99995"
        y1="11.4999"
        x2="14"
        y2="11.4999"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#A4E6E6" />
        <stop offset="0.326775" stopColor="#97B8F8" />
        <stop offset="0.849433" stopColor="#B061FF" />
      </linearGradient>
      <linearGradient
        id="paint1_linear_ill_staked"
        x1="0"
        y1="3.24998"
        x2="12"
        y2="3.24998"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FFCD6B" />
        <stop offset="1" stopColor="#EB5EDF" />
      </linearGradient>
      <linearGradient
        id="paint2_linear_ill_staked"
        x1="6"
        y1="-1.49999"
        x2="6"
        y2="22.6249"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#A273FF" />
        <stop offset="1" stopColor="#4331E9" />
      </linearGradient>
      <linearGradient
        id="paint3_linear_ill_staked"
        x1="-1.625"
        y1="3.87498"
        x2="14"
        y2="6.99999"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FFE8D4" />
        <stop offset="1" stopColor="#B68EFF" />
      </linearGradient>
      <linearGradient
        id="paint4_linear_ill_staked"
        x1="4.875"
        y1="4.37497"
        x2="9.12498"
        y2="7.74998"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FFCD6B" />
        <stop offset="1" stopColor="#EB5EDF" />
      </linearGradient>
    </defs>
  </Icon>
);
