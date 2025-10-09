export interface FeatureFlags {
  enableExpertModules: boolean;
}

const featureFlags: FeatureFlags = {
  enableExpertModules: import.meta.env.VITE_ENABLE_EXPERT_MODULES === 'true'
};

export const isExpertModulesEnabled = () => featureFlags.enableExpertModules;

export default featureFlags;
