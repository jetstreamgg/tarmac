# Theming & semantic token map

> Scope: APP-289 (A2) — Webapp V2 Redesign, Phase 0 foundation.
> Source of truth for values: [`apps/webapp/src/globals.css`](../../globals.css). This doc maps the
> mechanism and the semantics; it deliberately does **not** re-list every hex (that would rot).

The unified `components/ui` primitives (`button`, `dialog`, `sheet`, `select`, …) are styled with
**semantic `--color-*` tokens**, never raw hex. The theme that's active decides what each semantic
token resolves to. This is the two-mode `data-theme` mechanism adopted from PR #1653 (A0).

## The three scopes in `globals.css`

There is **no `.dark` block**. "Dark" is the default; "light" is an override layer. Reading the file
top-to-bottom, the tokens live in three places:

| Scope                             | Lines (approx) | Holds                                                          | Notes                                                                                                              |
| --------------------------------- | -------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `@theme { … }`                    | top of file    | The semantic `--color-*` tokens, **dark values**               | Tailwind v4 emits these as live CSS vars and treats them as the default. This is the **dark / at-parity** palette. |
| `:root { … }`                     | base layer     | Raw **primitives** (`--brand-*`, `--transparent-*`, gradients) | Non-semantic building blocks the `@theme` tokens reference via `var()`. Not theme-switched.                        |
| `:root[data-theme='light'] { … }` | base layer     | **Light overrides** of the semantic `--color-*` tokens         | Only the tokens that need to change for light are redeclared here.                                                 |

`<html data-theme="…">` is set before first paint by an inline script in `src/index.html` (mirrors
`src/lib/theme.ts`: stored choice → OS pref → `dark`). `dark` (or no attribute) → `@theme` defaults.
`light` → the override block wins via the cascade.

### How resolution works (worth internalising)

A utility like `bg-secondary` compiles to `background-color: var(--color-secondary)`. The `var()` is
read **at the consumption site**, so redeclaring `--color-secondary` inside `:root[data-theme='light']`
re-themes every `bg-secondary` on the page with zero per-component work. That's the whole trick.

Two consequences that surprised us during the audit:

1. **Tailwind v4 tree-shakes unused `@theme` tokens.** A `--color-*` token that no compiled utility
   references is _not emitted_ to `:root` at runtime, so it reads as undefined in DevTools even though
   it's declared in `globals.css`. That's dead-code elimination, not a bug. (Example: `selectBackground`
   has no consumer and is absent at runtime in dark; it still resolves in light because the light block
   declares it as a literal, which is not tree-shaken.)
2. **A missing `var()` or an undefined referenced primitive makes a token resolve to an invalid value**
   (it falls back to the property's initial value — e.g. `currentColor`/black for color, transparent for
   background). These render as silent breakage, not console errors. See the audit fixes below.

## Adding or overriding a semantic token

1. **New semantic token:** add `--color-<name>: <dark value>;` to the `@theme` block. Reference a
   primitive with `var(--primitive)` rather than inlining a hex where a primitive exists.
2. **Light value:** add `--color-<name>: <light value>;` inside `:root[data-theme='light']`. Omit it
   only if the dark value is genuinely theme-neutral.
3. Consume it as a Tailwind utility (`bg-<name>`, `text-<name>`, `border-<name>`). Prefer the `light:`
   variant for one-off light tweaks that don't deserve a token.

## Parity status

- **Dark = at-parity.** It must stay **pixel-identical** to production. Do not "improve" dark values;
  only fix outright invalid ones (missing `var()`, undefined referenced primitive).
- **Light = filled from the design system (G2).** The light scope in `globals.css` now carries the DS
  `1. Color modes` / `Light Mode` values, resolved through their alias chains; each line cites the DS
  variable it fills. Parity references are the `🟢 Lightmode` page in Sky App: UI (`1030:58446`).

  Two rules follow from how the DS models modes, and both are load-bearing:

  1. **Only override what actually differs.** 48 of the DS's 117 color variables differ between modes;
     the other 69 are theme-invariant by design (brand ramps, the system color scale, `border-focus`,
     `fg-tertiary`, `fg-text-consistent-*`). Those are deliberately left to the `@theme` dark default
     rather than restated in the light scope — restating them would fork a value the DS intends to keep
     single-sourced.
  2. **Light inverts the elevation stack.** Dark's surfaces rise on lilac-alpha (`#bcb6ef`); light's rise
     on white-alpha (`bg-secondary`/`tertiary`/`quarternary`) over the lilac `bg-primary` page. Hairlines
     and low tints likewise move from dark's lilac to light's periwinkle (`#9ca0e5`). A light value that
     reads as "dark's value with the alpha nudged" is almost always wrong.

  Prefer a token over a `light:` variant. A `light:`-prefixed arbitrary value (`light:border-[#1a1855]`)
  is how the pre-G2 interim palette leaked into components; G2 removed the ones that existed.

