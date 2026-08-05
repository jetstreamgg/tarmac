import { describe, it, expect } from 'vitest';
import {
  pageGutterClasses,
  shellHeaderClasses,
  shellHeaderContentClasses,
  shellSurfaceClasses
} from './shellLayoutClasses';

// G5: every route scrolls on the document — the boxed mode (a viewport-capped
// surface the two-pane routes scrolled inside) is gone, so these helpers no
// longer branch. The header pins as a sticky, see-through frosted bar (Figma:
// transparent + backdrop blur, content shows through).
describe('shellHeaderClasses', () => {
  it('pins the header as a see-through bar', () => {
    const cls = shellHeaderClasses();
    expect(cls).toContain('sticky');
    // Transparent, not an opaque slab — scrolling content shows through it.
    expect(cls).not.toContain('bg-container');
    // The blur layers live in `HeaderBlur` and sample the page behind the bar;
    // isolating the bar would make it a backdrop root and empty that sample.
    expect(cls).not.toContain('isolate');
  });

  // APP-456 #2: the desktop comp (Navbar 1881:51590) is an 88px bar around the
  // 40px pill row — 24px of breathing room above it, not the 8px that had the
  // logo nearly touching the viewport edge.
  it('gives the desktop bar the comp 24px vertical padding', () => {
    const cls = shellHeaderClasses();
    expect(cls).toContain('desktop:py-6');
    expect(cls).not.toContain('desktop:py-2');
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
  it('aligns the header row with the page container at every tier', () => {
    const cls = shellHeaderContentClasses();
    expect(cls).toContain('max-w-[1320px]');
    // Same gutter tiers as the container, or the logo drifts off the content edge.
    expect(cls).toContain('px-5');
    expect(cls).toContain('sm:px-6');
    expect(cls).toContain('desktop:px-5');
  });

  // APP-415: the desktop row is the comp's three-flank grid (logo | pills |
  // wallet cluster) so the pill group centers on the content axis instead of
  // the leftover flex space between unequal flanks.
  it('lays the desktop row out as the three-flank grid', () => {
    const cls = shellHeaderContentClasses();
    expect(cls).toContain('desktop:grid');
    expect(cls).toContain('desktop:grid-cols-[1fr_auto_1fr]');
  });
});

describe('shellSurfaceClasses', () => {
  it('carries no viewport cap and no inner scroll, so the document scrolls', () => {
    const cls = shellSurfaceClasses();
    expect(cls).not.toContain('overflow-auto');
    expect(cls).not.toContain('max-h-svh');
    expect(cls).not.toContain('max-h-screen');
    // Still fills the viewport so short pages don't collapse the surface.
    expect(cls).toContain('min-h-svh');
  });
});
