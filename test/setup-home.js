/**
 * Preloaded by `npm test`: point HOME at a throwaway directory so offline
 * tests that write ~/.cache/helpscout/token.json never touch the real login.
 */
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.HOME = mkdtempSync(path.join(os.tmpdir(), 'helpscout-test-home-'));
