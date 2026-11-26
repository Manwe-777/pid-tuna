import type { Parser } from 'blackbox-log';

/** The WASM parser, initialised once on first use. */
export const parserState: { parser: Promise<Parser> | null } = { parser: null };
