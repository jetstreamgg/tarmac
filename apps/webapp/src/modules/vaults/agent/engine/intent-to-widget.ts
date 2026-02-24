import { QueryParams } from '@/lib/constants';
import type { ParsedIntent, RewardContractId } from '../types';

// On-chain reward contract addresses per chainId (from packages/hooks/src/generated.ts)
const REWARD_CONTRACT_ADDRESSES: Record<RewardContractId, Record<number, string>> = {
  usdsSkyReward: { 1: '0x0650CAF159C5A49f711e8169D4336ECB9b950275', 314310: '0x0650CAF159C5A49f711e8169D4336ECB9b950275' },
  usdsSpkReward: { 1: '0x173e314C7635B45322cd8Cb14f44b312e079F3af', 314310: '0x173e314C7635B45322cd8Cb14f44b312e079F3af' },
  cleReward: { 1: '0x10ab606B067C9C461d8893c47C7512472E19e2Ce', 314310: '0x10ab606B067C9C461d8893c47C7512472E19e2Ce' }
};

/**
 * Resolve a POC reward contract ID to an on-chain contract address.
 */
function resolveRewardAddress(rewardContract: RewardContractId, chainId: number): string | undefined {
  return REWARD_CONTRACT_ADDRESSES[rewardContract]?.[chainId];
}

/**
 * Maps a ParsedIntent to webapp URL search params for widget navigation.
 * The networkName should come from the connected chain (e.g. normalizeUrlParam(chain.name)).
 * Returns null if the intent can't be mapped to a valid widget route.
 */
