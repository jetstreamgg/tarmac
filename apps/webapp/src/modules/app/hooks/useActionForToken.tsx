import {
  formatNumber,
  isBaseChainId,
  isArbitrumChainId,
  isOptimismChainId,
  isUnichainChainId,
  isL2ChainId
} from '@jetstreamgg/sky-utils';
import { useCallback } from 'react';
import {
  RewardContract,
  useAvailableTokenRewardContractsForChains,
  useTotalUserStaked
} from '@jetstreamgg/sky-hooks';
import { getRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { useSearchParams } from 'react-router-dom';
import { IntentMapping, QueryParams, ConvertIntentMapping } from '@/lib/constants';
import { ConvertIntent } from '@/lib/enums';
import { t } from '@lingui/core/macro';
import { base, mainnet, arbitrum, optimism, unichain } from 'viem/chains';
import { useChains, useChainId } from 'wagmi';
import { useGeoConfig } from '@/modules/geo-config';

export const useActionForToken = () => {
  const chainId = useChainId();
  const [searchParams] = useSearchParams();
  const { isRegionRestricted } = useGeoConfig();

  const getRewardContracts = useAvailableTokenRewardContractsForChains();
  const { data: totalUserStaked } = useTotalUserStaked();

  const chains = useChains();

  const actionForToken = useCallback(
    (symbol: string, balance: string, tokenChainId: number) => {
      const {
        LinkedAction,
        InputAmount,
        SourceToken,
        TargetToken,
        Widget,
        Locale,
        Details,
        Network,
        Flow,
        ConvertModule
      } = QueryParams;
      const {
        REWARDS_INTENT: REWARD,
        SAVINGS_INTENT: SAVINGS,
        STAKE_INTENT: STAKE,
        CONVERT_INTENT: CONVERT
      } = IntentMapping;
      const CONVERT_TRADE = ConvertIntentMapping[ConvertIntent.TRADE_INTENT];
      const CONVERT_UPGRADE = ConvertIntentMapping[ConvertIntent.UPGRADE_INTENT];
      const retainedParams = [Locale, Details];

      const rewardContracts = getRewardContracts(tokenChainId);

      const spkRewardContract = rewardContracts?.find(
        (rewardContract: RewardContract) => rewardContract.rewardToken.symbol === 'SPK'
      );

      const isBaseChainAction = isBaseChainId(tokenChainId);
      const isArbitrumChainAction = isArbitrumChainId(tokenChainId);
      const isOptimismChainAction = isOptimismChainId(tokenChainId);
      const isUnichainChainAction = isUnichainChainId(tokenChainId);
      const isL2ChainAction = isL2ChainId(tokenChainId);

      const networkName = (chains.find(c => c.id === tokenChainId)?.name || 'ethereum').toLowerCase();

      const isDifferentChain = chainId !== tokenChainId;

      const lowerSymbol = symbol.toLowerCase();
      const upperSymbol = symbol.toUpperCase();
      //TODO: make this more generalizable
      //currently, we assume that usds action is savings on L2 chains, and rewards on mainnet
      const image = `/tokens/actions/${lowerSymbol}${
        lowerSymbol === 'usds' && isL2ChainAction ? '-savings' : ''
      }.png`;
      const formattedBalance = formatNumber(parseFloat(balance));
      let action;

      const getQueryParams = (url: string) => getRetainedQueryParams(url, retainedParams, searchParams);

      // TODO: What do we suggest for SKY?
      switch (lowerSymbol) {
        case 'dai':
          action = {
            [mainnet.id]: isRegionRestricted
              ? {
                  label: t`Upgrade your ${formattedBalance} ${upperSymbol} to USDS ${isDifferentChain ? 'on Mainnet' : ''}`,
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${CONVERT}&${ConvertModule}=${CONVERT_UPGRADE}&${InputAmount}=${balance}`
                  ),
                  image
                }
              : {
                  label: t`Upgrade your ${formattedBalance} ${upperSymbol} to USDS to get rewards ${isDifferentChain ? 'on Mainnet' : ''}`,
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${CONVERT}&${ConvertModule}=${CONVERT_UPGRADE}&${InputAmount}=${balance}&${LinkedAction}=${REWARD}&${spkRewardContract ? `&reward=${spkRewardContract.contractAddress}` : ''}`
                  ),
                  image
                },
            [base.id]: undefined,
            [arbitrum.id]: undefined,
            [optimism.id]: undefined,
            [unichain.id]: undefined
          };
          break;
        case 'mkr':
          action = {
            [mainnet.id]: {
              label: t`Upgrade your ${formattedBalance} ${upperSymbol} to SKY ${isDifferentChain ? 'on Mainnet' : ''}`,
              actionUrl: getQueryParams(
                `?${Network}=${networkName}&${Widget}=${CONVERT}&${ConvertModule}=${CONVERT_UPGRADE}&${InputAmount}=${balance}&${SourceToken}=MKR`
              ),
              image
            },
            [base.id]: undefined,
            [arbitrum.id]: undefined,
            [optimism.id]: undefined,
            [unichain.id]: undefined
          };
          break;
        case 'sky': {
          // If user has existing staking positions, link to manage overview; otherwise link to open new position
          const hasStakingPositions = totalUserStaked !== undefined && totalUserStaked > 0n;
          const flowParam = hasStakingPositions ? '' : `&${Flow}=open`;

          action = {
            [mainnet.id]: {
              label: t`Stake your ${formattedBalance} ${upperSymbol} in the Staking Engine ${isDifferentChain ? 'on Mainnet' : ''}`,
              actionUrl: getQueryParams(
                `?${Network}=${networkName}&${Widget}=${STAKE}&${InputAmount}=${balance}${flowParam}`
              ),
              image
            },
            [base.id]: undefined,
            [arbitrum.id]: undefined,
            [optimism.id]: undefined,
            [unichain.id]: undefined
          };
          break;
        }
        case 'usds':
          action = {
            [mainnet.id]: isRegionRestricted
              ? undefined
              : {
                  label: t`View rewards options for your ${upperSymbol} ${isDifferentChain ? 'on Mainnet' : ''}`,
                  actionUrl: getQueryParams(`?${Network}=${networkName}&${Widget}=${REWARD}`),
                  image
                },
            [base.id]: isRegionRestricted
              ? undefined
              : {
                  label: t`Start saving with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Base' : ''}`,
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${SAVINGS}&${InputAmount}=${balance}&${SourceToken}=${symbol}`
                  ),
                  image
                },
            [arbitrum.id]: isRegionRestricted
              ? undefined
              : {
                  label: t`Start saving with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Arbitrum' : ''}`,
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${SAVINGS}&${InputAmount}=${balance}&${SourceToken}=${symbol}`
                  ),
                  image
                },
            [optimism.id]: isRegionRestricted
              ? undefined
              : {
                  label: t`Start saving with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Optimism' : ''}`,
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${SAVINGS}&${InputAmount}=${balance}&${SourceToken}=${symbol}`
                  ),
                  image
                },
            [unichain.id]: isRegionRestricted
              ? undefined
              : {
                  label: t`Start saving with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Unichain' : ''}`,
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
            [mainnet.id]: isRegionRestricted
              ? {
                  label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS ${isDifferentChain ? 'on Mainnet' : ''}`,
                  // TODO: Some of these trades are not supported by the trade widget (eth - usds, weth - usds)
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${CONVERT}&${ConvertModule}=${CONVERT_TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS`
                  ),
                  image
                }
              : {
                  label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS to get rewards ${isDifferentChain ? 'on Mainnet' : ''}`,
                  // TODO: Some of these trades are not supported by the trade widget (eth - usds, weth - usds)
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${CONVERT}&${ConvertModule}=${CONVERT_TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS&${LinkedAction}=${REWARD}${spkRewardContract ? `&reward=${spkRewardContract.contractAddress}` : ''}`
                  ),
                  image
                },
            [base.id]:
              lowerSymbol === 'usdt'
                ? undefined
                : isRegionRestricted
                  ? {
                      label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS ${isDifferentChain ? 'on Base' : ''}`,
                      actionUrl: getQueryParams(
                        `?${Network}=${networkName}&${Widget}=${CONVERT}&${ConvertModule}=${CONVERT_TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS`
                      ),
                      image
                    }
                  : {
                      label: t`Start saving with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Base' : ''}`,
                      actionUrl: getQueryParams(
                        `?${Network}=${networkName}&${Widget}=${SAVINGS}&${InputAmount}=${balance}&${SourceToken}=${symbol}`
                      ),
                      image
                    },
            [arbitrum.id]:
              lowerSymbol === 'usdt'
                ? undefined
                : isRegionRestricted
                  ? {
                      label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS ${isDifferentChain ? 'on Arbitrum' : ''}`,
                      actionUrl: getQueryParams(
                        `?${Network}=${networkName}&${Widget}=${CONVERT}&${ConvertModule}=${CONVERT_TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS`
                      ),
                      image
                    }
                  : {
                      label: t`Start saving with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Base' : ''}`,
                      actionUrl: getQueryParams(
                        `?${Network}=${networkName}&${Widget}=${SAVINGS}&${InputAmount}=${balance}&${SourceToken}=${symbol}`
                      ),
                      image
                    },
            [optimism.id]:
              lowerSymbol === 'usdt'
                ? undefined
                : isRegionRestricted
                  ? {
                      label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS ${isDifferentChain ? 'on Optimism' : ''}`,
                      actionUrl: getQueryParams(
                        `?${Network}=${networkName}&${Widget}=${CONVERT}&${ConvertModule}=${CONVERT_TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS`
                      ),
                      image
                    }
                  : {
                      label: t`Start saving with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Optimism' : ''}`,
                      actionUrl: getQueryParams(
                        `?${Network}=${networkName}&${Widget}=${SAVINGS}&${InputAmount}=${balance}&${SourceToken}=${symbol}`
                      ),
                      image
                    },
            [unichain.id]:
              lowerSymbol === 'usdt'
                ? undefined
                : isRegionRestricted
                  ? {
                      label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS ${isDifferentChain ? 'on Unichain' : ''}`,
                      actionUrl: getQueryParams(
                        `?${Network}=${networkName}&${Widget}=${CONVERT}&${ConvertModule}=${CONVERT_TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS`
                      ),
                      image
                    }
                  : {
                      label: t`Start saving with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Unichain' : ''}`,
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

      if (isBaseChainAction) return action?.[base.id];
      if (isArbitrumChainAction) return action?.[arbitrum.id];
      if (isOptimismChainAction) return action?.[optimism.id];
      if (isUnichainChainAction) return action?.[unichain.id];
      return action?.[mainnet.id];
    },
    [getRewardContracts, searchParams, isRegionRestricted, chainId, chains, totalUserStaked]
  );

  return actionForToken;
};
