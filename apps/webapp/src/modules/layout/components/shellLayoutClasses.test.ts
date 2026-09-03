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
    // The bar's backdrop-filter samples the page behind it; isolating the bar
    // would make it a backdrop root and empty that sample.
    expect(cls).not.toContain('isolate');
  });

  // APP-456 #6: the bar's `bg` layer per the Navbar comps — the gradient-navbar
  // fill (components/navbar/bg-gradient-start → -end) over background blur-md,
  // Figma radius 12 ⇒ CSS blur(6px). No mask.
  it('carries the comp gradient fill over a 6px backdrop blur', () => {
    const cls = shellHeaderClasses();
    expect(cls).toContain('bg-linear-to-b');
    expect(cls).toContain('from-navbarGradientStart');
    expect(cls).toContain('via-navbarGradientEnd');
    expect(cls).toContain('backdrop-blur-[6px]');
  });

  // The comp's ramp stops at 5% alpha, which left a visible line where the bar
  // met the page. The DS stops still run over the first three quarters; the
  // last quarter carries them to nothing so the bar has no edge to see.
  it('carries the fill to fully transparent at the bottom edge', () => {
    const cls = shellHeaderClasses();
    expect(cls).toContain('via-75%');
    expect(cls).toContain('to-transparent');
  });

  // APP-456 #2: the desktop comp (Navbar 1030:61380) is an 88px bar around the
  // 40px pill row — 24px of breathing room above it, not the 8px that had the
  // logo nearly touching the viewport edge. Mobile takes the DS Mobile / Topbar
  // 16px (551:10137), which had been rounded down to 14px. APP-549: the 88px
  // bar starts at the tablet seam (lg), where the pills come back, not at
  // desktop.
  it('gives each tier the comp vertical padding', () => {
    const cls = shellHeaderClasses();
    expect(cls).toContain('py-4');
    expect(cls).not.toContain('py-3.5');
    expect(cls).toContain('lg:py-6');
    expect(cls).not.toContain('desktop:py-6');
  });
});

// M3 (APP-369): the page gutter follows the DS grid tiers — 20px on the mobile
// tier (per the mobile screen comps), 24px on the S tier (DS "S" row), back to
// 20px at the desktop tier where the 1280 container cap takes over. APP-549:
// the Design QA tablet-grid frames (2800:91684) widen it to 32px from the
// tablet seam (lg), alongside the desktop header pills.
describe('pageGutterClasses', () => {
  it('steps the side gutter 20px → 24px (sm) → 32px (lg) → 20px (desktop)', () => {
    expect(pageGutterClasses).toContain('px-5');
    expect(pageGutterClasses).toContain('sm:px-6');
    expect(pageGutterClasses).toContain('lg:px-8');
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
    expect(cls).toContain('lg:px-8');
    expect(cls).toContain('desktop:px-5');
  });

  // APP-415: from the tablet seam up the row is the comp's three-flank grid
  // (logo | pills | wallet cluster) so the pill group centers on the content
  // axis instead of the leftover flex space between unequal flanks. APP-549
  // moved the seam from desktop (1200) to lg (912) so a desktop user with a
  // wallet extension panel open keeps the pills.
  it('lays the row out as the three-flank grid from the tablet seam', () => {
    const cls = shellHeaderContentClasses();
    expect(cls.split(/\s+/)).toContain('lg:grid');
    expect(cls).toContain('lg:grid-cols-[1fr_auto_1fr]');
    expect(cls).not.toContain('desktop:grid');
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