export function intentToWidgetParams(intent: ParsedIntent, chainId: number, networkName: string): URLSearchParams | null {
  const params = new URLSearchParams();
  params.set(QueryParams.Network, networkName);

  const setAmount = () => {
    if (intent.amount && intent.amount !== '0') {
      params.set(QueryParams.InputAmount, intent.amount);
    }
  };

  switch (intent.action) {
    // --- Savings ---
    case 'deposit_assets':
      params.set(QueryParams.Widget, 'savings');
      params.set(QueryParams.Flow, 'supply');
      params.set(QueryParams.SourceToken, 'USDS');
      setAmount();
      break;

    case 'withdraw_assets':
      params.set(QueryParams.Widget, 'savings');
      params.set(QueryParams.Flow, 'withdraw');
      setAmount();
      break;

    case 'redeem_shares':
      params.set(QueryParams.Widget, 'savings');
      params.set(QueryParams.Flow, 'withdraw');
      setAmount();
      break;

    case 'mint_shares':
      params.set(QueryParams.Widget, 'savings');
      params.set(QueryParams.Flow, 'supply');
      setAmount();
      break;

    // --- Upgrade ---
    case 'upgrade_dai_to_usds':
      params.set(QueryParams.Widget, 'convert');
      params.set(QueryParams.ConvertModule, 'upgrade');
      params.set(QueryParams.SourceToken, 'DAI');
      setAmount();
      break;

    case 'revert_usds_to_dai':
      params.set(QueryParams.Widget, 'convert');
      params.set(QueryParams.ConvertModule, 'upgrade');
      params.set(QueryParams.SourceToken, 'USDS');
      setAmount();
      break;

    case 'upgrade_mkr_to_sky':
      params.set(QueryParams.Widget, 'convert');
      params.set(QueryParams.ConvertModule, 'upgrade');
      params.set(QueryParams.SourceToken, 'MKR');
      setAmount();
      break;

    case 'revert_sky_to_mkr':
      params.set(QueryParams.Widget, 'convert');
      params.set(QueryParams.ConvertModule, 'upgrade');
      params.set(QueryParams.SourceToken, 'SKY');
      setAmount();
      break;

    // --- Rewards ---
    case 'rewards_supply': {
      params.set(QueryParams.Widget, 'rewards');
      params.set(QueryParams.Flow, 'supply');
      if (intent.rewardContract) {
        const address = resolveRewardAddress(intent.rewardContract, chainId);
        if (address) params.set(QueryParams.Reward, address);
      }
      setAmount();
      break;
    }

    case 'rewards_withdraw': {
      params.set(QueryParams.Widget, 'rewards');
      params.set(QueryParams.Flow, 'withdraw');
      if (intent.rewardContract) {
        const address = resolveRewardAddress(intent.rewardContract, chainId);
        if (address) params.set(QueryParams.Reward, address);
      }
      setAmount();
      break;
    }

    case 'rewards_claim': {
      params.set(QueryParams.Widget, 'rewards');
      params.set(QueryParams.Flow, 'claim');
      if (intent.rewardContract) {
        const address = resolveRewardAddress(intent.rewardContract, chainId);
        if (address) params.set(QueryParams.Reward, address);
      }
      break;
    }

    case 'rewards_claim_all':
      params.set(QueryParams.Widget, 'rewards');
      break;

    // --- Staking ---
    case 'stake_open':
      params.set(QueryParams.Widget, 'stake');
      params.set(QueryParams.Flow, 'open');
      setAmount();
      break;

    case 'stake_lock':
      params.set(QueryParams.Widget, 'stake');
      params.set(QueryParams.Flow, 'lock');
      params.set(QueryParams.StakeTab, 'lock');
      if (intent.urnIndex !== undefined) params.set(QueryParams.UrnIndex, String(intent.urnIndex));
      setAmount();
      break;

    case 'stake_free':
      params.set(QueryParams.Widget, 'stake');
      params.set(QueryParams.Flow, 'free');
      params.set(QueryParams.StakeTab, 'free');
      if (intent.urnIndex !== undefined) params.set(QueryParams.UrnIndex, String(intent.urnIndex));
      setAmount();
      break;

    case 'stake_borrow':
      params.set(QueryParams.Widget, 'stake');
      if (intent.urnIndex !== undefined) params.set(QueryParams.UrnIndex, String(intent.urnIndex));
      break;

    case 'stake_repay':
      params.set(QueryParams.Widget, 'stake');
      if (intent.urnIndex !== undefined) params.set(QueryParams.UrnIndex, String(intent.urnIndex));
      setAmount();
      break;

    case 'stake_repay_all':
      params.set(QueryParams.Widget, 'stake');
      if (intent.urnIndex !== undefined) params.set(QueryParams.UrnIndex, String(intent.urnIndex));
      break;

    case 'stake_claim':
      params.set(QueryParams.Widget, 'stake');
      params.set(QueryParams.Flow, 'claim');
      if (intent.urnIndex !== undefined) params.set(QueryParams.UrnIndex, String(intent.urnIndex));
      break;

    case 'stake_select_delegate':
      params.set(QueryParams.Widget, 'stake');
      params.set(QueryParams.Flow, 'manage');
      if (intent.urnIndex !== undefined) params.set(QueryParams.UrnIndex, String(intent.urnIndex));
      break;

    case 'stake_select_reward':
      params.set(QueryParams.Widget, 'stake');
      params.set(QueryParams.Flow, 'manage');
      if (intent.urnIndex !== undefined) params.set(QueryParams.UrnIndex, String(intent.urnIndex));
      break;

    // --- stUSDS ---
    case 'stusds_deposit':
      params.set(QueryParams.Widget, 'expert');
      params.set(QueryParams.ExpertModule, 'stusds');
      setAmount();
      break;

    case 'stusds_withdraw':
      params.set(QueryParams.Widget, 'expert');
      params.set(QueryParams.ExpertModule, 'stusds');
      setAmount();
      break;

    // --- Morpho Vaults ---
    case 'morpho_deposit':
      params.set(QueryParams.Widget, 'vaults');
      params.set(QueryParams.VaultModule, 'morpho');
      setAmount();
      break;

    case 'morpho_withdraw':
      params.set(QueryParams.Widget, 'vaults');
      params.set(QueryParams.VaultModule, 'morpho');
      setAmount();
      break;

    // --- Vaults overview ---
    case 'vaults_overview':
      params.set(QueryParams.Widget, 'vaults');
      break;

    default:
      return null;
  }

  return params;
}

/**
 * Convert URLSearchParams to a navigation path string.
 */
export function widgetParamsToPath(params: URLSearchParams): string {
  return `/?${params.toString()}`;
}
