import { Token, TOKENS } from '@jetstreamgg/sky-hooks';
import { SavingsFlow } from '@widgets/widgets/SavingsWidget/lib/constants';

export function calculateOriginOptions(
  token: Token,
  action: string,
  flow: SavingsFlow,
  depositOptions: Token[] = [],
  withdrawOptions: Token[] = [],
  disallowedTokens: { [key in SavingsFlow]: Token[] } = {
    [SavingsFlow.SUPPLY]: [],
    [SavingsFlow.WITHDRAW]: []
  }
) {
  const options = action === 'deposit' ? [...depositOptions] : [...withdrawOptions];
  const disallowed = disallowedTokens[flow];
  const allowedOptions = options.filter(option => !disallowed.includes(option));

  // Sort the array so that the selected token is first
  allowedOptions.sort((a, b) => {
    if (a.symbol === token.symbol) {
      return -1;
    }
    if (b.symbol === token.symbol) {
      return 1;
    }
    return 0;
  });

  return allowedOptions;
}

export const tokenForSymbol = (symbol: keyof typeof TOKENS) => {
  return TOKENS[(symbol as string).toLowerCase()];
};
