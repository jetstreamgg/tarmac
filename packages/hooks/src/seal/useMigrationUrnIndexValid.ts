import { useAccount, useChainId, useReadContract } from 'wagmi';
import { ReadHook } from '../hooks';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { stakeDataSource } from '../stake/datasources';
import { useUrnAddress } from '../stake/useUrnAddress';
import { ZERO_ADDRESS } from '../constants';
import { useVault } from '../vaults/useVault';
import { useCurrentUrnIndex } from '../stake/useCurrentUrnIndex';
import { getIlkName } from '../vaults/helpers';

type UseMigrationUrnIndexValidResponse = ReadHook & {
  data: bigint | undefined;
  isCandidateUrnValid: boolean;
};

export function useMigrationUrnIndexValid(urnIndex?: bigint): UseMigrationUrnIndexValidResponse {
  const chainId = useChainId();
  const { address } = useAccount();

  const candidateUrnIndex = urnIndex || 0n;
  const { data: candidateUrnAddress } = useUrnAddress(candidateUrnIndex);

  const {
    data: currentUrnIndex,
    isLoading: isCurrentUrnIndexLoading,
    error: isCurrentUrnIndexError,
    mutate: refetchCurrentUrnIndex,
    dataSources: currentUrnIndexDataSource
  } = useCurrentUrnIndex();

  const isCurrentUrnIndex = currentUrnIndex === candidateUrnIndex;

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
    isCurrentUrnIndex || (isCandidateUrnAddressValid && isCandidateUrnOwner && isUrnEmpty && !isUrnAuctioned);

  return {
    data: urnIndex,
    isCandidateUrnValid: !!isCandidateUrnValid,
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
