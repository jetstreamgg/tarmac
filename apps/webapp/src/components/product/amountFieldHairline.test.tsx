import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AmountFieldHairline } from './amountFieldHairline';

// happy-dom (the fast-suite test environment, see vite.config.ts) does not run
// a real CSS engine: no stylesheet is loaded, so `:hover`/`:focus-within`
// never actually resolve and `getComputedStyle` can't observe them. The only
// thing these tests CAN observe is which Tailwind utility classes render for
// a given `hasError` value — so we assert on those class strings and lean on
// their meaning (documented in amountFieldHairline.tsx): a state's utility is
// either present (that state's treatment is live) or absent (it can never
// fire, because the class doesn't exist in the DOM for CSS to match against).
// The literal computed backgrounds for rest/hover/focus/error are verified
// live in the browser (see the PR's browser-QA notes), not here.
describe('AmountFieldHairline — DS Input / Amount hairline (5620:26710)', () => {
  afterEach(cleanup);

  const getHairline = (container: HTMLElement) => container.querySelector('[aria-hidden]') as HTMLElement;

  it('rest: renders the 10%-alpha rest treatment with the hover/focus utilities live and dormant', () => {
    const { container } = render(<AmountFieldHairline hasError={false} />);
    const hairline = getHairline(container);
    const className = hairline.className;

    // Rest treatment always present as the base (unprefixed) utility.
    expect(className).toContain('bg-borderPrimary');
    // Hover and focus states are available (CSS can match them) so that on
    // hover / focus-within, they take over from rest.
    expect(className).toContain('group-hover:bg-borderTertiary');
    expect(className).toContain('group-focus-within:bg-linear-to-r');
    expect(className).toContain('group-focus-within:from-slider-brand-start');
    expect(className).toContain('group-focus-within:to-slider-brand-end');
    // No error treatment leaks in.
    expect(className).not.toContain('bg-statusError');
  });

  it('hover: the group-hover utility resolves to the 30%-alpha token, distinct from rest', () => {
    const { container } = render(<AmountFieldHairline hasError={false} />);
    const className = getHairline(container).className;

    // `group-hover:bg-borderTertiary` is the DS Hover treatment (`#bcb6ef` @
    // 30%, --color-borderTertiary) — distinct from the rest-state
    // `bg-borderPrimary` (10%) it will override once the ancestor `.group`
    // is `:hover`.
    expect(className).toContain('group-hover:bg-borderTertiary');
  });

  it('focus: the group-focus-within utilities resolve to the brand gradient, not a flat color', () => {
    const { container } = render(<AmountFieldHairline hasError={false} />);
    const className = getHairline(container).className;

    // Active/focus is a left-to-right gradient (#504DFF -> #757DFF), which is
    // why this renders `background-image` utilities (`bg-linear-to-r` +
    // `from-*`/`to-*`) rather than a `border-color` swap — a flat color can't
    // express a gradient.
    expect(className).toContain('group-focus-within:bg-linear-to-r');
    expect(className).toContain('group-focus-within:from-slider-brand-start');
    expect(className).toContain('group-focus-within:to-slider-brand-end');
    // The 30%-alpha hover token must not be what focus renders.
    expect(className).not.toMatch(/group-focus-within:bg-borderTertiary/);
  });

  it('error: renders the flat error color and precedence over focus/hover', () => {
    const { container } = render(<AmountFieldHairline hasError={true} />);
    const className = getHairline(container).className;

    expect(className).toContain('bg-statusError');
    // Precedence (error > focus > hover > rest) is enforced structurally, not
    // by CSS specificity: when `hasError` is true, the hover/rest/focus
    // utilities are never emitted at all, so there is no rule for a
    // simultaneous `:hover`/`:focus-within` to win against — error always
    // paints, focused or not, hovered or not.
    expect(className).not.toContain('bg-borderPrimary');
    expect(className).not.toContain('group-hover:bg-borderTertiary');
    expect(className).not.toContain('group-focus-within:bg-linear-to-r');
    expect(className).not.toContain('group-focus-within:from-slider-brand-start');
    expect(className).not.toContain('group-focus-within:to-slider-brand-end');
  });

  it('error while focused: the error treatment still wins (same class output as plain error)', () => {
    // There is no separate "focused" render path — focus is a pure-CSS
    // ancestor state, so the component's output for `hasError={true}` is
    // identical whether or not the shared `group` ancestor happens to be
    // focus-within. Rendering it inside a focused input is what proves that:
    // the DOM the field produces gives the error rule sole authorship, so a
    // simultaneous focus-within on the ancestor has literally no gradient
    // class to compete against it.
    const { container } = render(
      <div className="group">
        <input autoFocus data-testid="input" />
        <AmountFieldHairline hasError={true} />
      </div>
    );
    const className = getHairline(container).className;

    expect(className).toContain('bg-statusError');
    expect(className).not.toContain('group-focus-within:bg-linear-to-r');
  });

  it('is a single element, not a border on a wrapping box (gradient needs a background, not border-color)', () => {
    const { container } = render(<AmountFieldHairline hasError={false} />);
    const hairline = getHairline(container);

    expect(hairline.tagName).toBe('DIV');
    expect(hairline.className).not.toMatch(/\bborder(-[a-z]+)?\b/);
    expect(hairline.className).toContain('h-px');
    expect(hairline.className).toContain('w-full');
  });
});
