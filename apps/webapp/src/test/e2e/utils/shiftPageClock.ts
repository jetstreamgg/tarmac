import { type Page } from '@playwright/test';

/**
 * From the next load, the page's Date runs `offsetMs` ahead of real time. Unlike page.clock,
 * timers keep running, so React Query and wagmi settle as usual.
 */
export async function shiftPageClock(page: Page, offsetMs: number): Promise<void> {
  await page.addInitScript(offset => {
    const RealDate = Date;
    class ShiftedDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date> | []) {
        if (args.length === 0) super(RealDate.now() + offset);
        else super(...(args as ConstructorParameters<typeof Date>));
      }
      static override now() {
        return RealDate.now() + offset;
      }
    }
    Object.assign(ShiftedDate, { parse: RealDate.parse, UTC: RealDate.UTC });
    (globalThis as { Date: DateConstructor }).Date = ShiftedDate as DateConstructor;
  }, offsetMs);
}
