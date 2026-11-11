import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSendWhenPrepared } from './useSendWhenPrepared';

type Props = { ready: boolean; error: Error | null; isModalOpen: boolean };

const setup = (initial: Props) => {
  const execute = vi.fn();
  const onError = vi.fn();
  const hook = renderHook((props: Props) => useSendWhenPrepared({ ...props, execute, onError }), {
    initialProps: initial
  });
  return { ...hook, execute, onError };
};

describe('useSendWhenPrepared', () => {
  it('executes at once when prepared, and only once', () => {
    const { result, rerender, execute } = setup({ ready: true, error: null, isModalOpen: true });
    act(() => result.current.send());
    rerender({ ready: true, error: null, isModalOpen: true });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('waits for the legs to be prepared, or reports why they could not be', () => {
    const { result, rerender, execute, onError } = setup({ ready: false, error: null, isModalOpen: true });
    act(() => result.current.send());
    expect(execute).not.toHaveBeenCalled();
    rerender({ ready: true, error: null, isModalOpen: true });
    expect(execute).toHaveBeenCalledTimes(1);

    const failed = new Error('simulation failed');
    rerender({ ready: false, error: null, isModalOpen: true });
    act(() => result.current.send());
    rerender({ ready: false, error: failed, isModalOpen: true });
    rerender({ ready: true, error: null, isModalOpen: true });
    expect(onError).toHaveBeenCalledWith(failed);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('never executes once the modal closed or the send was cancelled before the legs were prepared', () => {
    const { result, rerender, execute } = setup({ ready: false, error: null, isModalOpen: true });
    act(() => result.current.send());
    rerender({ ready: false, error: null, isModalOpen: false });
    rerender({ ready: true, error: null, isModalOpen: true });

    rerender({ ready: false, error: null, isModalOpen: true });
    act(() => result.current.send());
    act(() => result.current.cancel());
    rerender({ ready: true, error: null, isModalOpen: true });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not send behind a closed modal', () => {
    const { result, execute } = setup({ ready: true, error: null, isModalOpen: false });
    act(() => result.current.send());
    expect(execute).not.toHaveBeenCalled();
  });
});
