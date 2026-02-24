import type { ParsedIntent, ActionType, RewardContractId, StakingRewardFarmId } from '../types';

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
  return match ? match[0] : undefined;
}

function extractUrnIndex(text: string): number | undefined {
  const match = text.match(/\bposition\s+(\d+)\b/i);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Parse intent via the LLM-backed API (stub for M1 — falls back to regex immediately).
 */
export async function parseIntentAsync(input: string): Promise<ParsedIntent | null> {
  // M1: regex-only, no LLM proxy
  return parseIntent(input);
}

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
    (/\bsupply\b/.test(normalized) || (/\b(deposit|stake|add)\b/.test(normalized) && /\b(earn|reward)\b/.test(normalized))) &&
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
 * Generate a human-readable description of the parsed intent.
 */
export function describeIntent(intent: ParsedIntent): string {
  const col = intent.collateralToken ?? 'SKY';
  const farmName = intent.stakingRewardFarm
    ? (
        {
          lsSkyUsdsReward: 'USDS',
          lsSkySpkReward: 'SPK',
          lsSkySkyReward: 'SKY',
          lsMkrUsdsReward: 'USDS'
        } as const
      )[intent.stakingRewardFarm]
    : 'rewards';

  const descriptions: Record<ActionType, string> = {
    deposit_assets: `Deposit ${intent.amount} USDS into the Sky Savings Rate vault`,
    withdraw_assets: `Withdraw ${intent.amount} USDS from the Sky Savings Rate vault`,
    redeem_shares: `Redeem ${intent.amount} sUSDS shares for USDS`,
    mint_shares: `Mint ${intent.amount} sUSDS shares`,
    upgrade_dai_to_usds: `Upgrade ${intent.amount} DAI to USDS`,
    revert_usds_to_dai: `Revert ${intent.amount} USDS to DAI`,
    upgrade_mkr_to_sky: `Upgrade ${intent.amount} MKR to SKY (receives ${Number(intent.amount) * 24000} SKY)`,
    revert_sky_to_mkr: `Revert ${intent.amount} SKY to MKR (receives ${Number(intent.amount) / 24000} MKR)`,
    rewards_supply: `Supply ${intent.amount} USDS to earn ${intent.rewardContract === 'usdsSkyReward' ? 'SKY' : intent.rewardContract === 'usdsSpkReward' ? 'SPK' : intent.rewardContract === 'cleReward' ? 'CLE' : 'rewards'}`,
    rewards_withdraw: `Withdraw ${intent.amount} USDS from ${intent.rewardContract === 'usdsSkyReward' ? 'SKY' : intent.rewardContract === 'usdsSpkReward' ? 'SPK' : intent.rewardContract === 'cleReward' ? 'CLE' : ''} rewards`,
    rewards_claim: `Claim ${intent.rewardContract === 'usdsSkyReward' ? 'SKY' : intent.rewardContract === 'usdsSpkReward' ? 'SPK' : intent.rewardContract === 'cleReward' ? 'CLE' : ''} rewards`,
    rewards_claim_all: 'Claim all earned rewards across all reward contracts',
    stusds_deposit: `Deposit ${intent.amount} USDS into the stUSDS vault`,
    stusds_withdraw: `Withdraw ${intent.amount} USDS from the stUSDS vault`,
    morpho_deposit: `Deposit ${intent.amount} USDS into the Morpho vault`,
    morpho_withdraw: `Withdraw ${intent.amount} USDS from the Morpho vault`,
    vaults_overview: 'Navigate to vaults overview',
    stake_open: `Open staking position with ${intent.amount} ${col}${intent.delegateAddress ? ` (delegate: ${intent.delegateAddress})` : ''}${intent.stakingRewardFarm ? ` (farm: ${farmName})` : ''}`,
    stake_lock: `Lock ${intent.amount} ${col} into staking position${intent.urnIndex !== undefined ? ` #${intent.urnIndex}` : ''}`,
    stake_free: `Free ${intent.amount} ${col} from staking position${intent.urnIndex !== undefined ? ` #${intent.urnIndex}` : ''}`,
    stake_borrow: `Borrow ${intent.amount} USDS against staking position${intent.urnIndex !== undefined ? ` #${intent.urnIndex}` : ''}`,
    stake_repay: `Repay ${intent.amount} USDS on staking position${intent.urnIndex !== undefined ? ` #${intent.urnIndex}` : ''}`,
    stake_repay_all: `Repay all borrowed USDS on staking position${intent.urnIndex !== undefined ? ` #${intent.urnIndex}` : ''}`,
    stake_claim: `Claim ${farmName} from staking position${intent.urnIndex !== undefined ? ` #${intent.urnIndex}` : ''}`,
    stake_select_delegate: `Set vote delegate to ${intent.delegateAddress ?? 'specified address'} on staking position${intent.urnIndex !== undefined ? ` #${intent.urnIndex}` : ''}`,
    stake_select_reward: `Select ${farmName} reward farm for staking position${intent.urnIndex !== undefined ? ` #${intent.urnIndex}` : ''}`
  };

  let desc = descriptions[intent.action];
  if (intent.referral !== undefined) {
    desc += ` (referral: ${intent.referral})`;
  }
  return desc;
}
