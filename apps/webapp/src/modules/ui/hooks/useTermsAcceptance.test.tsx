import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTermsAcceptance } from './useTermsAcceptance';
import { termsAcceptanceKey } from '@/modules/ui/lib/termsAcceptanceStorage';

const ADDRESS_A = '0x1234567890123456789012345678901234567890';
const ADDRESS_B = '0x0987654321098765432109876543210987654321';
// The numeric identity the flag is keyed by. Opaque to the hook — it never
// parses or compares parts of it, which is what lets a minor bump re-prompt.
const VERSION = '1.0';

describe('useTermsAcceptance', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with no flag and writes one keyed by (address, version)', () => {
    const { result } = renderHook(() => useTermsAcceptance({ address: ADDRESS_A, version: VERSION }));

    expect(result.current.hasLocalAcceptance).toBe(false);

    act(() => {
      result.current.recordLocalAcceptance();
    });

    expect(result.current.hasLocalAcceptance).toBe(true);
    expect(localStorage.getItem(termsAcceptanceKey(ADDRESS_A, VERSION))).toBe('true');
  });

  it('reads back an existing flag on mount', () => {
    localStorage.setItem(termsAcceptanceKey(ADDRESS_A, VERSION), 'true');

    const { result } = renderHook(() => useTermsAcceptance({ address: ADDRESS_A, version: VERSION }));

    expect(result.current.hasLocalAcceptance).toBe(true);
  });

  // The reason the key carries the address at all: wallet B may already have a
  // DB row from another device, and version-only keying would let B's owner
  // through without ever being shown the terms.
  it('does not carry over to a second address in the same browser', () => {
    localStorage.setItem(termsAcceptanceKey(ADDRESS_A, VERSION), 'true');

    const { result, rerender } = renderHook(
      ({ address }) => useTermsAcceptance({ address, version: VERSION }),
      {
        initialProps: { address: ADDRESS_A }
      }
    );
    expect(result.current.hasLocalAcceptance).toBe(true);

    rerender({ address: ADDRESS_B });

    expect(result.current.hasLocalAcceptance).toBe(false);
  });

  it('is invalidated by a version bump', () => {
    localStorage.setItem(termsAcceptanceKey(ADDRESS_A, VERSION), 'true');

    const { result, rerender } = renderHook(
      ({ version }) => useTermsAcceptance({ address: ADDRESS_A, version }),
      {
        initialProps: { version: VERSION }
      }
    );
    expect(result.current.hasLocalAcceptance).toBe(true);

    rerender({ version: '2026-06-01' });

    expect(result.current.hasLocalAcceptance).toBe(false);
  });

  it('drops the stale flag for the same address when a new version is accepted', () => {
    localStorage.setItem(termsAcceptanceKey(ADDRESS_A, VERSION), 'true');

    const { result } = renderHook(() => useTermsAcceptance({ address: ADDRESS_A, version: '2026-06-01' }));
    act(() => {
      result.current.recordLocalAcceptance();
    });

    expect(localStorage.getItem(termsAcceptanceKey(ADDRESS_A, VERSION))).toBeNull();
    expect(localStorage.getItem(termsAcceptanceKey(ADDRESS_A, '2026-06-01'))).toBe('true');
  });

  it('leaves other addresses alone when pruning', () => {
    localStorage.setItem(termsAcceptanceKey(ADDRESS_B, VERSION), 'true');

    const { result } = renderHook(() => useTermsAcceptance({ address: ADDRESS_A, version: '2026-06-01' }));
    act(() => {
      result.current.recordLocalAcceptance();
    });

    expect(localStorage.getItem(termsAcceptanceKey(ADDRESS_B, VERSION))).toBe('true');
  });

  // The DB lower-cases addresses via a trigger, so the two spellings of one
  // address must not disagree about whether the terms were shown.
  it('treats a checksummed and a lower-case address as the same wallet', () => {
    const checksummed = '0xAbC1234567890123456789012345678901234567';
    localStorage.setItem(termsAcceptanceKey(checksummed.toLowerCase(), VERSION), 'true');

    const { result } = renderHook(() => useTermsAcceptance({ address: checksummed, version: VERSION }));

    expect(result.current.hasLocalAcceptance).toBe(true);
  });

  it('cannot record a flag before the version is known', () => {
    const { result } = renderHook(() => useTermsAcceptance({ address: ADDRESS_A, version: undefined }));

    let recorded = true;
    act(() => {
      recorded = result.current.recordLocalAcceptance();
    });

    expect(recorded).toBe(false);
    expect(result.current.hasLocalAcceptance).toBe(false);
    expect(Object.keys(localStorage)).toHaveLength(0);
  });

  it('reports no acceptance while disconnected', () => {
    const { result } = renderHook(() => useTermsAcceptance({ address: undefined, version: VERSION }));

    expect(result.current.hasLocalAcceptance).toBe(false);
  });

  /**
   * Safari with "Block all cookies", locked-down enterprise profiles and some
   * webviews throw on every localStorage access. Without a session fallback
   * these users can never satisfy the gate's local half: the DB row is
   * written, the flag is not, and the modal reopens forever.
   */
  describe('when localStorage is blocked', () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };

    beforeEach(() => {
      vi.stubGlobal('localStorage', {
        getItem: blocked,
        setItem: blocked,
        removeItem: blocked,
        key: blocked,
        get length(): number {
          return blocked();
        }
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('still records and reads back an acceptance', () => {
      const { result } = renderHook(() => useTermsAcceptance({ address: ADDRESS_A, version: VERSION }));
      expect(result.current.hasLocalAcceptance).toBe(false);

      act(() => {
        expect(result.current.recordLocalAcceptance()).toBe(true);
      });

      expect(result.current.hasLocalAcceptance).toBe(true);
    });

    it('still re-prompts a second address', () => {
      const { result, rerender } = renderHook(
        ({ address }) => useTermsAcceptance({ address, version: VERSION }),
        { initialProps: { address: ADDRESS_A } }
      );
      act(() => {
        result.current.recordLocalAcceptance();
      });
      expect(result.current.hasLocalAcceptance).toBe(true);

      rerender({ address: ADDRESS_B });

      expect(result.current.hasLocalAcceptance).toBe(false);
    });

    it('still re-prompts after a version bump', () => {
      const { result, rerender } = renderHook(
        ({ version }) => useTermsAcceptance({ address: ADDRESS_A, version }),
        { initialProps: { version: VERSION } }
      );
      act(() => {
        result.current.recordLocalAcceptance();
      });
      expect(result.current.hasLocalAcceptance).toBe(true);

      rerender({ version: '2026-06-01' });

      expect(result.current.hasLocalAcceptance).toBe(false);
    });
  });

  /**
   * Reads can work while writes throw — quota exceeded, or classic Safari
   * private mode. Before the read-back check this was a silent accept-loop:
   * the DB row was written and recordLocalAcceptance returned true, but the
   * flag never became readable, so the gate stayed shut and the modal
   * reopened on every reconnect — appending another acceptance event per
   * retry, with nothing in Sentry (APP-497 review).
   *
   * Fresh addresses per test: the module-level session copy survives between
   * tests in this file, so reusing an address would make assertions vacuous.
   */
  describe('when localStorage reads work but writes fail', () => {
    const ADDRESS_C = '0x00000000000000000000000000000000000000cc';
    const ADDRESS_D = '0x00000000000000000000000000000000000000dd';
    let store: Record<string, string>;

    const stubStorage = (setItem: (k: string, v: string) => void) => {
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store[k] ?? null,
        setItem,
        removeItem: (k: string) => {
          delete store[k];
        },
        key: (i: number) => Object.keys(store)[i] ?? null,
        get length(): number {
          return Object.keys(store).length;
        }
      });
    };

    beforeEach(() => {
      store = {};
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('records into the session copy when the write throws, and reads it back', () => {
      stubStorage(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      const { result } = renderHook(() => useTermsAcceptance({ address: ADDRESS_C, version: VERSION }));
      expect(result.current.hasLocalAcceptance).toBe(false);

      act(() => {
        expect(result.current.recordLocalAcceptance()).toBe(true);
      });

      expect(result.current.hasLocalAcceptance).toBe(true);
    });

    it('still re-prompts a second address after a session-copy acceptance', () => {
      stubStorage(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      const { result, rerender } = renderHook(
        ({ address }) => useTermsAcceptance({ address, version: VERSION }),
        { initialProps: { address: ADDRESS_C } }
      );
      act(() => {
        result.current.recordLocalAcceptance();
      });
      expect(result.current.hasLocalAcceptance).toBe(true);

      rerender({ address: ADDRESS_B });

      expect(result.current.hasLocalAcceptance).toBe(false);
    });

    it('falls back to the session copy when a write silently does not stick', () => {
      stubStorage(() => {});

      const { result } = renderHook(() => useTermsAcceptance({ address: ADDRESS_D, version: VERSION }));

      act(() => {
        expect(result.current.recordLocalAcceptance()).toBe(true);
      });

      expect(result.current.hasLocalAcceptance).toBe(true);
    });
  });
});
