import { useConfigContext } from '@/modules/config/hooks/useConfigContext';

export function useIsBatchEnabled(): boolean {
  const { userConfig } = useConfigContext();
  return userConfig.batchEnabled;
}
