// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { COPIED_FEEDBACK_MS } from '../constants';
import { useCopyText } from './useCopyText';

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => vi.useRealTimers());

describe('useCopyText', () => {
  test('copying puts the text on the clipboard and marks only that item as copied', async () => {
    const { result } = renderHook(() => useCopyText());
    await act(() => result.current.copy('a', 'set p_roll = 45'));

    expect(writeText).toHaveBeenCalledWith('set p_roll = 45');
    expect(result.current.copied('a')).toBe(true);
    expect(result.current.copied('b')).toBe(false);
  });

  test('the copied mark clears after the feedback time', async () => {
    const { result } = renderHook(() => useCopyText());
    await act(() => result.current.copy('a', 'x'));
    act(() => vi.advanceTimersByTime(COPIED_FEEDBACK_MS - 1));
    expect(result.current.copied('a')).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.copied('a')).toBe(false);
  });

  test('copying again restarts the feedback time and moves the mark', async () => {
    const { result } = renderHook(() => useCopyText());
    await act(() => result.current.copy('a', 'x'));
    act(() => vi.advanceTimersByTime(COPIED_FEEDBACK_MS - 100));
    await act(() => result.current.copy('b', 'y'));
    act(() => vi.advanceTimersByTime(200));

    expect(result.current.copied('a')).toBe(false);
    expect(result.current.copied('b')).toBe(true);
  });

  test('a refused clipboard write reports failure, not copied', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useCopyText());
    await act(() => result.current.copy('a', 'x'));

    expect(result.current.copied('a')).toBe(false);
    expect(result.current.failed('a')).toBe(true);
  });
});
