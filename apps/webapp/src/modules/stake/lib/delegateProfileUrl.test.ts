import { describe, expect, it } from 'vitest';
import { delegateProfileUrl } from './delegateProfileUrl';

const DELEGATE = '0xAbC1111111111111111111111111111111111111';
const FALLBACK = `https://vote.sky.money/address/${DELEGATE.toLowerCase()}`;

describe('delegateProfileUrl', () => {
  it('passes http(s) URLs through untouched', () => {
    expect(delegateProfileUrl('https://example.com/profile', DELEGATE)).toBe('https://example.com/profile');
    expect(delegateProfileUrl('http://example.com', DELEGATE)).toBe('http://example.com');
  });

  it('falls back to the vote.sky.money profile when the metadata URL is absent', () => {
    expect(delegateProfileUrl(undefined, DELEGATE)).toBe(FALLBACK);
    expect(delegateProfileUrl('', DELEGATE)).toBe(FALLBACK);
  });

  it('rejects non-http(s) schemes (subgraph metadata is attacker-controllable)', () => {
    expect(delegateProfileUrl('javascript:alert(document.domain)', DELEGATE)).toBe(FALLBACK);
    expect(delegateProfileUrl('data:text/html,<script>1</script>', DELEGATE)).toBe(FALLBACK);
    expect(delegateProfileUrl('vbscript:x', DELEGATE)).toBe(FALLBACK);
    // Scheme smuggling via whitespace/control characters must not slip through.
    expect(delegateProfileUrl(' javascript:alert(1)', DELEGATE)).toBe(FALLBACK);
    expect(delegateProfileUrl('java\tscript:alert(1)', DELEGATE)).toBe(FALLBACK);
  });

  it('rejects relative and protocol-relative URLs', () => {
    expect(delegateProfileUrl('/profile', DELEGATE)).toBe(FALLBACK);
    expect(delegateProfileUrl('//evil.example', DELEGATE)).toBe(FALLBACK);
    expect(delegateProfileUrl('not a url', DELEGATE)).toBe(FALLBACK);
  });
});
