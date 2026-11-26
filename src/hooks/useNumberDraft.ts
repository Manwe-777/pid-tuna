import { useState } from 'react';

/**
 * Text for a number input that the user can edit freely; it resets to the
 * value (2 decimals) whenever the value changes from outside.
 */
export function useNumberDraft(value: number): [string, (text: string) => void] {
  const [text, setText] = useState(value.toFixed(2));
  const [shown, setShown] = useState(value);

  if (shown !== value) {
    setShown(value);
    setText(value.toFixed(2));
  }

  return [text, setText];
}
