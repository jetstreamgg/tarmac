import { describe, expect, it } from 'vitest';
import { createSanitizeUrlsBeforeSend } from './urlSanitizer';

const sanitize = createSanitizeUrlsBeforeSend({
  allowedParams: ['network', 'flow', '__ph_id'],
  allowedPrefixes: ['geo_module_']
});

const event = (properties: Record<string, unknown>) => ({ properties });

describe('createSanitizeUrlsBeforeSend', () => {
  it('masks name and email param values in captured URLs', () => {
    const result = sanitize(
      event({ $current_url: 'https://app.sky.money/?name=John%20Doe&email=john@example.com&network=base' })
    );
    expect(result?.properties?.$current_url).toBe(
      'https://app.sky.money/?name=redacted&email=redacted&network=base'
    );
  });

  it('masks unknown param values, keeping the key for traceability', () => {
    const result = sanitize(event({ $current_url: 'https://app.sky.money/?x=secret&flow=deposit' }));
    expect(result?.properties?.$current_url).toBe('https://app.sky.money/?x=redacted&flow=deposit');
  });

  it('keeps campaign and click-ID params by default', () => {
    const url = 'https://app.sky.money/?utm_source=x&utm_id=42&gclid=abc&fbclid=def';
    expect(sanitize(event({ $current_url: url }))?.properties?.$current_url).toBe(url);
  });

  it('masks allowlisted params whose value looks like an email', () => {
    const result = sanitize(event({ $current_url: 'https://app.sky.money/?network=a@b.com&flow=deposit' }));
    expect(result?.properties?.$current_url).toBe('https://app.sky.money/?network=redacted&flow=deposit');
  });

  it('masks name/email even when explicitly allowlisted', () => {
    const withMistake = createSanitizeUrlsBeforeSend({ allowedParams: ['name', 'email'] });
    const result = withMistake(event({ $current_url: 'https://x.com/?name=a&email=b@c.io&utm_source=x' }));
    expect(result?.properties?.$current_url).toBe('https://x.com/?name=redacted&email=redacted&utm_source=x');
  });

  it('supports allowed prefixes', () => {
    const result = sanitize(
      event({ $current_url: 'https://app.sky.money/?geo_module_savings=true&geo_other=1' })
    );
    expect(result?.properties?.$current_url).toBe(
      'https://app.sky.money/?geo_module_savings=true&geo_other=redacted'
    );
  });

  it('sanitizes nested $set_once initial URLs and referrers', () => {
    const result = sanitize(
      event({
        $set_once: {
          $initial_current_url: 'https://app.sky.money/?email=a@b.com&network=base',
          $initial_referrer: 'https://google.com/search?q=john@doe.com'
        }
      })
    );
    const setOnce = result?.properties?.$set_once as Record<string, unknown>;
    expect(setOnce?.$initial_current_url).toBe('https://app.sky.money/?email=redacted&network=base');
    expect(setOnce?.$initial_referrer).toBe('https://google.com/search?q=redacted');
  });

  it('sanitizes URLs inside arrays (autocapture elements)', () => {
    const result = sanitize(
      event({ $elements: [{ attr__href: 'https://app.sky.money/?email=a@b.com&flow=x' }] })
    );
    const elements = result?.properties?.$elements as Array<Record<string, unknown>>;
    expect(elements[0].attr__href).toBe('https://app.sky.money/?email=redacted&flow=x');
  });

  it('leaves non-URL strings and URLs without query untouched', () => {
    const props = {
      app_name: 'app',
      widget: 'name=email',
      $current_url: 'https://app.sky.money/savings',
      $pathname: '/savings?fake=1'
    };
    expect(sanitize(event({ ...props }))?.properties).toEqual(props);
  });

  it('preserves malformed URL strings as-is', () => {
    const bad = 'http://[invalid';
    expect(sanitize(event({ $current_url: bad }))?.properties?.$current_url).toBe(bad);
  });

  it('passes through null events (sampling/rejection upstream)', () => {
    expect(sanitize(null)).toBeNull();
  });
});
