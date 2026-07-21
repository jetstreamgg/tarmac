import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import {
  TRUST_LEVELS,
  TrustLevelEnum,
  ModuleEnum,
  TransactionTypeEnum,
  HISTORY_STALE_TIME
} from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { historyQueryArgs } from '../shared/historyQueryHelpers';
import { DaiUsdsRow, MkrSkyRow, UpgradeHistory, UpgradeResponse, UpgradeResponses } from './upgrade';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';
import { isTestnetId, chainId as chainIdMap } from '@/utils';

export function upgradeHistoryFragments({
  usr,
  chainId,
  beforeTimestamp
}: {
  usr: string;
  chainId: number;
  beforeTimestamp?: number;
}): string {
  // Note: 'usr' is the reciever of the upgraded/reverted token, 'caller' is the sender.
  const args = historyQueryArgs(`usr: { _eq: "${usr}" }, chainId: { _eq: ${chainId} }`, beforeTimestamp);
  return `
      daiToUsdsUpgrades: DaiToUsdsUpgrade${args} {
        wad
        blockTimestamp
        transactionHash
      }
      usdsToDaiReverts: UsdsToDaiRevert${args} {
        wad
        blockTimestamp
        transactionHash
      }
      mkrToSkyUpgrades: MkrToSkyUpgrade${args} {
        mkrAmt
        skyAmt
        blockTimestamp
        transactionHash
      }
      mkrToSkyUpgradeV2S: MkrToSkyUpgradeV2${args} {
        mkrAmt
        skyAmt
        blockTimestamp
        transactionHash
      }
      skyToMkrReverts: SkyToMkrRevert${args} {
        mkrAmt
        skyAmt
        blockTimestamp
        transactionHash
      }
  `;
}

export function mapUpgradeHistoryResponse(
  response: {
    daiToUsdsUpgrades: UpgradeResponses<DaiUsdsRow>;
    usdsToDaiReverts: UpgradeResponses<DaiUsdsRow>;
    mkrToSkyUpgrades: UpgradeResponses<MkrSkyRow>;
    skyToMkrReverts: UpgradeResponses<MkrSkyRow>;
    mkrToSkyUpgradeV2S: UpgradeResponses<MkrSkyRow>;
  },
  chainId: number
): UpgradeHistory {
  const daiToUsdsUpgrades: DaiUsdsRow[] = response.daiToUsdsUpgrades.map(
    (d: UpgradeResponse<DaiUsdsRow>) => ({
      wad: BigInt(d.wad),
      blockTimestamp: new Date(parseInt(d.blockTimestamp) * 1000),
      transactionHash: d.transactionHash,
      module: ModuleEnum.UPGRADE,
      type: TransactionTypeEnum.DAI_TO_USDS,
      chainId
    })
  );

  const usdsToDaiReverts: DaiUsdsRow[] = response.usdsToDaiReverts.map((w: UpgradeResponse<DaiUsdsRow>) => ({
    wad: -BigInt(w.wad), //make withdrawals negative
    blockTimestamp: new Date(parseInt(w.blockTimestamp) * 1000),
    transactionHash: w.transactionHash,
    module: ModuleEnum.UPGRADE,
    type: TransactionTypeEnum.USDS_TO_DAI,
    chainId
  }));

  const mkrToSkyUpgrades: MkrSkyRow[] = response.mkrToSkyUpgrades.map((d: UpgradeResponse<MkrSkyRow>) => ({
    mkrAmt: BigInt(d.mkrAmt),
    skyAmt: BigInt(d.skyAmt),
    blockTimestamp: new Date(parseInt(d.blockTimestamp) * 1000),
    transactionHash: d.transactionHash,
    module: ModuleEnum.UPGRADE,
    type: TransactionTypeEnum.MKR_TO_SKY,
    chainId
  }));

  const mkrToSkyUpgradeV2S: MkrSkyRow[] = response.mkrToSkyUpgradeV2S.map(
    (d: UpgradeResponse<MkrSkyRow>) => ({
      mkrAmt: BigInt(d.mkrAmt),
      skyAmt: BigInt(d.skyAmt),
      blockTimestamp: new Date(parseInt(d.blockTimestamp) * 1000),
      transactionHash: d.transactionHash,
      module: ModuleEnum.UPGRADE,
      type: TransactionTypeEnum.MKR_TO_SKY,
      chainId
    })
  );

  const skyToMkrReverts: MkrSkyRow[] = response.skyToMkrReverts.map((w: UpgradeResponse<MkrSkyRow>) => ({
    mkrAmt: -BigInt(w.mkrAmt), //make withdrawals negative
    skyAmt: -BigInt(w.skyAmt),
    blockTimestamp: new Date(parseInt(w.blockTimestamp) * 1000),
    transactionHash: w.transactionHash,
    module: ModuleEnum.UPGRADE,
    type: TransactionTypeEnum.SKY_TO_MKR,
    chainId
  }));

  const combined = [
    ...daiToUsdsUpgrades,
    ...usdsToDaiReverts,
    ...mkrToSkyUpgrades,
    ...mkrToSkyUpgradeV2S,
    ...skyToMkrReverts
  ];
  return combined.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
}

async function fetchUpgradeHistory(
  urlIndexer: string,
  chainId: number,
  address?: string
): Promise<UpgradeHistory | undefined> {
  if (!address) return [];
  const query = gql`
    {
      ${upgradeHistoryFragments({ usr: address.toLowerCase(), chainId })}
    }
  `;
  const response = await request<Parameters<typeof mapUpgradeHistoryResponse>[0]>(urlIndexer, query);
  return mapUpgradeHistoryResponse(response, chainId);
}

export function useUpgradeHistory({
  indexerUrl
}: {
  indexerUrl?: string;
} = {}): ReadHook & { data?: UpgradeHistory } {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(currentChainId) || '';
  const chainIdToUse = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlIndexer && address),
    staleTime: HISTORY_STALE_TIME,
    queryKey: ['upgrade-history', urlIndexer, address, chainIdToUse],
    queryFn: () => fetchUpgradeHistory(urlIndexer, chainIdToUse, address)
  });

  return {
    data,
    isLoading: isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'Sky Ecosystem indexer',
        href: urlIndexer,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
