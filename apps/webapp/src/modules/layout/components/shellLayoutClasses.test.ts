import { describe, it, expect } from 'vitest';
import {
  pageGutterClasses,
  shellHeaderClasses,
  shellHeaderContentClasses,
  shellSurfaceClasses
} from './shellLayoutClasses';

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

// M3 (APP-369): the page gutter follows the DS grid tiers — 20px on the mobile
// tier (per the mobile screen comps), 24px on the tablet tier (DS "S" row),
// back to 20px at the desktop tier where the 1280 container cap takes over.
describe('pageGutterClasses', () => {
  it('steps the side gutter 20px → 24px (tablet) → 20px (desktop)', () => {
    expect(pageGutterClasses).toContain('px-5');
    expect(pageGutterClasses).toContain('sm:px-6');
    expect(pageGutterClasses).toContain('desktop:px-5');
  });
});

describe('shellHeaderContentClasses', () => {
  it('aligns the full-width header row with the page container at every tier', () => {
    const cls = shellHeaderContentClasses(true);
    expect(cls).toContain('max-w-[1320px]');
    // Same gutter tiers as the container, or the logo drifts off the content edge.
    expect(cls).toContain('px-5');
    expect(cls).toContain('sm:px-6');
    expect(cls).toContain('desktop:px-5');
  });

  it('keeps the legacy full-bleed padding on boxed routes', () => {
    const cls = shellHeaderContentClasses(false);
    expect(cls).not.toContain('max-w-[1320px]');
    expect(cls).toContain('sm:px-10');
  });

  // APP-415: the desktop row is the comp's three-flank grid (logo | pills |
  // wallet cluster) so the pill group centers on the content axis instead of
  // the leftover flex space between unequal flanks.
  it('lays the desktop row out as the three-flank grid in both modes', () => {
    for (const fullWidth of [true, false]) {
      const cls = shellHeaderContentClasses(fullWidth);
      expect(cls).toContain('desktop:grid');
      expect(cls).toContain('desktop:grid-cols-[1fr_auto_1fr]');
    }
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
