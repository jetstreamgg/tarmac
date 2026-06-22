import { describe, it, expect } from 'vitest';
import { shellHeaderClasses, shellSurfaceClasses } from './shellLayoutClasses';

// B6: full-width destination routes scroll on the document instead of inside the
// legacy viewport-capped box, and the header pins as a sticky, see-through
// frosted bar (Figma: transparent + backdrop blur, content shows through).
describe('shellHeaderClasses', () => {
  it('pins the header as a see-through, blurred bar on full-width routes', () => {
    const cls = shellHeaderClasses(true);
    expect(cls).toContain('sticky');
    expect(cls).toContain('backdrop-blur');
    // Transparent, not an opaque slab — scrolling content shows through it.
    expect(cls).not.toContain('bg-container');
    // Feathered edge: the blur fades out via a gradient mask instead of cutting
    // off at a hard line where blurred meets sharp content.
    expect(cls).toContain('mask-image');
  });

  it('leaves the header static (no sticky, no blur) on boxed routes', () => {
    const cls = shellHeaderClasses(false);
    expect(cls).not.toContain('sticky');
    expect(cls).not.toContain('backdrop-blur');
    expect(cls).not.toContain('mask-image');
  });
});

describe('shellSurfaceClasses', () => {
  it('caps the surface to the viewport so it scrolls inside the box on boxed routes', () => {
    const cls = shellSurfaceClasses(false);
    expect(cls).toContain('overflow-auto');
    expect(cls).toContain('max-h-svh');
  });

  it('drops the viewport cap so the document scrolls on full-width routes', () => {
    const cls = shellSurfaceClasses(true);
    expect(cls).not.toContain('overflow-auto');
    expect(cls).not.toContain('max-h-svh');
  });
});
