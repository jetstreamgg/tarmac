import type { Page } from '@playwright/test';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { usdcRiskCapitalVaultAddress } from '@/hooks/generated';
import { MORPHO_API_URL } from '@/hooks/morpho/constants';

/** USDC Risk Capital Morpho vault on the Tenderly fork. */
export const USDC_RISK_CAPITAL_VAULT = usdcRiskCapitalVaultAddress[TENDERLY_CHAIN_ID];

export const morphoVaultPath = (vaultAddress: string) => `/earn/vaults/morpho/${vaultAddress}`;

/**
 * The withdraw limit comes from the liquidity Morpho's API reports for the
 * vault on mainnet, not from the fork. When the real vault is fully lent out
 * that is zero and Review stays disabled, so a withdraw test reports ample
 * liquidity and leaves the rest of the live response as it is.
 */
export const mockVaultLiquidity = (page: Page) =>
  page.route(MORPHO_API_URL, async route => {
    if (!route.request().postData()?.includes('VaultMarketData')) return route.fallback();
    const response = await route.fetch();
    const body = await response.json();
    if (body?.data?.vaultV2ByAddress) body.data.vaultV2ByAddress.liquidity = '1000000000000';
    await route.fulfill({ response, json: body });
  });
