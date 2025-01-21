import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ModuleEnum, TransactionTypeEnum } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { DaiUsdsRow, MkrSkyRow, UpgradeHistory, UpgradeResponse, UpgradeResponses } from './upgrade';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useChainId } from 'wagmi';

async function fetchUpgradeHistory(
  urlSubgraph: string,
  address?: string
): Promise<UpgradeHistory | undefined> {
  if (!address) return [];
  // Note: 'usr' is the reciever of the upgraded/reverted token, 'caller' is the sender.
  const query = gql`
    {
      daiToUsdsUpgrades(where: {usr: "${address}"}) {
        wad
        blockTimestamp
        transactionHash
      }
      usdsToDaiReverts(where: {usr: "${address}"}) {
        wad
        blockTimestamp
        transactionHash
      }
      mkrToSkyUpgrades(where: {usr: "${address}"}) {
        mkrAmt
        skyAmt
        blockTimestamp
        transactionHash
      }
      skyToMkrReverts(where: {usr: "${address}"}) {
        mkrAmt
        skyAmt
        blockTimestamp
        transactionHash
      }
    }
  `;

  const response: Record<
    'daiToUsdsUpgrades' | 'usdsToDaiReverts' | 'mkrToSkyUpgrades' | 'skyToMkrReverts',
    UpgradeResponses
  > = await request(urlSubgraph, query);

  const daiToUsdsUpgrades: DaiUsdsRow[] = response.daiToUsdsUpgrades.map(
    (d: UpgradeResponse<DaiUsdsRow>) => ({
      wad: BigInt(d.wad),
      blockTimestamp: new Date(parseInt(d.blockTimestamp) * 1000),
      transactionHash: d.transactionHash,
      module: ModuleEnum.UPGRADE,
      type: TransactionTypeEnum.DAI_TO_USDS
    })
  );

  const usdsToDaiReverts: DaiUsdsRow[] = response.usdsToDaiReverts.map((w: UpgradeResponse<DaiUsdsRow>) => ({
    wad: -BigInt(w.wad), //make withdrawals negative
    blockTimestamp: new Date(parseInt(w.blockTimestamp) * 1000),
    transactionHash: w.transactionHash,
    module: ModuleEnum.UPGRADE,
    type: TransactionTypeEnum.USDS_TO_DAI
  }));

  const mkrToSkyUpgrades: MkrSkyRow[] = response.mkrToSkyUpgrades.map((d: UpgradeResponse<MkrSkyRow>) => ({
    mkrAmt: BigInt(d.mkrAmt),
    skyAmt: BigInt(d.skyAmt),
    blockTimestamp: new Date(parseInt(d.blockTimestamp) * 1000),
    transactionHash: d.transactionHash,
    module: ModuleEnum.UPGRADE,
    type: TransactionTypeEnum.MKR_TO_SKY
  }));

  const skyToMkrReverts: MkrSkyRow[] = response.skyToMkrReverts.map((w: UpgradeResponse<MkrSkyRow>) => ({
    mkrAmt: -BigInt(w.mkrAmt), //make withdrawals negative
    skyAmt: -BigInt(w.skyAmt),
    blockTimestamp: new Date(parseInt(w.blockTimestamp) * 1000),
    transactionHash: w.transactionHash,
    module: ModuleEnum.UPGRADE,
    type: TransactionTypeEnum.SKY_TO_MKR
  }));

  const combined = [...daiToUsdsUpgrades, ...usdsToDaiReverts, ...mkrToSkyUpgrades, ...skyToMkrReverts];
  return combined.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
}

export function useUpgradeHistory({
  subgraphUrl
}: {
  subgraphUrl?: string;
} = {}): ReadHook & { data?: UpgradeHistory } {
  const { address } = useAccount();
  const chainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph && address),
    queryKey: ['upgrade-history', urlSubgraph, address],
    queryFn: () => fetchUpgradeHistory(urlSubgraph, address)
  });

  return {
    data,
    isLoading: isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'Sky Ecosystem subgraph',
        href: urlSubgraph,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
