import { describe, it, expect } from 'vitest';
import { validateSearchParams } from './validateSearchParams';
import { Intent } from '@/lib/enums';

const validateConvertParams = (query: string) => {
  const params = new URLSearchParams(query);
  return validateSearchParams(params, Intent.CONVERT_INTENT);
};

describe('validateSearchParams for the convert page', () => {
  it('keeps USDC source token', () => {
    const params = validateConvertParams('source_token=USDC');
    expect(params.get('source_token')).toBe('USDC');
  });

  it('keeps USDS source token', () => {
    const params = validateConvertParams('source_token=USDS');
    expect(params.get('source_token')).toBe('USDS');
  });

  it('removes source tokens outside the PSM pair', () => {
    const params = validateConvertParams('source_token=DAI');
    expect(params.has('source_token')).toBe(false);
  });

  it('removes the legacy trade target token', () => {
    const params = validateConvertParams('target_token=USDS');
    expect(params.has('target_token')).toBe(false);
  });
});

describe('validateSearchParams source token scoping', () => {
  it('keeps source token on savings', () => {
    const params = new URLSearchParams('source_token=USDS');
    validateSearchParams(params, Intent.SAVINGS_INTENT);
    expect(params.get('source_token')).toBe('USDS');
  });

  it('removes source token on modules that do not read it', () => {
    const params = new URLSearchParams('source_token=USDS');
    validateSearchParams(params, Intent.BALANCES_INTENT);
    expect(params.has('source_token')).toBe(false);
  });
});

describe('validateSearchParams removed params', () => {
  it('strips the legacy details param', () => {
    const params = new URLSearchParams('details=false');
    validateSearchParams(params, Intent.BALANCES_INTENT);
    expect(params.has('details')).toBe(false);
  });
});

describe('validateSearchParams geo overrides (non-production)', () => {
  it('preserves valid geo override params and strips unrelated unknown params', () => {
    const params = validateConvertParams('geo_mode=restricted&geo_module_savings=true&foo=bar');
    expect(params.get('geo_mode')).toBe('restricted');
    expect(params.get('geo_module_savings')).toBe('true');
    expect(params.has('foo')).toBe(false);
  });

  it('strips geo_mode with an invalid value', () => {
    const params = validateConvertParams('geo_mode=invalid');
    expect(params.has('geo_mode')).toBe(false);
  });

  it('strips geo_module_* with an invalid value', () => {
    const params = validateConvertParams('geo_module_savings=maybe');
    expect(params.has('geo_module_savings')).toBe(false);
  });

  it('strips retired navigation params like widget and vault_module', () => {
    const params = validateConvertParams('widget=convert&vault_module=morpho&convert_module=psm');
    expect(params.has('widget')).toBe(false);
    expect(params.has('vault_module')).toBe(false);
    expect(params.has('convert_module')).toBe(false);
  });
});
