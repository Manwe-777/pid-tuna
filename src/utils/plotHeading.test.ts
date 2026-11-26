// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';

import { plotHeading } from './plotHeading';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;

  return document.querySelector('.plot')!;
}

describe('plotHeading', () => {
  test('a plot under an axis title is named by its section and axis', () => {
    const el = mount(
      '<section><h2>Setpoint vs gyro</h2><div class="axis-plot"><h3>Roll</h3><div class="plot"></div></div></section>',
    );

    expect(plotHeading(el)).toBe('Setpoint vs gyro Roll');
  });

  test('a plot directly in a section takes the section heading', () => {
    expect(plotHeading(mount('<section><h2>Battery</h2><div class="plot"></div></section>'))).toBe('Battery');
  });

  test('a plot with no headings around it has no name', () => {
    expect(plotHeading(mount('<div class="plot"></div>'))).toBeNull();
  });
});
