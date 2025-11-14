import { RewardContract } from '@jetstreamgg/sky-hooks';
import { RewardsFlow, StakeFlow, SUPPORTED_TOKEN_SYMBOLS } from '@jetstreamgg/sky-widgets';
import {
  QueryParams,
  IntentMapping,
  VALID_LINKED_ACTIONS,
  CHAIN_WIDGET_MAP,
  mapQueryParamToIntent,
  COMING_SOON_MAP,
  ExpertIntentMapping
} from '@/lib/constants';
import { ExpertIntent, Intent } from '@/lib/enums';
import { defaultConfig } from '../config/default-config';
import { isL2ChainId } from '@jetstreamgg/sky-utils';
import { Chain } from 'viem';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';

export const validateSearchParams = (
  searchParams: URLSearchParams,
  rewardContracts: RewardContract[],
  widget: string,
  setSelectedRewardContract: (rewardContract?: RewardContract) => void,
  chainId: number,
  chains: readonly [Chain, ...Chain[]],
  setSelectedExpertOption: (expertOption: ExpertIntent | undefined) => void,
  expertRiskDisclaimerShown: boolean
) => {
  const chainInUrl = chains.find(c => normalizeUrlParam(c.name) === searchParams.get(QueryParams.Network));
  const isL2Chain = isL2ChainId(chainInUrl?.id || chainId);

  searchParams.forEach((value, key) => {
    // removes any query param not found in QueryParams
    if (!Object.values(QueryParams).includes(key as QueryParams)) {
      searchParams.delete(key);
    }

    // removes details param if value is not true or false
    if (key === QueryParams.Details && !['true', 'false'].includes(value.toLowerCase())) {
      searchParams.delete(key);
    }

    // removes widget param is value is not valid
    if (
      key === QueryParams.Widget &&
      (!Object.values(IntentMapping).includes(value.toLowerCase()) ||
        !CHAIN_WIDGET_MAP[chainInUrl?.id || chainId].includes(mapQueryParamToIntent(value)) ||
        COMING_SOON_MAP[chainInUrl?.id || chainId]?.includes(mapQueryParamToIntent(value)))
    ) {
      searchParams.delete(key);
    }

    // removes rewards param if value is not a valid reward contract address
    // also sets the selected reward contract if the reward contract address is valid
    if (key === QueryParams.Reward) {
      const rewardContract = rewardContracts?.find(
        f => f.contractAddress?.toLowerCase() === value?.toLowerCase()
      );
      if (!rewardContract) {
        searchParams.delete(key);
      } else {
        setSelectedRewardContract(rewardContract);
      }
    }

    // Reset the selected reward contract if the widget is set to rewards and no valid reward contract parameter exists.
    if (widget === IntentMapping[Intent.REWARDS_INTENT]) {
      if (!searchParams.get(QueryParams.Reward)) {
        setSelectedRewardContract(undefined);
        searchParams.delete(QueryParams.InputAmount);
      }

      // if the flow is claim, remove the flow param as it's only used by the chatbot
      if (searchParams.get(QueryParams.Flow) === RewardsFlow.CLAIM) {
        searchParams.delete(QueryParams.Flow);
      }
    }

    if (widget === IntentMapping[Intent.STAKE_INTENT]) {
      // if the flow is claim, remove the flow param as it's only used by the chatbot
      if (searchParams.get(QueryParams.Flow) === StakeFlow.CLAIM) {
        searchParams.delete(QueryParams.Flow);
      }
    }

    // if widget changes to something other than rewards, and we're not in a rewards linked action, reset the selected reward contract
    if (
      widget !== IntentMapping[Intent.REWARDS_INTENT] &&
      searchParams.get(QueryParams.LinkedAction) !== IntentMapping[Intent.REWARDS_INTENT]
    ) {
      searchParams.delete(QueryParams.Reward);
      setSelectedRewardContract(undefined);
    }

    // removes expertModule param if value is not a valid expert intent or if the expert risk hasn't been acknowledged
    // also sets the selected expert option if the expertIntent is valid
    if (key === QueryParams.ExpertModule) {
      const intent = Object.entries(ExpertIntentMapping).find(
        ([, intentValue]) => intentValue === value
      )?.[0] as ExpertIntent | undefined;
      if (!intent || !expertRiskDisclaimerShown) {
        searchParams.delete(key);
      } else {
        setSelectedExpertOption(intent);
      }
    }

    // Reset the selected expert option if the widget is set to expert and no valid expert option parameter exists.
    if (widget === IntentMapping[Intent.EXPERT_INTENT]) {
      if (!searchParams.get(QueryParams.ExpertModule)) {
        setSelectedExpertOption(undefined);
        searchParams.delete(QueryParams.InputAmount);
      }
    }

    // if widget changes to something other than advanced, and we're not in an advanced linked action, reset the selected advanced option
    if (
      widget !== IntentMapping[Intent.EXPERT_INTENT] &&
      searchParams.get(QueryParams.LinkedAction) !== IntentMapping[Intent.EXPERT_INTENT]
    ) {
      searchParams.delete(QueryParams.ExpertModule);
      setSelectedExpertOption(undefined);
    }

    // validate source token
    if (key === QueryParams.SourceToken) {
      // source token is only valid for upgrade, savings and trade in Mainnet, and for savings and trade on L2 chains, remove if widget value is not correct
      const widgetParam = searchParams.get(QueryParams.Widget);
      if (
        !widgetParam ||
        (![
          IntentMapping[Intent.UPGRADE_INTENT],
          IntentMapping[Intent.SAVINGS_INTENT],
          IntentMapping[Intent.TRADE_INTENT]
        ].includes(widgetParam.toLowerCase()) &&
          !isL2Chain) ||
        (![IntentMapping[Intent.SAVINGS_INTENT], IntentMapping[Intent.TRADE_INTENT]].includes(
          widgetParam.toLowerCase()
        ) &&
          isL2Chain)
      ) {
        searchParams.delete(key);
      }

      // if widget is upgrade, only valid source token is MKR, DAI or USDS
      if (widgetParam?.toLowerCase() === IntentMapping[Intent.UPGRADE_INTENT]) {
        if (!['mkr', 'dai', 'usds'].includes(value.toLowerCase())) {
          searchParams.delete(key);
        }
      }

      // if widget is trade, check if token is valid
      if (widgetParam?.toLowerCase() === IntentMapping[Intent.TRADE_INTENT]) {
        const tradeValidValues = Object.values(SUPPORTED_TOKEN_SYMBOLS).map(symbol => symbol.toLowerCase());
        if (!tradeValidValues.includes(value.toLowerCase())) {
          searchParams.delete(key);
        }
      }
    }

    // validate target token
    if (key === QueryParams.TargetToken) {
      // target token is only valid on trade widget
      const widgetParam = searchParams.get(QueryParams.Widget);
      if (!widgetParam || ![IntentMapping[Intent.TRADE_INTENT]].includes(widgetParam.toLowerCase())) {
        searchParams.delete(key);
      }

      // check if token is supported
      const tradeValidValues = Object.values(SUPPORTED_TOKEN_SYMBOLS).map(symbol => symbol.toLowerCase());
      if (!tradeValidValues.includes(value.toLowerCase())) {
        searchParams.delete(key);
      }

      // check if target token is valid based off source token
      const sourceToken = searchParams.get(QueryParams.SourceToken);
      if (sourceToken) {
        const disallowedPairs = defaultConfig.tradeDisallowedPairs;
        const pairsToCheck = disallowedPairs?.[sourceToken.toUpperCase()];
        if (pairsToCheck?.includes(value.toUpperCase() as SUPPORTED_TOKEN_SYMBOLS)) {
          searchParams.delete(key);
        }
      }
    }

    // validate input amount
    if (key === QueryParams.InputAmount) {
      // check if input amount is not a valid number or is negative
      if (isNaN(Number(value)) || Number(value) <= 0) {
        searchParams.delete(key);
      }
    }

    // removes linked action param if value is not valid or if we are on an L2 chain
    if (
      key === QueryParams.LinkedAction &&
      (!VALID_LINKED_ACTIONS.includes(value.toLowerCase()) || isL2Chain)
    ) {
      // TODO here we could also check if it's a valid linked action based on the combination of widget and LA value
      searchParams.delete(key);
    }

    // removes reset param
    if (key === QueryParams.Reset) {
      setTimeout(() => {
        // wait for the widget to reset
        searchParams.delete(key);
      }, 500);
    }
  });

  return searchParams;
};

// This is intended to be run immediately after the global validation function
export const validateLinkedActionSearchParams = (searchParams: URLSearchParams) => {
  const linkedActionParam = searchParams.get(QueryParams.LinkedAction);
  // Only run this validation if we are in linked action mode
  if (linkedActionParam) {
    searchParams.forEach((value, key) => {
      if (key === QueryParams.SourceToken) {
        const widgetParam = searchParams.get(QueryParams.Widget);

        // Only DAI is allowed as a source token for Upgrade when in linked action
        if (widgetParam?.toLowerCase() === IntentMapping[Intent.UPGRADE_INTENT]) {
          if (value.toLowerCase() !== 'dai') {
            searchParams.delete(key);
          }
        }
      }

      // Only USDS is allowed as a target token for Trade when in linked action
      if (key === QueryParams.TargetToken) {
        const widgetParam = searchParams.get(QueryParams.Widget);

        if (widgetParam?.toLowerCase() === IntentMapping[Intent.TRADE_INTENT]) {
          if (value.toLowerCase() !== 'usds') {
            searchParams.delete(key);
          }
        }
      }
    });
  }
  return searchParams;
};
