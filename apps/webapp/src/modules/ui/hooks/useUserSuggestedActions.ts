import { IntentMapping, QueryParams } from '@/lib/constants';
import {
  useTokens,
  useTokenBalances,
  useAvailableTokenRewardContracts,
  RewardContract,
  TOKENS
} from '@jetstreamgg/sky-hooks';
import { isL2ChainId } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useState, useEffect, useRef } from 'react';
import { useAccount, useChainId } from 'wagmi';

export type LinkedAction = SuggestedAction & {
  stepOne: string;
  stepTwo: string;
  la: string;
};

type SuggestedAction = {
  primaryToken: string;
  secondaryToken: string;
  title: string;
  balance: string;

  url: string;
  intent: string;
  weight: number;
  type: string;
};

type TokenBalance = {
  value: bigint;
  decimals: number;
  formatted: string;
  symbol: string;
  chainId: number;
};

// Note: some suggested actions are disabled because they aren't compatible with the Rate highlight cards, leaving them here in case we want to re-enable
const fetchUserSuggestedActions = (
  chainId: number,
  tokenBalances?: TokenBalance[],
  rewardContracts?: RewardContract[]
): {
  suggestedActions: SuggestedAction[];
  linkedActions: LinkedAction[];
} => {
  const suggestedActions: SuggestedAction[] = [];
  const linkedActions: LinkedAction[] = [];
  const { LinkedAction, InputAmount, SourceToken, TargetToken, Widget } = QueryParams;
  const {
    REWARDS_INTENT: REWARDS,
    SAVINGS_INTENT: SAVINGS,
    UPGRADE_INTENT: UPGRADE,
    TRADE_INTENT: TRADE
  } = IntentMapping;
  const skyRewardContract = rewardContracts?.find(
    (rewardContract: RewardContract) => rewardContract.rewardToken === TOKENS.sky
  );
  const l2ChainId = isL2ChainId(chainId);

  // Limit the Linked and Suggested actions to Mainnet and Tenderly mainnet for now
  if (!l2ChainId) {
    // if user has DAI or MKR, add suggestion to upgrade, then get rewards or save
    // DAI actions
    const daiBalance = tokenBalances?.find((token: TokenBalance) => token.symbol === 'DAI');
    if (daiBalance && daiBalance.value > 0n) {
      linkedActions.push({
        primaryToken: 'DAI',
        secondaryToken: 'USDS',
        title: t`Upgrade and Save`,
        balance: daiBalance.formatted,
        stepOne: t`Upgrade DAI to USDS`,
        stepTwo: t`Earn with USDS`,
        url: `/?${Widget}=${UPGRADE}&${InputAmount}=${daiBalance.formatted}&${LinkedAction}=${SAVINGS}&${SourceToken}=DAI`,
        intent: IntentMapping.UPGRADE_INTENT,
        la: IntentMapping.SAVINGS_INTENT,
        // note: weights are arbitrary for now but can give us a way to sort the most relevant actions to the front
        weight: 9,
        type: 'linked'
      });
      linkedActions.push({
        primaryToken: 'DAI',
        secondaryToken: 'USDS',
        title: t`Upgrade and get rewards`,
        balance: daiBalance.formatted,
        stepOne: t`Upgrade DAI to USDS`,
        stepTwo: t`Get SKY rewards with USDS`,
        url: `/?${Widget}=${UPGRADE}&${InputAmount}=${daiBalance.formatted}&${LinkedAction}=${REWARDS}${skyRewardContract ? `&reward=${skyRewardContract.contractAddress}&${SourceToken}=DAI` : ''}`,
        intent: IntentMapping.UPGRADE_INTENT,
        la: IntentMapping.REWARDS_INTENT,
        weight: 10,
        type: 'linked'
      });
      suggestedActions.push({
        primaryToken: 'DAI',
        secondaryToken: 'USDS',
        balance: daiBalance.formatted,
        title: t`Upgrade DAI to USDS`,
        url: `/?${Widget}=${UPGRADE}&${InputAmount}=${daiBalance.formatted}&${SourceToken}=DAI`,
        intent: IntentMapping.UPGRADE_INTENT,
        weight: 8,
        type: 'suggested'
      });
    }

    // MKR actions
    const mkrBalance = tokenBalances?.find((token: TokenBalance) => token.symbol === 'MKR');
    if (mkrBalance && mkrBalance.value > 0n) {
      suggestedActions.push({
        primaryToken: 'MKR',
        secondaryToken: 'SKY',
        balance: mkrBalance.formatted,
        title: t`Upgrade MKR to SKY`,
        // TODO we need to handle input currency
        url: `/?${Widget}=${UPGRADE}&${InputAmount}=${mkrBalance.formatted}&${SourceToken}=MKR`,
        intent: IntentMapping.UPGRADE_INTENT,
        weight: 7,
        type: 'suggested'
      });
    }

    // if user has USDC or USDT or ETH, suggest to trade to USDS and then get rewards or save
    // USDC actions
    const usdcBalance = tokenBalances?.find((token: TokenBalance) => token.symbol === 'USDC');
    if (usdcBalance && usdcBalance.value > 0n) {
      linkedActions.push({
        balance: usdcBalance.formatted,
        primaryToken: 'USDC',
        secondaryToken: 'USDS',
        title: t`Trade and start saving`,
        stepOne: t`Trade USDC for USDS`,
        stepTwo: t`Access Sky Savings Rate with USDS`,
        url: `/?${Widget}=${TRADE}&${SourceToken}=USDC&${InputAmount}=${usdcBalance.formatted}&${TargetToken}=USDS&${LinkedAction}=${SAVINGS}`,
        intent: IntentMapping.TRADE_INTENT,
        la: IntentMapping.SAVINGS_INTENT,
        weight: 6,
        type: 'linked'
      });
      linkedActions.push({
        primaryToken: 'USDC',
        secondaryToken: 'USDS',
        balance: usdcBalance.formatted,
        title: t`Trade and get rewards`,
        stepOne: t`Trade USDC for USDS`,
        stepTwo: t`Get SKY rewards with USDS`,
        url: `/?${Widget}=${TRADE}&${SourceToken}=USDC&${InputAmount}=${usdcBalance.formatted}&${TargetToken}=USDS&${LinkedAction}=${REWARDS}${skyRewardContract ? `&reward=${skyRewardContract.contractAddress}` : ''}`,
        intent: IntentMapping.TRADE_INTENT,
        la: IntentMapping.REWARDS_INTENT,
        weight: 7,
        type: 'linked'
      });
      suggestedActions.push({
        primaryToken: 'USDC',
        secondaryToken: 'USDS',
        balance: usdcBalance.formatted,
        title: t`Trade USDC for USDS`,
        url: `/?${Widget}=${TRADE}&${SourceToken}=USDC&${InputAmount}=${usdcBalance.formatted}&${TargetToken}=USDS`,
        intent: IntentMapping.TRADE_INTENT,
        weight: 5,
        type: 'suggested'
      });
    }

    // USDT actions
    const usdtBalance = tokenBalances?.find((token: TokenBalance) => token.symbol === 'USDT');
    if (usdtBalance && usdtBalance.value > 0n) {
      linkedActions.push({
        balance: usdtBalance.formatted,
        primaryToken: 'USDT',
        secondaryToken: 'USDS',
        title: t`Trade and start saving`,
        stepOne: t`Trade USDT for USDS`,
        stepTwo: t`Access Sky Savings Rate with USDS`,
        url: `/?${Widget}=${TRADE}&${SourceToken}=USDT&${InputAmount}=${usdtBalance.formatted}&${TargetToken}=USDS&${LinkedAction}=${SAVINGS}`,
        intent: IntentMapping.TRADE_INTENT,
        la: IntentMapping.SAVINGS_INTENT,
        weight: 6,
        type: 'linked'
      });
      linkedActions.push({
        primaryToken: 'USDT',
        secondaryToken: 'USDS',
        title: t`Trade and get rewards`,
        balance: usdtBalance.formatted,
        stepOne: t`Trade USDT for USDS`,
        stepTwo: t`Get SKY rewards with USDS`,
        url: `/?${Widget}=${TRADE}&${SourceToken}=USDT&${InputAmount}=${usdtBalance.formatted}&${TargetToken}=USDS&${LinkedAction}=${REWARDS}${skyRewardContract ? `&reward=${skyRewardContract.contractAddress}` : ''}`,
        intent: IntentMapping.TRADE_INTENT,
        la: IntentMapping.REWARDS_INTENT,
        weight: 6,
        type: 'linked'
      });
      suggestedActions.push({
        primaryToken: 'USDT',
        secondaryToken: 'USDS',
        title: t`Trade USDT for USDS`,
        balance: usdtBalance.formatted,
        url: `/?${Widget}=${TRADE}&${SourceToken}=USDT&${InputAmount}=${usdtBalance.formatted}&${TargetToken}=USDS`,
        intent: IntentMapping.TRADE_INTENT,
        weight: 5,
        type: 'suggested'
      });
    }

    // if user has USDS, suggest to get rewards or save
    const usdsBalance = tokenBalances?.find((token: TokenBalance) => token.symbol === 'USDS');
    if (usdsBalance && usdsBalance.value > 0n) {
      suggestedActions.push({
        primaryToken: 'USDS',
        secondaryToken: 'USDS',
        title: t`Start saving`,
        balance: usdsBalance.formatted,
        url: `/?${Widget}=${SAVINGS}&${InputAmount}=${usdsBalance.formatted}`,
        intent: IntentMapping.SAVINGS_INTENT,
        weight: 6,
        type: 'suggested'
      });
      suggestedActions.push({
        primaryToken: 'USDS',
        secondaryToken: 'SKY',
        title: t`Start getting rewards`,
        balance: usdsBalance.formatted,
        url: `/?${Widget}=${REWARDS}&${InputAmount}=${usdsBalance.formatted}${skyRewardContract ? `&reward=${skyRewardContract.contractAddress}` : ''}`,
        intent: IntentMapping.REWARDS_INTENT,
        weight: 7,
        type: 'suggested'
      });
    }
  }

  const isRestrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const isRestrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';

  const restrictedIntents = isRestrictedBuild
    ? [IntentMapping.REWARDS_INTENT, IntentMapping.SAVINGS_INTENT]
    : isRestrictedMiCa
      ? [IntentMapping.TRADE_INTENT]
      : [];

  // if restricted build, remove restricted actions
  const restrictedSuggestedActions = suggestedActions.filter(
    action => !restrictedIntents.includes(action.intent)
  );
  const restrictedLinkedActions = linkedActions.filter(
    action => !restrictedIntents.includes(action.intent) && !restrictedIntents.includes(action.la)
  );

  return {
    suggestedActions: restrictedSuggestedActions,
    linkedActions: restrictedLinkedActions
  };
};

