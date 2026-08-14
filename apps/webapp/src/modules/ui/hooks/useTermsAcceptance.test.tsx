import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTermsAcceptance } from './useTermsAcceptance';
import { termsAcceptanceKey } from '@/modules/ui/lib/termsAcceptanceStorage';

const ADDRESS_A = '0x1234567890123456789012345678901234567890';
const ADDRESS_B = '0x0987654321098765432109876543210987654321';
const VERSION = '2026-01-15';

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
});
