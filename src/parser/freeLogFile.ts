import type { LogFile } from 'blackbox-log';

/**
 * Frees a parsed file. blackbox-log 0.2.2's `LogFile.free()` walks the headers
 * it handed out as an array indexed by flight and crashes on a gap, which a
 * file read from a later flight leaves. Parsing the earlier flights' headers
 * (cheap) fills the gaps first.
 */
export function freeLogFile(logFile: LogFile, logIndex: number) {
  for (let i = 0; i < logIndex; i++) logFile.parseHeaders(i);
  logFile.free();
}
