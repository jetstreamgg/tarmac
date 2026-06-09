import { describe, it, expect } from 'vitest';
import { validateSearchParams } from './validateSearchParams';
import { ConvertIntent, Intent } from '@/lib/enums';

const validateConvertParams = (query: string, convertIntent: ConvertIntent | undefined) => {
  const params = new URLSearchParams(query);
  return validateSearchParams(params, Intent.CONVERT_INTENT, convertIntent, false);
};

describe('validateSearchParams for convert psm', () => {
  it('keeps USDC source token for the psm submodule', () => {
    const params = validateConvertParams('source_token=USDC', ConvertIntent.PSM_INTENT);
    expect(params.get('source_token')).toBe('USDC');
  });

  it('keeps USDS source token for the psm submodule', () => {
    const params = validateConvertParams('source_token=USDS', ConvertIntent.PSM_INTENT);
    expect(params.get('source_token')).toBe('USDS');
  });

  it('removes unsupported source token for the psm submodule', () => {
    const params = validateConvertParams('source_token=DAI', ConvertIntent.PSM_INTENT);
    expect(params.has('source_token')).toBe(false);
  });

  it('removes target token for the psm submodule', () => {
    const params = validateConvertParams('target_token=USDS', ConvertIntent.PSM_INTENT);
    expect(params.has('target_token')).toBe(false);
  });
});

describe('validateSearchParams source token scoping', () => {
  it('removes source token on the convert overview (no submodule)', () => {
    const params = validateConvertParams('source_token=USDS', undefined);
    expect(params.has('source_token')).toBe(false);
  });

  it('keeps a supported source token for the upgrade submodule on mainnet', () => {
    const params = validateConvertParams('source_token=MKR', ConvertIntent.UPGRADE_INTENT);
    expect(params.get('source_token')).toBe('MKR');
  });

  it('removes an unsupported source token for the upgrade submodule', () => {
    const params = validateConvertParams('source_token=USDC', ConvertIntent.UPGRADE_INTENT);
    expect(params.has('source_token')).toBe(false);
  });

  it('removes source token for the upgrade submodule on L2 chains', () => {
    const params = new URLSearchParams('source_token=MKR');
    validateSearchParams(params, Intent.CONVERT_INTENT, ConvertIntent.UPGRADE_INTENT, true);
    expect(params.has('source_token')).toBe(false);
  });

  it('keeps source token on savings', () => {
    const params = new URLSearchParams('source_token=USDS');
    validateSearchParams(params, Intent.SAVINGS_INTENT, undefined, false);
    expect(params.get('source_token')).toBe('USDS');
  });
});

describe('validateSearchParams details param', () => {
  it('keeps boolean values and removes anything else', () => {
    const valid = new URLSearchParams('details=false');
    validateSearchParams(valid, Intent.BALANCES_INTENT, undefined, false);
    expect(valid.get('details')).toBe('false');

    const invalid = new URLSearchParams('details=banana');
    validateSearchParams(invalid, Intent.BALANCES_INTENT, undefined, false);
    expect(invalid.has('details')).toBe(false);
  });
});

describe('validateSearchParams geo overrides (non-production)', () => {
  it('preserves valid geo override params and strips unrelated unknown params', () => {
    const params = validateConvertParams('geo_mode=restricted&geo_module_savings=true&foo=bar', undefined);
    expect(params.get('geo_mode')).toBe('restricted');
    expect(params.get('geo_module_savings')).toBe('true');
    expect(params.has('foo')).toBe(false);
  });

  it('strips geo_mode with an invalid value', () => {
    const params = validateConvertParams('geo_mode=invalid', undefined);
    expect(params.has('geo_mode')).toBe(false);
  });

  it('strips geo_module_* with an invalid value', () => {
    const params = validateConvertParams('geo_module_savings=maybe', undefined);
    expect(params.has('geo_module_savings')).toBe(false);
  });

  it('strips retired navigation params like widget and vault_module', () => {
    const params = validateConvertParams('widget=convert&vault_module=morpho&convert_module=psm', undefined);
    expect(params.has('widget')).toBe(false);
    expect(params.has('vault_module')).toBe(false);
    expect(params.has('convert_module')).toBe(false);
  });
});
