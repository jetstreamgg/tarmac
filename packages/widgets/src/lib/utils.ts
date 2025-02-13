import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { z } from 'zod';
import { upgradeTokens } from '@/widgets/UpgradeWidget/lib/constants';
import { defaultConfig } from '../config/default-config';
import { SUPPORTED_TOKEN_SYMBOLS } from '..';
import { ExternalWidgetState } from '@/shared/types/widgetState';
import { SavingsFlow } from '@/widgets/SavingsWidget/lib/constants';
import { UpgradeFlow } from '@/widgets/UpgradeWidget/lib/constants';
import { RewardsFlow } from '@/widgets/RewardsWidget/lib/constants';
import { TradeFlow } from '@/widgets/TradeWidget/lib/constants';
import { BalancesFlow } from '@/widgets/BalancesWidget/constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const tokenSymbols: string[] = []; //get all token symbols
for (const key in defaultConfig.tradeTokenList) {
  defaultConfig.tradeTokenList[key].forEach(token => {
    if (typeof token !== 'number' && token.symbol) {
      tokenSymbols.push(token.symbol);
    }
  });
}

const tokenValidationRule = z
  .string()
  .optional()
  .refine(
    (value: string | undefined) => {
      if (value === undefined) {
        return true;
      }
      return tokenSymbols.map(t => t.toLowerCase()).includes(value.toLowerCase());
    },
    {
      message: 'token must be in the list of valid tokens'
    }
  );

const amountValidationRule = z
  .string()
  .optional()
  .refine(
    (value: string | undefined) => {
      if (value === undefined) {
        return true;
      }
      return !isNaN(Number(value)) && Number(value) >= 0;
    },
    {
      message: 'amount must be a number-like string greater than 0'
    }
  );

const TokenSchema = z.object({
  address: z.record(z.string()),
  abi: z.any().optional(),
  name: z.string(),
  color: z.string(),
  symbol: z.string(),
  decimals: z.number().optional()
});

const ExternalWidgetStateSchema = z
  .object({
    initialUpgradeToken: z.enum(Object.keys(upgradeTokens) as [string, ...string[]]).optional(),
    amount: amountValidationRule,
    selectedRewardContract: z
      .object({
        supplyToken: TokenSchema,
        rewardToken: TokenSchema,
        contractAddress: z.string(),
        chainId: z.number(),
        name: z.string(),
        description: z.string(),
        externalLink: z.string(),
        logo: z.string()
      })
      .optional(),
    targetAmount: amountValidationRule,
    flow: z
      .enum([
        ...Object.values(SavingsFlow),
        ...Object.values(UpgradeFlow),
        ...Object.values(RewardsFlow),
        ...Object.values(TradeFlow),
        ...Object.values(BalancesFlow)
      ] as [string, ...string[]])
      .optional(),
    token: tokenValidationRule,
    targetToken: tokenValidationRule
  })
  .refine(
    data => {
      if (
        data.targetToken === undefined ||
        data.token === undefined ||
        defaultConfig.tradeDisallowedPairs === undefined
      ) {
        return true;
      }
      const input = data.token;
      const target = data.targetToken;
      if (
        defaultConfig.tradeDisallowedPairs[input] &&
        defaultConfig.tradeDisallowedPairs[input].includes(target as SUPPORTED_TOKEN_SYMBOLS)
      ) {
        return false;
      }
      if (
        defaultConfig.tradeDisallowedPairs[target] &&
        defaultConfig.tradeDisallowedPairs[target].includes(input as SUPPORTED_TOKEN_SYMBOLS)
      ) {
        return false;
      }
      if (target === input) {
        return false;
      }
      return true;
    },
    {
      message: 'token and targetToken cannot be tradeped'
    }
  )
  .refine(
    data => {
      if (data.amount !== undefined && data.targetAmount !== undefined) {
        return false;
      }
      return true;
    },
    {
      message: 'Cannot have both an amount and a targetAmount'
    }
  );

// returns undefined if any part of validation fails
// we could update this to return the parts of the state that are valid even if others parts failed
export function getValidatedState(state?: ExternalWidgetState): ExternalWidgetState | undefined {
  const result = ExternalWidgetStateSchema.safeParse(state);
  if (result.success) {
    return state;
  } else {
    return undefined;
  }
}
