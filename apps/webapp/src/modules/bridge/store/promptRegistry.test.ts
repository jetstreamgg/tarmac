import { describe, expect, it } from 'vitest';
import { createPromptRegistry } from './promptRegistry';

describe('createPromptRegistry', () => {
  it('stays open until every prompt under the key is answered, each counted once', () => {
    const registry = createPromptRegistry();
    const first = registry.open('a');
    const second = registry.open('a');
    first();
    first();
    expect(registry.isOpen('a')).toBe(true);
    second();
    expect(registry.isOpen('a')).toBe(false);
  });

  it('keeps keys and registries apart', () => {
    const registry = createPromptRegistry();
    registry.open('a');
    expect(registry.isOpen('b')).toBe(false);
    expect(createPromptRegistry().isOpen('a')).toBe(false);
  });
});
