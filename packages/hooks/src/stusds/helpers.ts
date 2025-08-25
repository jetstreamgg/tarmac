/**
 * Calculate how much the stusds available liquidity will decrease over the next bufferMinutes
 * by accounting for both yield accrual and stability fee accrual on staking engine debt
 */
export function calculateLiquidityBuffer(
  currentTotalAssets: bigint, // scaled by 1e18
  ysr: bigint, // scaled by 1e27, 1 + per second rate
  stakingEngineDebt: bigint, // scaled by 1e18
  stakingDuty: bigint, // scaled by 1e27, 1 + per second rate
  bufferMinutes: number = 30 //30 minutes
): bigint {
  const yieldAccrual = calculateYieldAccrual(currentTotalAssets, ysr, bufferMinutes);

  const debtAccrual = calculateDebtAccrual(stakingEngineDebt, stakingDuty, bufferMinutes);

  // Return net buffer (debt growth minus yield growth)
  return debtAccrual > yieldAccrual ? debtAccrual - yieldAccrual : 0n;
}

/**
 * Calculate how much the stusds available capacity will decrease over the next bufferMinutes
 * by accounting for yield accrual on total assets
 */
export function calculateCapacityBuffer(
  currentTotalAssets: bigint, // scaled by 1e18
  ysr: bigint, // scaled by 1e27, 1 + per second rate
  bufferMinutes: number = 30 //30 minutes
): bigint {
  return calculateYieldAccrual(currentTotalAssets, ysr, bufferMinutes);
}

//helper function to calculate yield accrual on total assets
function calculateYieldAccrual(
  currentTotalAssets: bigint, // scaled by 1e18
  ysr: bigint, // scaled by 1e27, 1 + per second rate
  bufferMinutes: number = 30 //30 minutes
): bigint {
  if (bufferMinutes <= 0) {
    return 0n;
  }
  const secondsInBuffer = BigInt(bufferMinutes * 60);
  const BASE_RATE = 10n ** 27n;

  // Calculate yield accrual on total assets
  let yieldAccrual = 0n;
  if (currentTotalAssets > 0n && ysr > BASE_RATE) {
    // ysr is (1 + per_second_rate), so subtract 1 to get actual rate
    const actualYieldRate = ysr - BASE_RATE;
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
