import { onTestFinished, vi } from 'vitest';

/** Gives `data-state` elements the CSS animations happy-dom lacks, so Radix keeps a closing dialog mounted. */
export function stubDialogExitAnimation() {
  const realStyles = globalThis.getComputedStyle;
  const spy = vi.spyOn(globalThis, 'getComputedStyle').mockImplementation((element, pseudo) => {
    return new Proxy(realStyles(element, pseudo), {
      get(styles, key) {
        if (key === 'animationName') return (element as HTMLElement).dataset.state ?? 'none';
        const value = Reflect.get(styles, key);
        return typeof value === 'function' ? value.bind(styles) : value;
      }
    });
  });
  onTestFinished(() => spy.mockRestore());
}