export const useUserSuggestedActions = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const tokens = useTokens(chainId);
  const [data, setData] = useState<
    { suggestedActions: SuggestedAction[]; linkedActions: LinkedAction[] } | undefined
  >();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const {
    data: tokenBalances,
    isLoading: tokenBalancesIsLoading,
    error: tokenBalanceError
  } = useTokenBalances({
    address,
    tokens,
    chainId
  });

  const rewardContracts = useAvailableTokenRewardContracts(chainId);

  const prevTokenBalances = useRef<any>(null);

  useEffect(() => {
    if (!tokenBalances || tokenBalancesIsLoading || tokenBalanceError) return;

    // Check if tokenBalances have actually changed to avoid unnecessary fetches
    if (
      JSON.stringify(tokenBalances, (_, value) => (typeof value === 'bigint' ? value.toString() : value)) ===
      JSON.stringify(prevTokenBalances.current, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    )
      return;

    const fetchData = () => {
      if (address && tokenBalances) {
        setIsLoading(true);
        try {
          const result = fetchUserSuggestedActions(chainId, tokenBalances, rewardContracts);
          setData(result);
          setError(undefined);
        } catch (err) {
          setError(err as Error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchData();
    // Update the ref to the current tokenBalances after fetching data
    prevTokenBalances.current = tokenBalances;
  }, [address, tokenBalances, tokenBalancesIsLoading, tokenBalanceError]);

  return { data, isLoading: isLoading || tokenBalancesIsLoading, error: error || tokenBalanceError };
};
