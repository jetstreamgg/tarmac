import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { historyQueryArgs } from '../shared/historyQueryHelpers';
import { DaiUsdsRow, MkrSkyRow, UpgradeHistory, UpgradeResponse, UpgradeResponses } from './upgrade';

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
