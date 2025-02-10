import { formatNumber, isBaseChainId } from '@jetstreamgg/utils';
import { useCallback } from 'react';
import { RewardContract, useAvailableTokenRewardContractsForChain } from '@jetstreamgg/hooks';
import { getRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { useSearchParams } from 'react-router-dom';
import { IntentMapping, QueryParams } from '@/lib/constants';
import { t } from '@lingui/core/macro';
import { base, mainnet } from 'viem/chains';
import { useChains, useChainId } from 'wagmi';

export const useActionForToken = () => {
  const [searchParams] = useSearchParams();
  const chainId = useChainId();
  const isRestrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const isRestrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';

  const getRewardContracts = useAvailableTokenRewardContractsForChain();

  const chains = useChains();

  const actionForToken = useCallback(
    (symbol: string, balance: string, tokenChainId: number) => {
      const { LinkedAction, InputAmount, SourceToken, TargetToken, Widget, Locale, Details, Network } =
        QueryParams;
      const {
        REWARDS_INTENT: REWARD,
        UPGRADE_INTENT: UPGRADE,
        TRADE_INTENT: TRADE,
        SAVINGS_INTENT: SAVINGS
      } = IntentMapping;
      const retainedParams = [Locale, Details];

      const rewardContracts = getRewardContracts(tokenChainId);

      const skyRewardContract = rewardContracts?.find(
        (rewardContract: RewardContract) => rewardContract.rewardToken.symbol === 'SKY'
      );

      const isBaseChain = isBaseChainId(tokenChainId);

      const networkName = chains.find(c => c.id === tokenChainId)?.name || 'ethereum';

      const isDifferentChain = chainId !== tokenChainId;

      const lowerSymbol = symbol.toLowerCase();
      const upperSymbol = symbol.toUpperCase();
      const image = `/tokens/actions/${lowerSymbol}.png`;
      const formattedBalance = formatNumber(parseFloat(balance));
      let action;

      const getQueryParams = (url: string) => getRetainedQueryParams(url, retainedParams, searchParams);

      // TODO: What do we suggest for SKY?
      switch (lowerSymbol) {
        case 'dai':
          action = {
            [mainnet.id]: isRestrictedBuild
              ? {
                  label: t`Upgrade your ${formattedBalance} ${upperSymbol} to USDS ${isDifferentChain ? 'on Mainnet' : ''}`,
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${UPGRADE}&${InputAmount}=${balance}`
                  ),
                  image
                }
              : {
                  label: t`Upgrade your ${formattedBalance} ${upperSymbol} to USDS to get rewards ${isDifferentChain ? 'on Mainnet' : ''}`,
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${UPGRADE}&${InputAmount}=${balance}&${LinkedAction}=${REWARD}&${skyRewardContract ? `&reward=${skyRewardContract.contractAddress}` : ''}`
                  ),
                  image
                },
            [base.id]: undefined
          };
          break;
        case 'mkr':
          action = {
            [mainnet.id]: {
              label: t`Upgrade your ${formattedBalance} ${upperSymbol} to SKY ${isDifferentChain ? 'on Mainnet' : ''}`,
              actionUrl: getQueryParams(
                `?${Network}=${networkName}&${Widget}=${UPGRADE}&${InputAmount}=${balance}&${SourceToken}=MKR`
              ),
              image
            },
            [base.id]: undefined
          };
          break;
        case 'usds':
          action = {
            [mainnet.id]: isRestrictedBuild
              ? undefined
              : {
                  label: t`Get rewards with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Mainnet' : ''}`,
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${REWARD}&${InputAmount}=${balance}&${skyRewardContract ? `&reward=${skyRewardContract.contractAddress}` : ''}`
                  ),
                  image
                },
            [base.id]: isRestrictedBuild
              ? undefined
              : {
                  label: t`Start saving with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Base' : ''}`,
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${SAVINGS}&${InputAmount}=${balance}&${SourceToken}=${symbol}`
                  ),
                  image
                }
          };
          break;
        // TODO: SKY, what do we suggest?
        // TODO: Uncomment eth-weth when their trades to USDS are supported
        // case 'eth':
        // case 'weth':
        case 'usdc':
        case 'usdt':
          action = {
            [mainnet.id]: isRestrictedMiCa
              ? undefined
              : isRestrictedBuild
                ? {
                    label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS ${isDifferentChain ? 'on Mainnet' : ''}`,
                    // TODO: Some of these trades are not supported by the trade widget (eth - usds, weth - usds)
                    actionUrl: getQueryParams(
                      `?${Network}=${networkName}&${Widget}=${TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS`
                    ),
                    image
                  }
                : {
                    label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS to get rewards ${isDifferentChain ? 'on Mainnet' : ''}`,
                    // TODO: Some of these trades are not supported by the trade widget (eth - usds, weth - usds)
                    actionUrl: getQueryParams(
                      `?${Network}=${networkName}&${Widget}=${TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS&${LinkedAction}=${REWARD}${skyRewardContract ? `&reward=${skyRewardContract.contractAddress}` : ''}`
                    ),
                    image
                  },
            [base.id]:
              lowerSymbol === 'usdt'
                ? undefined
                : isRestrictedMiCa
                  ? undefined
                  : isRestrictedBuild
                    ? {
                        label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS ${isDifferentChain ? 'on Base' : ''}`,
                        actionUrl: getQueryParams(
                          `?${Network}=${networkName}&${Widget}=${TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS`
                        ),
                        image
                      }
                    : {
                        label: t`Start saving with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Base' : ''}`,
                        actionUrl: getQueryParams(
                          `?${Network}=${networkName}&${Widget}=${SAVINGS}&${InputAmount}=${balance}&${SourceToken}=${symbol}`
                        ),
                        image
                      }
          };
          break;
        default:
          action = undefined;
      }

      return isBaseChain ? action?.[base.id] : action?.[mainnet.id];
    },
    [getRewardContracts, searchParams, isRestrictedBuild, isRestrictedMiCa, chainId, chains]
  );

  return actionForToken;
};
