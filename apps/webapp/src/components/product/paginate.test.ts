import { describe, it, expect } from 'vitest';
import { paginate } from './paginate';

// C4: client-side slicing of the already-fetched product-detail history. The
// arithmetic (slice bounds, page count, clamping) lives here so the component
// only has to wire it to state + the pagination control.
describe('paginate', () => {
  it('returns the first pageSize rows on page 1', () => {
    const rows = Array.from({ length: 15 }, (_, i) => i);
    const { rows: pageRows } = paginate(rows, 10, 1);

    expect(pageRows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('reports totalPages as ceil(length / pageSize)', () => {
    expect(paginate(Array.from({ length: 15 }), 10, 1).totalPages).toBe(2);
    expect(paginate(Array.from({ length: 20 }), 10, 1).totalPages).toBe(2);
    expect(paginate(Array.from({ length: 21 }), 10, 1).totalPages).toBe(3);
  });

  it('returns the trailing partial remainder on the last page', () => {
    const rows = Array.from({ length: 15 }, (_, i) => i);
    expect(paginate(rows, 10, 2).rows).toEqual([10, 11, 12, 13, 14]);
  });

  it('clamps an out-of-range page to a valid slice instead of going empty', () => {
    const rows = Array.from({ length: 15 }, (_, i) => i);
    // Above the last page falls back to the last page.
    expect(paginate(rows, 10, 3).rows).toEqual([10, 11, 12, 13, 14]);
    // Below the first page falls back to the first page.
    expect(paginate(rows, 10, 0).rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('treats an empty set as a single empty page', () => {
    const { rows, totalPages } = paginate([], 10, 1);
    expect(rows).toEqual([]);
    expect(totalPages).toBe(1);
  });
});
