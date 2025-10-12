/**
 * Calculate the buffered available liquidity for stUSDS withdrawals.
 * This function compares current liquidity to projected liquidity after bufferMinutes
 * and returns the minimum of the two. This prevents withdrawal failures in all scenarios:
 *
 * - When debt rate > supply rate: future liquidity < current liquidity (debt grows faster)
 * - When supply rate > debt rate: future liquidity >= current liquidity (assets grow faster)
 *
 * By taking the minimum, we ensure withdrawals won't fail due to liquidity changes over time.
 */
export function calculateLiquidityBuffer(
  currentTotalAssets: bigint, // scaled by 1e18
  str: bigint, // scaled by 1e27, 1 + per second rate
  stakingEngineDebt: bigint, // scaled by 1e18
  stakingDuty: bigint, // scaled by 1e27, 1 + per second rate
  bufferMinutes: number = 30 //30 minutes
): bigint {
  // Calculate current liquidity
  const currentLiquidity =
    currentTotalAssets > stakingEngineDebt ? currentTotalAssets - stakingEngineDebt : 0n;

  // Calculate total assets after buffer period
  const yieldAccrual = calculateYieldAccrual(currentTotalAssets, str, bufferMinutes);
  const totalAssetsInFuture = currentTotalAssets + yieldAccrual;

  // Calculate total debt after buffer period
  const debtAccrual = calculateDebtAccrual(stakingEngineDebt, stakingDuty, bufferMinutes);
  const stakingEngineDebtInFuture = stakingEngineDebt + debtAccrual;

  // Calculate future liquidity
  const futureLiquidity =
    totalAssetsInFuture > stakingEngineDebtInFuture ? totalAssetsInFuture - stakingEngineDebtInFuture : 0n;

  // Return the minimum of current and future liquidity
  // This naturally handles both rate scenarios:
  // - If debt rate > supply rate: futureLiquidity < currentLiquidity (apply buffer)
  // - If supply rate > debt rate: futureLiquidity >= currentLiquidity (no extra buffer)
  return currentLiquidity < futureLiquidity ? currentLiquidity : futureLiquidity;
}

/**
 * Calculate how much the stusds available capacity will decrease over the next bufferMinutes
 * by accounting for yield accrual on total assets
 */
export function calculateCapacityBuffer(
  currentTotalAssets: bigint, // scaled by 1e18
  str: bigint, // scaled by 1e27, 1 + per second rate
  bufferMinutes: number = 30 //30 minutes
): bigint {
  return calculateYieldAccrual(currentTotalAssets, str, bufferMinutes);
}

//helper function to calculate yield accrual on total assets
function calculateYieldAccrual(
  currentTotalAssets: bigint, // scaled by 1e18
  str: bigint, // scaled by 1e27, 1 + per second rate
  bufferMinutes: number = 30 //30 minutes
): bigint {
  if (bufferMinutes <= 0) {
    return 0n;
  }
  const secondsInBuffer = BigInt(bufferMinutes * 60);
  const BASE_RATE = 10n ** 27n;

  // Calculate yield accrual on total assets
  let yieldAccrual = 0n;
  if (currentTotalAssets > 0n && str > BASE_RATE) {
    // str is (1 + per_second_rate), so subtract 1 to get actual rate
    const actualYieldRate = str - BASE_RATE;
    // Apply rate for buffer period: assets * rate * time
    // Doesn't account for compounding, but is close enough for short time periods
    yieldAccrual = (currentTotalAssets * actualYieldRate * secondsInBuffer) / BASE_RATE; //scaled by 1e18
  }

  return yieldAccrual;
}

//helper function to calculate debt accrual on staking engine debt
function calculateDebtAccrual(
  stakingEngineDebt: bigint, // scaled by 1e18
  stakingDuty: bigint, // scaled by 1e27, 1 + per second rate
  bufferMinutes: number = 30 //30 minutes
): bigint {
  if (bufferMinutes <= 0) {
    return 0n;
  }
  const secondsInBuffer = BigInt(bufferMinutes * 60);
  const BASE_RATE = 10n ** 27n;

  // Calculate debt accrual on staking engine debt
  let debtAccrual = 0n;
  if (stakingEngineDebt > 0n && stakingDuty > 0n) {
    //duty is 1 + per_second_rate, so subtract 1 to get actual rate
    const actualDuty = stakingDuty - BASE_RATE;
    // Apply rate for buffer period: debt * per_second_rate * time
    // Doesn't account for compounding, but is close enough for short time periods
    debtAccrual = (stakingEngineDebt * actualDuty * secondsInBuffer) / BASE_RATE; //scaled by 1e18
  }

  return debtAccrual;
}
