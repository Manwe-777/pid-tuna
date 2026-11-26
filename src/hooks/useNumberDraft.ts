import { useState } from 'react';

/**
 * Text for a number input that the user can edit freely; it resets to the
 * value (2 decimals by default) whenever the value changes from outside.
 */
export function useNumberDraft(
  value: number,
  format: (v: number) => string = (v) => v.toFixed(2),
): [string, (text: string) => void] {
  const [text, setText] = useState(format(value));
  const [shown, setShown] = useState(value);

  if (shown !== value) {
    setShown(value);
    setText(format(value));
  }

  return [text, setText];
}
