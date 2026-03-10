import { describe, it, expect, vi } from 'vitest';
import { validateSearchParams, rewriteLegacyWidgetParams } from './validateSearchParams';
import { mainnet } from 'wagmi/chains';

const validateParams = (query: string) => {
  const params = new URLSearchParams(query);
  return validateSearchParams(
    params,
    [],
    'convert',
    vi.fn(),
    mainnet.id,
    [mainnet] as [typeof mainnet],
    vi.fn(),
    true,
    vi.fn(),
    vi.fn()
  );
};

describe('rewriteLegacyWidgetParams', () => {
  it('rewrites widget=trade to widget=convert&convert_module=trade', () => {
    const params = new URLSearchParams('widget=trade');
    rewriteLegacyWidgetParams(params);
    expect(params.get('widget')).toBe('convert');
    expect(params.get('convert_module')).toBe('trade');
  });

  it('rewrites widget=upgrade to widget=convert&convert_module=upgrade', () => {
    const params = new URLSearchParams('widget=upgrade');
    rewriteLegacyWidgetParams(params);
    expect(params.get('widget')).toBe('convert');
    expect(params.get('convert_module')).toBe('upgrade');
  });

  it('rewrites widget=upgrade on mainnet to widget=convert&convert_module=upgrade', () => {
    const params = new URLSearchParams('widget=upgrade&network=ethereum');
    rewriteLegacyWidgetParams(params);
    expect(params.get('widget')).toBe('convert');
    expect(params.get('convert_module')).toBe('upgrade');
    expect(params.get('network')).toBe('ethereum');
  });

  it('leaves widget=upgrade unchanged on L2 networks', () => {
    const params = new URLSearchParams('widget=upgrade&network=base');
    rewriteLegacyWidgetParams(params);
    expect(params.get('widget')).toBe('upgrade');
    expect(params.has('convert_module')).toBe(false);
    expect(params.get('network')).toBe('base');
  });

  it('leaves widget=savings unchanged', () => {
    const params = new URLSearchParams('widget=savings');
    rewriteLegacyWidgetParams(params);
    expect(params.get('widget')).toBe('savings');
    expect(params.has('convert_module')).toBe(false);
  });

  it('leaves widget=convert&convert_module=trade unchanged', () => {
    const params = new URLSearchParams('widget=convert&convert_module=trade');
    rewriteLegacyWidgetParams(params);
    expect(params.get('widget')).toBe('convert');
    expect(params.get('convert_module')).toBe('trade');
  });

  it('does not overwrite existing convert_module', () => {
    const params = new URLSearchParams('widget=trade&convert_module=upgrade');
    rewriteLegacyWidgetParams(params);
    expect(params.get('widget')).toBe('convert');
    expect(params.get('convert_module')).toBe('upgrade');
  });

  it('preserves all other params', () => {
    const params = new URLSearchParams('widget=trade&network=ethereum&flow=revert&source_token=MKR');
    rewriteLegacyWidgetParams(params);
    expect(params.get('widget')).toBe('convert');
    expect(params.get('convert_module')).toBe('trade');
    expect(params.get('network')).toBe('ethereum');
    expect(params.get('flow')).toBe('revert');
    expect(params.get('source_token')).toBe('MKR');
  });

  it('handles case-insensitive widget values', () => {
    const params = new URLSearchParams('widget=Trade');
    rewriteLegacyWidgetParams(params);
    expect(params.get('widget')).toBe('convert');
    expect(params.get('convert_module')).toBe('trade');
  });
});

describe('validateSearchParams for convert psm', () => {
  it('keeps USDC source token for convert_module=psm', () => {
    const params = validateParams('widget=convert&convert_module=psm&source_token=USDC');
    expect(params.get('convert_module')).toBe('psm');
    expect(params.get('source_token')).toBe('USDC');
  });

  it('removes unsupported source token for convert_module=psm', () => {
    const params = validateParams('widget=convert&convert_module=psm&source_token=DAI');
    expect(params.get('convert_module')).toBe('psm');
    expect(params.has('source_token')).toBe(false);
  });

  it('removes target token for convert_module=psm', () => {
    const params = validateParams('widget=convert&convert_module=psm&target_token=USDS');
    expect(params.get('convert_module')).toBe('psm');
    expect(params.has('target_token')).toBe(false);
  });
});
