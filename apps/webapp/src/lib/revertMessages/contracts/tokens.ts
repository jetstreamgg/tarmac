import { customError } from './customError';

// Balance and allowance reverts of the tokens the app moves, as written in their
// verified sources: Dai, USDS, SKY, sUSDS, stUSDS, SPK and Grove (both SDAO
// tokens), MKR (DSToken), USDC (FiatToken), and OpenZeppelin v5's custom errors
// (Morpho vault shares). USDT and WETH revert without a reason.
export const tokenInputRevertReasons: readonly string[] = [
  'Dai/insufficient-balance',
  'Dai/insufficient-allowance',
  'Usds/insufficient-balance',
  'Usds/insufficient-allowance',
  'Sky/insufficient-balance',
  'Sky/insufficient-allowance',
  'SUsds/insufficient-balance',
  'SUsds/insufficient-allowance',
  'StUsds/insufficient-balance',
  'StUsds/insufficient-allowance',
  'SDAO/insufficient-balance',
  'SDAO/insufficient-allowance',
  'ds-token-insufficient-balance',
  'ds-token-insufficient-approval',
  'ERC20: transfer amount exceeds balance',
  'ERC20: transfer amount exceeds allowance',
  ...customError('ERC20InsufficientBalance(address,uint256,uint256)'),
  ...customError('ERC20InsufficientAllowance(address,uint256,uint256)')
];
