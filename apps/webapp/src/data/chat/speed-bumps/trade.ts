import { SpeedBumpContent } from './types';

export const tradeSpeedBump: SpeedBumpContent = {
  title: 'Trade',
  functionality: 'trade',
  slug: 'trade',
  restrictions: ['- Not available in the E.U.'],
  howItWorks:
    'Users can trade their assets using an API integration with third-party DEX provider, CoW Swap.',
  associatedRisks: [
    '- **Market Risk**: Risk of value loss due to market volatility, liquidity issues, unforeseen changes in asset utility, or regulatory risk of the new asset being deemed a security by financial markets regulators, which could potentially lead to delisting from exchanges and other regulatory restrictions.',
    '- **U.S. Regulatory Risk**: Although the Trade functionality is available in the U.S., there is a risk which persists that the function could be deemed by financial markets regulators as unlicensed broker or exchange activity.',
    "- **Third-Party Risk**: This service is provided via an integration with a third party (CoW Swap) and users will be subject to CoW Swap's Terms of Use."
  ]
};
