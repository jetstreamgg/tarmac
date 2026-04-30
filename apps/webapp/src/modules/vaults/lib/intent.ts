import { QueryParams } from '@/lib/constants';
import { isAddress } from 'viem';
import type { ParsedIntent, ActionType, RewardContractId, StakingRewardFarmId } from '../types';

// --- Helpers ---

function inferRewardContract(text: string): RewardContractId | undefined {
  if (/\bsky\b/i.test(text)) return 'usdsSkyReward';
  if (/\bspk\b/i.test(text)) return 'usdsSpkReward';
  if (/\bcle\b/i.test(text)) return 'cleReward';
  return undefined;
}

function inferCollateralToken(text: string): 'SKY' | 'MKR' {
  if (/\bmkr\b/i.test(text)) return 'MKR';
  return 'SKY';
}

function inferStakingRewardFarm(text: string): StakingRewardFarmId | undefined {
  if (/\bspk\b/i.test(text)) return 'lsSkySpkReward';
  if (/\busds\b/i.test(text)) return 'lsSkyUsdsReward';
  if (/\bsky\s+reward/i.test(text)) return 'lsSkySkyReward';
  return undefined;
}

function extractAddress(text: string): string | undefined {
  const match = text.match(/0x[a-fA-F0-9]{40}/);
  if (!match) return undefined;
  return isAddress(match[0]) ? match[0] : undefined;
}

function extractUrnIndex(text: string): number | undefined {
  const match = text.match(/\bposition\s+(\d+)\b/i);
  return match ? parseInt(match[1], 10) : undefined;
}

// On-chain reward contract addresses per chainId (from packages/hooks/src/generated.ts)
const REWARD_CONTRACT_ADDRESSES: Record<RewardContractId, Record<number, string>> = {
  usdsSkyReward: {
    1: '0x0650CAF159C5A49f711e8169D4336ECB9b950275',
    314310: '0x0650CAF159C5A49f711e8169D4336ECB9b950275'
  },
  usdsSpkReward: {
    1: '0x173e314C7635B45322cd8Cb14f44b312e079F3af',
    314310: '0x173e314C7635B45322cd8Cb14f44b312e079F3af'
  },
  cleReward: {
    1: '0x10ab606B067C9C461d8893c47C7512472E19e2Ce',
    314310: '0x10ab606B067C9C461d8893c47C7512472E19e2Ce'
  }
};

function resolveRewardAddress(rewardContract: RewardContractId, chainId: number): string | undefined {
  return REWARD_CONTRACT_ADDRESSES[rewardContract]?.[chainId];
}

// --- Public API ---

/**
 * Parse natural language intent into a structured ParsedIntent.
 * Deterministic regex-based parser.
 */