## Audit results (A2)

Fixes landed in this ticket, all keeping dark pixel-identical:

| #   | Token                              | Was                                                                         | Now                                                              | Dark impact                                                                                                 |
| --- | ---------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `--color-borderActive` (dark)      | `--transparent-white-25` (no `var()`, **invalid**)                          | `var(--transparent-white-25)`                                    | None — only `light:` consumers (CookieConsentBanner). Now valid if dark ever consumes it.                   |
| 1b  | `--transparent-white-25` primitive | commented out                                                               | restored `#ffffff40`                                             | None — required so `borderActive` (and the unused `selectBackground`) resolve.                              |
| 2   | `--color-secondaryHover` (dark)    | `var(--transparent-black-20)` (== `--color-secondary`, no-op hover)         | **unchanged** (parity)                                           | None. Light already differentiates the secondary states; dark parity preserved. Annotated in `globals.css`. |
| 3   | `--color-bgHover`                  | **undefined everywhere** → `bg-bgHover` was an unknown class (silent no-op) | `transparent` in `@theme` (dark), `rgba(26,24,85,0.06)` in light | None in dark (`transparent` == prior no-op). Light gains the real TopNav MoreMenu row hover.                |

### Deferred (known issue) — bug 4

`--background` / `--foreground` are declared **only** in `:root[data-theme='light']`. In dark they are
undefined, so `--color-background` (`hsl(var(--background))`) resolves to transparent and
`--color-foreground` resolves to **black**. Consumers in dark: `dialog`, `sheet`, `select`, `sonner`,
and the Trade/Pendle config-menu inputs — these get transparent surfaces and invisible black text.

There is **no value that both defines them and keeps dark pixels identical**, so per the A2 ACs the fix
is **deferred** (do not silently change dark). Tracked here; should be picked up alongside the work that
properly themes these primitives for dark. `globals.css` carries a one-line pointer back to this doc.

### Drive-by observation (not in A2 scope)

`button.tsx` `secondary` and `chip` variants contain a stray comma:
`active:bg-secondaryActive, focus:bg-secondaryFocus`. The trailing `,` makes the `active:` class a
no-match, so the active state is dropped. Component-level, out of token scope — left untouched, logged
for whoever owns the Button cleanup.

## Figma ↔ code drift register (bug 5 — tracked QA pass)

Reconciled into named tracking, **not** silently applied (dark is at-parity; changing these would break
AC #1). Each row is a candidate for a deliberate, signed-off follow-up — most likely during G2 light
parity or a Button/chrome re-skin.

| Surface                   | Figma             | Code                                                      | Where                                                           | Disposition                                                                                                                            |
| ------------------------- | ----------------- | --------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Primary light purple      | `#6161FF`         | `#504DFF` (`--brand-light-purple: 80 77 255`)             | `globals.css` primitive                                         | Drift. Don't touch the dark primitive; reconcile when the brand ramp is re-tokenised.                                                  |
| Same `#6161FF`, hardcoded | `#6161FF`         | magic hex `bg-[#6161FF]` / `text-[#1C1655]`               | `widgets/shared/components/ui/card/InteractiveStatsCardAlt.tsx` | Should become a token, not an inline hex. Folds into the brand reconciliation above.                                                   |
| Glass surfaces            | glass stroke/fill | `--primary-glass-stroke` (single stroke token)            | `globals.css`                                                   | Figma models glass as stroke **+** fill + blur; code has only the stroke. Capture full glass token set when glass surfaces are themed. |
| Pill radii                | per Figma spec    | `rounded-full` everywhere; `--radius-sm/md/lg = 6/8/10px` | `button.tsx`, `globals.css`                                     | Verify Figma pill/chip radii against `rounded-full` vs the `--radius-*` scale; no code change until confirmed.                         |

> Adding a token here is cheap and reversible; changing a **dark** value is not. When in doubt, name the
> drift and defer the change.
