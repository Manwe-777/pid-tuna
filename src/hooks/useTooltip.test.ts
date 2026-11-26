// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { TOOLTIP_DELAY_MS, TOOLTIP_WARM_MS } from '../constants';
import { useTooltip } from './useTooltip';

function el(html: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  document.body.append(wrap);
  return wrap.firstElementChild as HTMLElement;
}

function pointer(type: string, target: EventTarget, init: PointerEventInit = {}) {
  act(() => {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse', ...init }));
  });
}

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

let a: HTMLElement;
let b: HTMLElement;
let plain: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  a = el('<label data-tip="Window length"><span>Window</span></label>');
  b = el('<button data-tip="Reset">Defaults</button>');
  plain = el('<p>No tip here</p>');
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useTooltip', () => {
  test('a tooltip appears only after a short hover', () => {
    const { result } = renderHook(() => useTooltip());
    pointer('pointerover', a);
    wait(TOOLTIP_DELAY_MS - 1);
    expect(result.current).toBeNull();

    wait(1);
    expect(result.current?.text).toBe('Window length');
    expect(result.current?.anchor).toBe(a);
  });

  test('hovering a child of a tipped element shows the parent tooltip', () => {
    const { result } = renderHook(() => useTooltip());
    pointer('pointerover', a.querySelector('span')!);
    wait(TOOLTIP_DELAY_MS);
    expect(result.current?.anchor).toBe(a);
  });

  test('passing over an element too quickly shows nothing', () => {
    const { result } = renderHook(() => useTooltip());
    pointer('pointerover', a);
    wait(TOOLTIP_DELAY_MS / 2);
    pointer('pointerover', plain);
    wait(TOOLTIP_DELAY_MS * 2);
    expect(result.current).toBeNull();
  });

  test('moving straight from one tipped element to the next switches at once', () => {
    const { result } = renderHook(() => useTooltip());
    pointer('pointerover', a);
    wait(TOOLTIP_DELAY_MS);
    pointer('pointerover', b);
    expect(result.current?.text).toBe('Reset');
  });

  test('crossing a gap between tipped elements keeps them quick, a long pause does not', () => {
    const { result } = renderHook(() => useTooltip());
    pointer('pointerover', a);
    wait(TOOLTIP_DELAY_MS);
    pointer('pointerover', plain);
    expect(result.current).toBeNull();

    wait(TOOLTIP_WARM_MS - 1);
    pointer('pointerover', b);
    expect(result.current?.text).toBe('Reset');

    pointer('pointerover', plain);
    wait(TOOLTIP_WARM_MS);
    pointer('pointerover', a);
    expect(result.current).toBeNull();
  });

  test('clicking hides the tooltip until the pointer moves to another element', () => {
    const { result } = renderHook(() => useTooltip());
    pointer('pointerover', a);
    wait(TOOLTIP_DELAY_MS);
    pointer('pointerdown', a);
    expect(result.current).toBeNull();

    pointer('pointerover', a.querySelector('span')!);
    wait(TOOLTIP_DELAY_MS);
    expect(result.current).toBeNull();

    pointer('pointerover', b);
    expect(result.current?.text).toBe('Reset');
  });

  test('Escape hides the tooltip', () => {
    const { result } = renderHook(() => useTooltip());
    pointer('pointerover', a);
    wait(TOOLTIP_DELAY_MS);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current).toBeNull();
  });

  test('touch does not open tooltips', () => {
    const { result } = renderHook(() => useTooltip());
    pointer('pointerover', a, { pointerType: 'touch' });
    wait(TOOLTIP_DELAY_MS);
    expect(result.current).toBeNull();
  });

  test('leaving the window hides the tooltip', () => {
    const { result } = renderHook(() => useTooltip());
    pointer('pointerover', a);
    wait(TOOLTIP_DELAY_MS);
    pointer('pointerout', a, { relatedTarget: null });
    expect(result.current).toBeNull();
  });

  test('an element whose tip is empty shows nothing', () => {
    const empty = el('<span data-tip="">x</span>');
    const { result } = renderHook(() => useTooltip());
    pointer('pointerover', empty);
    wait(TOOLTIP_DELAY_MS);
    expect(result.current).toBeNull();
  });
});