export function parseIntent(input: string): ParsedIntent | null {
  const normalized = input.trim().toLowerCase();

  // Extract referral if present
  let referral: number | undefined;
  const referralMatch = normalized.match(/(?:with\s+)?referral\s+(\d+)/);
  if (referralMatch) {
    referral = parseInt(referralMatch[1], 10);
  }

  // --- Vaults overview (no amount needed, check early) ---
  if (/\bvaults?\s+overview\b/.test(normalized) || normalized === 'explore vaults') {
    return { action: 'vaults_overview', amount: '0', unit: 'assets' };
  }

  // --- Rewards claim patterns (no amount needed, check early) ---
  if (/\bclaim\s+(all|every)\b/.test(normalized) || normalized === 'claim all') {
    return { action: 'rewards_claim_all', amount: '0', unit: 'assets' };
  }

  // --- Staking claim (check before rewards claim to handle "claim staking rewards") ---
  if (/\bclaim\b/.test(normalized) && /\b(stak|lockstake|position)\b/.test(normalized)) {
    const farm = inferStakingRewardFarm(normalized);
    const idx = extractUrnIndex(normalized);
    return {
      action: 'stake_claim',
      amount: '0',
      unit: 'assets' as const,
      ...(farm ? { stakingRewardFarm: farm } : {}),
      ...(idx !== undefined ? { urnIndex: idx } : {})
    };
  }

  if (/\bclaim\b/.test(normalized) && /\b(sky|spk|cle)\b/.test(normalized)) {
    const rc = inferRewardContract(normalized);
    return {
      action: 'rewards_claim',
      amount: '0',
      unit: 'assets' as const,
      ...(rc ? { rewardContract: rc } : {})
    };
  }

  // --- Staking no-amount actions (check before amount extraction) ---

  // stake_repay_all
  if (
    /\b(repay|wipe|pay\s+off)\b/.test(normalized) &&
    /\b(all|entire)\b/.test(normalized) &&
    /\b(stak|position|lockstake)\b/.test(normalized)
  ) {
    const idx = extractUrnIndex(normalized);
    return {
      action: 'stake_repay_all',
      amount: '0',
      unit: 'assets' as const,
      ...(idx !== undefined ? { urnIndex: idx } : {})
    };
  }

  // stake_select_delegate
  if (/\bdelegate\b/.test(normalized) && /\b(stak|position|lockstake|voting)\b/.test(normalized)) {
    const addr = extractAddress(input.trim());
    const idx = extractUrnIndex(normalized);
    return {
      action: 'stake_select_delegate',
      amount: '0',
      unit: 'assets' as const,
      ...(addr ? { delegateAddress: addr } : {}),
      ...(idx !== undefined ? { urnIndex: idx } : {})
    };
  }

  // stake_select_reward
  if (
    /\b(select|switch|change)\b/.test(normalized) &&
    /\b(reward|farm)\b/.test(normalized) &&
    /\b(stak|position|lockstake)\b/.test(normalized)
  ) {
    const farm = inferStakingRewardFarm(normalized);
    const idx = extractUrnIndex(normalized);
    return {
      action: 'stake_select_reward',
      amount: '0',
      unit: 'assets' as const,
      ...(farm ? { stakingRewardFarm: farm } : {}),
      ...(idx !== undefined ? { urnIndex: idx } : {})
    };
  }

  // --- Rewards supply/withdraw without amount (check before amount extraction) ---
  if (
    !normalized.match(/\d/) &&
    (/\bsupply\b/.test(normalized) ||
      (/\b(deposit|stake|add)\b/.test(normalized) && /\b(earn|reward)\b/.test(normalized))) &&
    /\b(sky|spk|cle|rewards?)\b/.test(normalized)
  ) {
    const rc = inferRewardContract(normalized);
    return {
      action: 'rewards_supply',
      amount: '0',
      unit: 'assets' as const,
      ...(rc ? { rewardContract: rc } : {})
    };
  }

  // Extract amount
  const amountMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!amountMatch) return null;
  const amount = amountMatch[1];

  // Determine action type based on keywords
  let action: ActionType | null = null;
  let unit: 'assets' | 'shares' = 'assets';
  let rewardContract: RewardContractId | undefined;

  let stakingCollateral: 'SKY' | 'MKR' | undefined;
  let stakingUrnIndex: number | undefined;
  let stakingDelegateAddress: string | undefined;
  let stakingRewardFarm: StakingRewardFarmId | undefined;

  // --- stUSDS patterns (check before savings to avoid conflicts) ---
  if (/\bstusds\b/.test(normalized)) {
    if (/\b(deposit|put|add|stake)\b/.test(normalized)) {
      action = 'stusds_deposit';
    } else if (/\b(withdraw|take\s+out|pull|remove|redeem)\b/.test(normalized)) {
      action = 'stusds_withdraw';
    }
    if (action) {
      return {
        action,
        amount,
        unit: 'assets' as const,
        ...(referral !== undefined ? { referral } : {})
      };
    }
  }

  // --- Morpho vault patterns (check before savings to avoid conflicts) ---
  if (/\b(morpho|vault)\b/.test(normalized)) {
    if (/\b(deposit|supply|put|add)\b/.test(normalized)) {
      action = 'morpho_deposit';
    } else if (/\b(withdraw|take\s+out|pull|remove|redeem)\b/.test(normalized)) {
      action = 'morpho_withdraw';
    }
    if (action) {
      return {
        action,
        amount,
        unit: 'assets' as const,
        ...(referral !== undefined ? { referral } : {})
      };
    }
  }

  // --- Staking patterns ---
  if (
    (/\b(open|create)\b/.test(normalized) && /\b(stak|position)\b/.test(normalized)) ||
    (/\bstake\b/.test(normalized) &&
      /\b(sky|mkr)\b/.test(normalized) &&
      !/\breward/.test(normalized) &&
      !/\b(earn|supply)\b/.test(normalized))
  ) {
    action = 'stake_open';
    stakingCollateral = inferCollateralToken(normalized);
    stakingDelegateAddress = extractAddress(input.trim());
    stakingRewardFarm = inferStakingRewardFarm(normalized);
  } else if (/\block\b/.test(normalized) && /\b(sky|mkr)\b/.test(normalized)) {
    action = 'stake_lock';
    stakingCollateral = inferCollateralToken(normalized);
    stakingUrnIndex = extractUrnIndex(normalized);
  } else if (
    (/\b(free|unlock|unstake)\b/.test(normalized) &&
      /\b(sky|mkr)\b/.test(normalized) &&
      /\b(stak|position|lockstake)\b/.test(normalized)) ||
    (/\bfree\b/.test(normalized) && /\b(sky|mkr)\b/.test(normalized))
  ) {
    action = 'stake_free';
    stakingCollateral = inferCollateralToken(normalized);
    stakingUrnIndex = extractUrnIndex(normalized);
  } else if (
    /\b(borrow|draw)\b/.test(normalized) &&
    /\busds\b/.test(normalized) &&
    /\b(stak|position|lockstake|against)\b/.test(normalized)
  ) {
    action = 'stake_borrow';
    stakingUrnIndex = extractUrnIndex(normalized);
  } else if (
    /\b(repay|wipe|pay\s+back)\b/.test(normalized) &&
    /\busds\b/.test(normalized) &&
    /\b(stak|position|lockstake)\b/.test(normalized)
  ) {
    action = 'stake_repay';
    stakingUrnIndex = extractUrnIndex(normalized);

    // --- Rewards supply/withdraw patterns ---
  } else if (
    (/\bsupply\b/.test(normalized) ||
      (/\b(deposit|stake|add)\b/.test(normalized) && /\b(earn|reward)\b/.test(normalized))) &&
    /\b(sky|spk|cle)\b/.test(normalized)
  ) {
    action = 'rewards_supply';
    rewardContract = inferRewardContract(normalized);
  } else if (
    /\bwithdraw\b/.test(normalized) &&
    /\b(sky|spk|cle)\b/.test(normalized) &&
    /\breward/.test(normalized)
  ) {
    action = 'rewards_withdraw';
    rewardContract = inferRewardContract(normalized);

    // --- Generic rewards supply (no specific reward token) ---
  } else if (/\bsupply\b/.test(normalized) && /\brewards?\b/.test(normalized)) {
    action = 'rewards_supply';

    // --- Upgrade / migration patterns ---
  } else if (
    /\b(upgrade|convert|migrate)\b/.test(normalized) &&
    /\bdai\b/.test(normalized) &&
    /\busds\b/.test(normalized)
  ) {
    action = 'upgrade_dai_to_usds';
  } else if (
    /\b(revert|downgrade)\b/.test(normalized) &&
    /\busds\b/.test(normalized) &&
    /\bdai\b/.test(normalized)
  ) {
    action = 'revert_usds_to_dai';
  } else if (
    /\b(upgrade|convert|migrate)\b/.test(normalized) &&
    /\bmkr\b/.test(normalized) &&
    /\bsky\b/.test(normalized)
  ) {
    action = 'upgrade_mkr_to_sky';
  } else if (
    /\b(revert|downgrade)\b/.test(normalized) &&
    /\bsky\b/.test(normalized) &&
    /\bmkr\b/.test(normalized)
  ) {
    action = 'revert_sky_to_mkr';
  } else if (/\bdai\b.*\b(to|into)\b.*\busds\b/.test(normalized)) {
    action = 'upgrade_dai_to_usds';
  } else if (/\busds\b.*\b(to|into)\b.*\bdai\b/.test(normalized)) {
    action = 'revert_usds_to_dai';
  } else if (/\bmkr\b.*\b(to|into)\b.*\bsky\b/.test(normalized)) {
    action = 'upgrade_mkr_to_sky';
  } else if (/\bsky\b.*\b(to|into)\b.*\bmkr\b/.test(normalized)) {
    action = 'revert_sky_to_mkr';

    // --- Savings patterns ---
  } else if (/\b(deposit|put|save|add|stake)\b/.test(normalized)) {
    if (/\bsusds\b/.test(normalized) || /\bshares?\b/.test(normalized)) {
      action = 'mint_shares';
      unit = 'shares';
    } else {
      action = 'deposit_assets';
      unit = 'assets';
    }
  } else if (/\b(withdraw|take\s+out|pull|remove)\b/.test(normalized)) {
    action = 'withdraw_assets';
    unit = 'assets';
  } else if (/\b(redeem|convert\s+shares|cash\s+out)\b/.test(normalized)) {
    action = 'redeem_shares';
    unit = 'shares';
  } else if (/\b(mint)\b/.test(normalized)) {
    action = 'mint_shares';
    unit = 'shares';
  }

  if (!action) return null;

  // Determine unit from token mentions if possible
  if (action === 'redeem_shares' && /\busds\b/.test(normalized) && !/\bsusds\b/.test(normalized)) {
    action = 'withdraw_assets';
    unit = 'assets';
  }

  return {
    action,
    amount,
    unit,
    ...(referral !== undefined ? { referral } : {}),
    ...(rewardContract !== undefined ? { rewardContract } : {}),
    ...(stakingCollateral !== undefined ? { collateralToken: stakingCollateral } : {}),
    ...(stakingUrnIndex !== undefined ? { urnIndex: stakingUrnIndex } : {}),
    ...(stakingDelegateAddress !== undefined ? { delegateAddress: stakingDelegateAddress } : {}),
    ...(stakingRewardFarm !== undefined ? { stakingRewardFarm } : {})
  };
}

/**
 * Maps a ParsedIntent to webapp URL search params for widget navigation.
 * Returns null if the intent can't be mapped to a valid widget route.
 */
export function intentToWidgetParams(
  intent: ParsedIntent,
  chainId: number,
  networkName: string
): URLSearchParams | null {
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
