import { ReadHook } from '../hooks';
import { useDelegateMetadataMapping } from './useDelegateMetadataMapping';
import { ZERO_ADDRESS } from '../constants';

type UseDelegateNameResponse = ReadHook & {
  data: string | undefined;
};

export function useDelegateName(address?: `0x${string}`): UseDelegateNameResponse {
  const enabled = !!address && address !== ZERO_ADDRESS;
  const {
    data: metadataMapping,
    isLoading,
    error,
    mutate,
    dataSources
  } = useDelegateMetadataMapping(enabled);
  const name =
    address && metadataMapping?.[address.toLowerCase()]?.name
      ? metadataMapping[address.toLowerCase()].name
      : 'Shadow delegate';

  return {
    data: name,
    isLoading,
    error,
    mutate,
    dataSources
  };
}
