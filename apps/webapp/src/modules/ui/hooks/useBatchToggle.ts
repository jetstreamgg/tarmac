import { useConfigContext } from '@/modules/config/hooks/useConfigContext';

export function useBatchToggle() {
  const { userConfig, updateUserConfig } = useConfigContext();
  const setBatchEnabled = (enabled: boolean) => {
    updateUserConfig({ ...userConfig, batchEnabled: enabled });
  };

  return [userConfig.batchEnabled, setBatchEnabled] as const;
}
