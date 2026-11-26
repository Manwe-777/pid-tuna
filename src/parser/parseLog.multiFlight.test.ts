import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { parseLog } from './parseLog';

const PATH = join(process.env.PIDTUNA_LOG_DIR ?? '', 'pid', 'LOG00005.BFL');
const available = Boolean(process.env.PIDTUNA_LOG_DIR) && existsSync(PATH);

describe.skipIf(!available)('a file holding two flights', () => {
  test('both flights parse, the second the same as the first on its own', async () => {
    const bytes = readFileSync(PATH);
    const twoFlights = new File([bytes, bytes], 'TWO.BFL');
    const single = await parseLog(new File([bytes], 'ONE.BFL'));
    const first = await parseLog(twoFlights, { logIndex: 0 });
    const second = await parseLog(twoFlights, { logIndex: 1 });

    expect(first.logCount).toBe(2);
    expect(second.logIndex).toBe(1);
    expect(second.time.length).toBe(single.time.length);
    expect(second.setup.firmwareVersion).toBe(single.setup.firmwareVersion);
    expect(Array.from(second.gyroFilt[0].subarray(1000, 1010))).toEqual(
      Array.from(single.gyroFilt[0].subarray(1000, 1010)),
    );
  });
});
