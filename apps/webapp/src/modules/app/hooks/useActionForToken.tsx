import { formatNumber, isBaseChainId, isArbitrumChainId } from '@jetstreamgg/utils';
import { useCallback } from 'react';
import { RewardContract, useAvailableTokenRewardContracts } from '@jetstreamgg/hooks';
import { useChainId } from 'wagmi';
import { getRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { useSearchParams } from 'react-router-dom';
import { IntentMapping, QueryParams } from '@/lib/constants';
import { t } from '@lingui/core/macro';
import { base, mainnet } from 'viem/chains';

export const useActionForToken = () => {
  const chainId = useChainId();
  const isBaseChain = isBaseChainId(chainId);
  const isArbitrumChain = isArbitrumChainId(chainId);
  const rewardContracts = useAvailableTokenRewardContracts(chainId);
  const skyRewardContract = rewardContracts?.find(
    (rewardContract: RewardContract) => rewardContract.rewardToken.symbol === 'SKY'
  );
  const [searchParams] = useSearchParams();

  const isRestrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const isRestrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';

  const actionForToken = useCallback(
    (symbol: string, balance: string) => {
      const { LinkedAction, InputAmount, SourceToken, TargetToken, Widget, Locale, Details, Chat } =
        QueryParams;
      const {
        REWARDS_INTENT: REWARD,
        UPGRADE_INTENT: UPGRADE,
        TRADE_INTENT: TRADE,
        SAVINGS_INTENT: SAVINGS
      } = IntentMapping;
      const retainedParams = [Locale, Details, Chat];

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
                  label: t`Upgrade your ${formattedBalance} ${upperSymbol} to USDS`,
                  actionUrl: getQueryParams(`?${Widget}=${UPGRADE}&${InputAmount}=${balance}`),
                  image
                }
              : {
                  label: t`Upgrade your ${formattedBalance} ${upperSymbol} to USDS to get rewards`,
                  actionUrl: getQueryParams(
                    `?${Widget}=${UPGRADE}&${InputAmount}=${balance}&${LinkedAction}=${REWARD}&${skyRewardContract ? `&reward=${skyRewardContract.contractAddress}` : ''}`
                  ),
                  image
                },
            [base.id]: undefined
          };
          break;
        case 'mkr':
          action = {
            [mainnet.id]: {
              label: t`Upgrade your ${formattedBalance} ${upperSymbol} to SKY`,
              actionUrl: getQueryParams(`?${Widget}=${UPGRADE}&${InputAmount}=${balance}&${SourceToken}=MKR`),
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
                  label: t`Get rewards with your ${formattedBalance} ${upperSymbol}`,
                  actionUrl: getQueryParams(
                    `?${Widget}=${REWARD}&${InputAmount}=${balance}&${skyRewardContract ? `&reward=${skyRewardContract.contractAddress}` : ''}`
                  ),
                  image
                },
            [base.id]: isRestrictedBuild
              ? undefined
              : {
                  label: t`Start saving with your ${formattedBalance} ${upperSymbol}`,
                  actionUrl: getQueryParams(
                    `?${Widget}=${SAVINGS}&${InputAmount}=${balance}&${SourceToken}=${symbol}`
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
                    label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS`,
                    // TODO: Some of these trades are not supported by the trade widget (eth - usds, weth - usds)
                    actionUrl: getQueryParams(
                      `?${Widget}=${TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS`
                    ),
                    image
                  }
                : {
                    label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS to get rewards`,
                    // TODO: Some of these trades are not supported by the trade widget (eth - usds, weth - usds)
                    actionUrl: getQueryParams(
                      `?${Widget}=${TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS&${LinkedAction}=${REWARD}${skyRewardContract ? `&reward=${skyRewardContract.contractAddress}` : ''}`
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
                        label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS`,
                        actionUrl: getQueryParams(
                          `?${Widget}=${TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS`
                        ),
                        image
                      }
                    : {
                        label: t`Start saving with your ${formattedBalance} ${upperSymbol}`,
                        actionUrl: getQueryParams(
                          `?${Widget}=${SAVINGS}&${InputAmount}=${balance}&${SourceToken}=${symbol}`
                        ),
                        image
                      }
          };
          break;
        default:
          action = undefined;
      }

      return isBaseChain || isArbitrumChain ? action?.[base.id] : action?.[mainnet.id];
    },
    [skyRewardContract, searchParams, isRestrictedBuild, isRestrictedMiCa]
  );

  return actionForToken;
};
