import { Token, TOKENS } from '@jetstreamgg/sky-hooks';
import { upgradeTokens } from './constants';

export function calculateOriginOptions(
  token: Token,
  action: string,
  upgradeOptions: Token[] = [],
  revertOptions: Token[] = []
) {
  const options = action === 'upgrade' ? [...upgradeOptions] : [...revertOptions];

  // Sort the array so that the selected token is first
  options.sort((a, b) => {
    if (a.symbol === token.symbol) {
      return -1;
    }
    if (b.symbol === token.symbol) {
      return 1;
    }
    return 0;
  });

  return options;
}

export const calculateTargetOptions = (
  originToken: Token,
  upgradeOptions: Token[] = [],
  revertOptions: Token[] = []
) =>
  ({
    DAI: [revertOptions[0]],
    MKR: [revertOptions[1]],
    USDS: [upgradeOptions[0]],
    SKY: [upgradeOptions[1]]
  })[originToken.symbol];

export const tokenForSymbol = (symbol: keyof typeof upgradeTokens) => {
  return TOKENS[symbol.toLowerCase()];
};

export const targetTokenForSymbol = (symbol: keyof typeof upgradeTokens) => {
  return { DAI: TOKENS.usds, USDS: TOKENS.dai, MKR: TOKENS.sky, SKY: TOKENS.mkr }[symbol];
};
