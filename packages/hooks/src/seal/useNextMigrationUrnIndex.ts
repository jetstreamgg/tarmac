import { useAccount, useChainId, useReadContract } from 'wagmi';
import { ReadHook } from '../hooks';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { stakeDataSource } from '../stake/datasources';
import { useCurrentUrnIndex } from '../stake/useCurrentUrnIndex';
import { useUrnAddress } from '../stake/useUrnAddress';
import { ZERO_ADDRESS } from '../constants';
import { useVault } from '../vaults/useVault';
import { getIlkName } from '../vaults/helpers';

type UseNextMigrationUrnIndexResponse = ReadHook & {
  data: bigint | undefined;
};

export function useNextMigrationUrnIndex(): UseNextMigrationUrnIndexResponse {
  const chainId = useChainId();
  const { address } = useAccount();

  // Get the current (uncreated) urn index from stake engine
  const {
    data: currentUrnIndex,
    isLoading: isCurrentUrnIndexLoading,
    error: isCurrentUrnIndexError,
    mutate: refetchCurrentUrnIndex,
    dataSources: currentUrnIndexDataSource
  } = useCurrentUrnIndex();

  // If there's more than 1, set this variable to the second-to-last urn so we can check it's status
  const candidateUrnIndex = currentUrnIndex && currentUrnIndex > 0n ? currentUrnIndex - 1n : 0n;

  const { data: candidateUrnAddress } = useUrnAddress(candidateUrnIndex);

  // Check if the urn address exists
  const isCandidateUrnAddressValid = candidateUrnAddress && candidateUrnAddress !== ZERO_ADDRESS;

  const {
    data: recordedAddress,
    isLoading: isRecordedAddressLoading,
    error: isRecordedAddressError,
    refetch: refetchRecordedAddress
  } = useReadContract({
    chainId,
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
    functionName: 'urnOwners',
    args: [candidateUrnAddress!],
    scopeKey: `urnIndex-${candidateUrnAddress}-${chainId}`,
    query: {
      enabled: !!candidateUrnAddress
    }
  });
  const stakeUrnOwnersDataSource = stakeDataSource(chainId, 'urnOwners');

  // Check if the currently connected address is the urn owner
  const isCandidateUrnOwner = recordedAddress?.toLocaleLowerCase() === address?.toLocaleLowerCase();

  const ilkName = getIlkName(chainId, 2);

  const {
    data: vaultData,
    isLoading: isVaultLoading,
    error: isVaultError,
    mutate: refetchVault,
    dataSources: vaultDataSources
  } = useVault(candidateUrnAddress, ilkName);

  // Check that there is no collateral locked or debt drawn
  const isUrnEmpty = vaultData?.debtValue === 0n && vaultData?.collateralAmount === 0n;

  const {
    data: auctions,
    isLoading: isAuctionsLoading,
    error: isAuctionsError,
    refetch: refetchAuctions
  } = useReadContract({
    chainId,
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
    abi: stakeModuleAbi,
    functionName: 'urnAuctions',
    args: [candidateUrnAddress!],
    scopeKey: `auctions-${candidateUrnAddress}-${chainId}`,
    query: {
      enabled: !!candidateUrnAddress
    }
  });
  const stakeUrnAuctionsDataSource = stakeDataSource(chainId, 'urnAuctions');

  const isUrnAuctioned = auctions && auctions > 0n;

  const isCandidateUrnValid =
    isCandidateUrnAddressValid && isCandidateUrnOwner && isUrnEmpty && !isUrnAuctioned;

  return {
    // If the candidate urn is valid, we can proceed with it for migration, if not we default to the latest unused urn index
    data: isCandidateUrnValid ? candidateUrnIndex : currentUrnIndex,
    isLoading: isCurrentUrnIndexLoading || isRecordedAddressLoading || isVaultLoading || isAuctionsLoading,
    error: isCurrentUrnIndexError || isRecordedAddressError || isVaultError || isAuctionsError,
    mutate: () => {
      refetchCurrentUrnIndex();
      refetchRecordedAddress();
      refetchVault();
      refetchAuctions();
    },
    dataSources: [
      ...currentUrnIndexDataSource,
      stakeUrnOwnersDataSource,
      stakeUrnAuctionsDataSource,
      ...vaultDataSources
    ]
  };
}
