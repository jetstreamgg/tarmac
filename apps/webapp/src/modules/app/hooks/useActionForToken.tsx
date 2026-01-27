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
import { IntentMapping, QueryParams } from '@/lib/constants';
import { t } from '@lingui/core/macro';
import { base, mainnet, arbitrum, optimism, unichain } from 'viem/chains';
import { useChains, useChainId } from 'wagmi';

export const useActionForToken = () => {
  const chainId = useChainId();
  const [searchParams] = useSearchParams();
  const isRestrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const isRestrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';

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
        Chat,
        Flow
      } = QueryParams;
      const {
        REWARDS_INTENT: REWARD,
        UPGRADE_INTENT: UPGRADE,
        TRADE_INTENT: TRADE,
        SAVINGS_INTENT: SAVINGS,
        STAKE_INTENT: STAKE
      } = IntentMapping;
      const retainedParams = [Locale, Details, Chat];

      const rewardContracts = getRewardContracts(tokenChainId);

      const skyRewardContract = rewardContracts?.find(
        (rewardContract: RewardContract) => rewardContract.rewardToken.symbol === 'SKY'
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
                `?${Network}=${networkName}&${Widget}=${UPGRADE}&${InputAmount}=${balance}&${SourceToken}=MKR`
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
            [mainnet.id]: isRestrictedBuild
              ? undefined
              : {
                  label: t`View rewards options for your ${upperSymbol} ${isDifferentChain ? 'on Mainnet' : ''}`,
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${REWARD}`
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
                },
            [arbitrum.id]: isRestrictedBuild
              ? undefined
              : {
                  label: t`Start saving with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Arbitrum' : ''}`,
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${SAVINGS}&${InputAmount}=${balance}&${SourceToken}=${symbol}`
                  ),
                  image
                },
            [optimism.id]: isRestrictedBuild
              ? undefined
              : {
                  label: t`Start saving with your ${formattedBalance} ${upperSymbol} ${isDifferentChain ? 'on Optimism' : ''}`,
                  actionUrl: getQueryParams(
                    `?${Network}=${networkName}&${Widget}=${SAVINGS}&${InputAmount}=${balance}&${SourceToken}=${symbol}`
                  ),
                  image
                },
            [unichain.id]: isRestrictedBuild
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
                      },
            [arbitrum.id]:
              lowerSymbol === 'usdt'
                ? undefined
                : isRestrictedBuild
                  ? {
                      label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS ${isDifferentChain ? 'on Arbitrum' : ''}`,
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
                    },
            [optimism.id]:
              lowerSymbol === 'usdt'
                ? undefined
                : isRestrictedBuild
                  ? {
                      label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS ${isDifferentChain ? 'on Optimism' : ''}`,
                      actionUrl: getQueryParams(
                        `?${Network}=${networkName}&${Widget}=${TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS`
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
                : isRestrictedBuild
                  ? {
                      label: t`Trade your ${formattedBalance} ${upperSymbol} for USDS ${isDifferentChain ? 'on Unichain' : ''}`,
                      actionUrl: getQueryParams(
                        `?${Network}=${networkName}&${Widget}=${TRADE}&${InputAmount}=${balance}&${SourceToken}=${symbol}&${TargetToken}=USDS`
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
    [getRewardContracts, searchParams, isRestrictedBuild, isRestrictedMiCa, chainId, chains, totalUserStaked]
  );

  return actionForToken;
};
