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
import { DaiUsdsRow, MkrSkyRow, UpgradeHistory, UpgradeResponse, UpgradeResponses } from './upgrade';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';
import { isTestnetId, chainId as chainIdMap } from '@/utils';

async function fetchUpgradeHistory(
  urlIndexer: string,
  chainId: number,
  address?: string
): Promise<UpgradeHistory | undefined> {
  if (!address) return [];
  // Note: 'usr' is the reciever of the upgraded/reverted token, 'caller' is the sender.
  const usr = address.toLowerCase();
  const whereClause = `(where: { usr: { _eq: "${usr}" }, chainId: { _eq: ${chainId} } }, order_by: { blockTimestamp: desc })`;
  const query = gql`
    {
      daiToUsdsUpgrades: DaiToUsdsUpgrade${whereClause} {
        wad
        blockTimestamp
        transactionHash
      }
      usdsToDaiReverts: UsdsToDaiRevert${whereClause} {
        wad
        blockTimestamp
        transactionHash
      }
      mkrToSkyUpgrades: MkrToSkyUpgrade${whereClause} {
        mkrAmt
        skyAmt
        blockTimestamp
        transactionHash
      }
      mkrToSkyUpgradeV2S: MkrToSkyUpgradeV2${whereClause} {
        mkrAmt
        skyAmt
        blockTimestamp
        transactionHash
      }
      skyToMkrReverts: SkyToMkrRevert${whereClause} {
        mkrAmt
        skyAmt
        blockTimestamp
        transactionHash
      }
    }
  `;

  const response: {
    daiToUsdsUpgrades: UpgradeResponses<DaiUsdsRow>;
    usdsToDaiReverts: UpgradeResponses<DaiUsdsRow>;
    mkrToSkyUpgrades: UpgradeResponses<MkrSkyRow>;
    skyToMkrReverts: UpgradeResponses<MkrSkyRow>;
    mkrToSkyUpgradeV2S: UpgradeResponses<MkrSkyRow>;
  } = await request(urlIndexer, query);

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
